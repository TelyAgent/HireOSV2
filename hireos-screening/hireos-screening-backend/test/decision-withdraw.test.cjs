// Issue #23 AC-7 — withdrawing a screening decision, against an in-memory stand-in for Prisma.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DecisionsService } = require('../dist/decisions/decisions.service');

const WS = 'ws-1';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: ['hr'], kind: 'session' };

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(row[key]);
      if ('gte' in cond) return row[key] >= cond.gte;
    }
    return row[key] === cond;
  });
}

function table(rows) {
  return {
    rows,
    findFirst: async ({ where }) => rows.find((r) => matches(r, where)) ?? null,
    findMany: async ({ where }) => rows.filter((r) => matches(r, where)),
    findUniqueOrThrow: async ({ where }) => rows.find((r) => r.id === where.id),
    count: async ({ where }) => rows.filter((r) => matches(r, where)).length,
    update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
    updateMany: async ({ where, data }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    create: async ({ data }) => (rows.push(data), data),
  };
}

function setup({ handoffStatus } = {}) {
  const decidedAt = new Date('2026-10-14T02:00:00Z');
  const db = {
    screeningDecision: table([{ id: 'd1', workspaceId: WS, applicationId: 'a1', outcome: 'advance', reason: 'strong', decidedBy: 'hr-1', createdAt: decidedAt, status: 'approved', nextStepTarget: 'move_to_interview', overrideAi: false }]),
    screeningOutboxEvent: table(
      handoffStatus ? [{ id: 'e1', workspaceId: WS, aggregateId: 'a1', eventType: 'candidate.advanced_to_interview', status: handoffStatus, createdAt: decidedAt }] : [],
    ),
    application: table([{ id: 'a1', workspaceId: WS, screeningStatus: 'decided' }]),
    screeningEvaluation: table([{ id: 'ev1', workspaceId: WS, applicationId: 'a1' }]),
    handoffPackage: table([{ id: 'p1', workspaceId: WS, decisionId: 'd1', status: 'prepared' }]),
    humanTask: table([{ id: 't1', workspaceId: WS, applicationId: 'a1', taskType: 'screening_review', status: 'completed', completionRef: 'd1', completedAt: decidedAt }]),
    auditRecord: table([]),
  };
  db.$transaction = async (fn) => fn(db);
  return { db, service: new DecisionsService(db) };
}

test('AC-7: a reason is required to withdraw', async () => {
  const { service } = setup();
  await assert.rejects(service.withdraw(identity, 'a1', 'd1', { reason: '  ' }), (e) => e.response.code === 'WITHDRAW_REASON_REQUIRED');
});

test('AC-7: withdrawing before handoff cancels it, reopens the task and returns the candidate to awaiting a decision', async () => {
  const { db, service } = setup({ handoffStatus: 'pending' });
  const { decision } = await service.withdraw(identity, 'a1', 'd1', { reason: 'wrong candidate' });
  assert.equal(decision.status, 'withdrawn');
  assert.equal(decision.withdrawnBy, 'hr-1');
  assert.equal(decision.withdrawReason, 'wrong candidate');
  assert.ok(decision.withdrawnAt);
  assert.equal(db.screeningOutboxEvent.rows[0].status, 'cancelled');
  assert.equal(db.handoffPackage.rows[0].status, 'cancelled');
  assert.equal(db.application.rows[0].screeningStatus, 'review_pending');
  assert.equal(db.humanTask.rows[0].status, 'open');
  assert.equal(db.humanTask.rows[0].completedAt, null);
  assert.equal(db.auditRecord.rows[0].action, 'screening_decision_withdrawn');
});

test('AC-7: a decision whose handoff was already dispatched cannot be withdrawn here', async () => {
  const { db, service } = setup({ handoffStatus: 'dispatched' });
  await assert.rejects(
    service.withdraw(identity, 'a1', 'd1', { reason: 'too late' }),
    (e) => e.getStatus() === 409 && e.response.code === 'HANDOFF_ALREADY_SENT' && e.response.target === 'interview',
  );
  assert.equal(db.screeningDecision.rows[0].status, 'approved', 'decision untouched');
  assert.equal(db.application.rows[0].screeningStatus, 'decided');
});

test('AC-7: an already withdrawn decision cannot be withdrawn again', async () => {
  const { service } = setup();
  await service.withdraw(identity, 'a1', 'd1', { reason: 'first' });
  await assert.rejects(service.withdraw(identity, 'a1', 'd1', { reason: 'second' }), (e) => e.response.code === 'DECISION_NOT_ACTIVE');
});
