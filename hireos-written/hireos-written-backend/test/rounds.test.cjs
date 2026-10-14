// Issue #48 -- assessment rounds: one draft round at a time, sent rounds read-only, per-round finalize.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { hasDraftRound, nextRoundNumber, assertDraftSendable, assertPlanItemEditable, assertCaseOpen } = require('../dist/invitations/rounds');
const { InvitationsService } = require('../dist/invitations/invitations.service');
const { PlanItemsService } = require('../dist/plan-items/plan-items.service');
const { CaseLifecycleService } = require('../dist/cases/case-lifecycle.service');

const WS = 'ws-1';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const code = (e) => e.response?.code;

// ---- a tiny in-memory Prisma: just the calls these services make ----
function matches(row, where = {}) {
  return Object.entries(where).every(([k, v]) => {
    if (k === 'submission') return v.isNot === null ? row.submission != null : true;
    if (v && typeof v === 'object' && 'in' in v) return v.in.includes(row[k]);
    return row[k] === v;
  });
}
function table(rows, opts = {}) {
  const sort = (list, orderBy) => {
    if (!orderBy) return list;
    const [[key, dir]] = Object.entries(orderBy);
    return [...list].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === 'desc' ? -1 : 1));
  };
  return {
    rows,
    findFirst: async ({ where, orderBy } = {}) => sort(rows.filter((r) => matches(r, where)), orderBy)[0] ?? null,
    findUnique: async ({ where }) => rows.find((r) => r.id === where.id) ?? null,
    findMany: async ({ where, orderBy } = {}) => sort(rows.filter((r) => matches(r, where)), orderBy),
    count: async ({ where }) => rows.filter((r) => matches(r, where)).length,
    create: async ({ data }) => {
      const row = { id: `${opts.prefix || 'row'}-${rows.length + 1}`, createdAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => Object.assign(rows.find((r) => r.id === where.id), data),
    updateMany: async ({ where, data }) => {
      const hit = rows.filter((r) => matches(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    delete: async ({ where }) => rows.splice(rows.findIndex((r) => r.id === where.id), 1)[0],
  };
}
function setup({ status = 'released', draftRoundOpen = false, invitations: invitationRows = [], planItems: planItemRows = [] } = {}) {
  const db = {
    case: table([{ id: 'c1', workspaceId: WS, status, draftRoundOpen, candidate: { name: 'Ann' }, job: { title: 'PM' } }]),
    invitation: table(invitationRows, { prefix: 'inv' }),
    planItem: table(planItemRows, { prefix: 'pi' }),
    submission: { update: async ({ where, data }) => Object.assign(db.invitation.rows.find((i) => i.submission?.id === where.id).submission, data) },
    task: table([]),
  };
  db.case.findFirst = async ({ where }) => {
    const c = db.case.rows.find((r) => r.id === where.id && r.workspaceId === where.workspaceId);
    return c ?? null;
  };
  db.$transaction = async (fn) => fn(db);
  const config = { get: (_k, d) => d };
  const lifecycle = new CaseLifecycleService(db, config);
  const invitations = new InvitationsService(db, { sendFromWorkspaceAccount: async () => ({ sent: true }) }, config, {}, lifecycle);
  const planItems = new PlanItemsService(db);
  return { db, invitations, planItems, lifecycle };
}
const question = { questionId: 'q1', code: 'AI-1', title: 'T', prompt: 'P', competencies: [] };
const sendDto = { questions: [question], mode: 'deadline_only', deadline: '2026-10-20T10:00:00Z', disclosurePolicy: 'score_and_summary', recipientEmail: 'a@b.c' };
const round1 = { id: 'inv-r1', workspaceId: WS, caseId: 'c1', round: 1, status: 'submitted', createdAt: new Date('2026-10-01'), submission: { id: 's1', answers: [], finalizedAt: new Date('2026-10-02'), releasedAt: new Date('2026-10-03') } };

test('rule: one draft round -- before the first send, after "add supplemental test", or while it holds questions', () => {
  assert.equal(hasDraftRound({ roundsSent: 0, draftRoundOpen: false, draftItems: 0 }), true);
  assert.equal(hasDraftRound({ roundsSent: 1, draftRoundOpen: false, draftItems: 0 }), false);
  assert.equal(hasDraftRound({ roundsSent: 1, draftRoundOpen: true, draftItems: 0 }), true);
  assert.equal(hasDraftRound({ roundsSent: 1, draftRoundOpen: false, draftItems: 2 }), true);
  assert.equal(nextRoundNumber([]), 1);
  assert.equal(nextRoundNumber([1, 2]), 3);
  assert.throws(() => assertDraftSendable({ roundsSent: 1, draftRoundOpen: false, draftItems: 0 }), (e) => code(e) === 'NO_DRAFT_ROUND');
  assert.throws(() => assertDraftSendable({ roundsSent: 1, draftRoundOpen: true, draftItems: 0 }), (e) => code(e) === 'DRAFT_ROUND_EMPTY');
  assert.throws(() => assertPlanItemEditable({ invitationId: 'inv-1' }), (e) => code(e) === 'PLAN_ITEM_LOCKED');
  assert.throws(() => assertCaseOpen('handed_off'), (e) => code(e) === 'CASE_ENDED');
});

test('AC-1/AC-2: sending freezes the draft questions into round N; earlier rounds are untouched', async () => {
  const { db, invitations } = setup({
    draftRoundOpen: true,
    invitations: [round1],
    planItems: [
      { id: 'old', workspaceId: WS, caseId: 'c1', invitationId: 'inv-r1' },
      { id: 'new', workspaceId: WS, caseId: 'c1', invitationId: null },
    ],
  });
  const res = await invitations.create(identity, 'c1', sendDto);
  assert.equal(res.round, 2);
  assert.equal(db.planItem.rows.find((p) => p.id === 'new').invitationId, res.id);
  assert.equal(db.planItem.rows.find((p) => p.id === 'old').invitationId, 'inv-r1');
  assert.equal(db.case.rows[0].draftRoundOpen, false, 'the draft round is consumed');
  assert.equal(db.case.rows[0].status, 'invited', 'AC-7: the case re-enters the flow for round 2');
});

test('AC-3: no second send without a new draft round, and an opened round must have questions', async () => {
  const noDraft = setup({ invitations: [round1] });
  await assert.rejects(noDraft.invitations.create(identity, 'c1', sendDto), (e) => code(e) === 'NO_DRAFT_ROUND');
  const empty = setup({ draftRoundOpen: true, invitations: [round1] });
  await assert.rejects(empty.invitations.create(identity, 'c1', sendDto), (e) => code(e) === 'DRAFT_ROUND_EMPTY');
});

test('AC-3: opening a supplemental round is idempotent -- there is never more than one draft', async () => {
  const { lifecycle, db } = setup({ invitations: [round1] });
  const first = await lifecycle.openDraftRound(identity, 'c1');
  const second = await lifecycle.openDraftRound(identity, 'c1');
  assert.deepEqual(first.draftRound, { round: 2, items: 0 });
  assert.deepEqual(second.draftRound, { round: 2, items: 0 });
  assert.equal(db.case.rows[0].draftRoundOpen, true);
  const ended = setup({ status: 'handed_off', invitations: [round1] });
  await assert.rejects(ended.lifecycle.openDraftRound(identity, 'c1'), (e) => code(e) === 'CASE_ENDED');
});

test('a supplemental round can only follow a finalized round', async () => {
  const inProgress = { ...round1, submission: { id: 's1', answers: [] } };
  const { lifecycle } = setup({ status: 'review_pending', invitations: [inProgress] });
  assert.equal((await lifecycle.roundState(identity, 'c1')).canOpenRound, false);
  await assert.rejects(lifecycle.openDraftRound(identity, 'c1'), (e) => code(e) === 'ROUND_IN_PROGRESS');
  const notSubmitted = setup({ status: 'invited', invitations: [{ ...round1, submission: null }] });
  await assert.rejects(notSubmitted.lifecycle.openDraftRound(identity, 'c1'), (e) => code(e) === 'ROUND_IN_PROGRESS');
});

test('AC-1: a sent question cannot be edited or deleted; draft questions can', async () => {
  const { planItems, db } = setup({
    invitations: [round1],
    planItems: [
      { id: 'sent', workspaceId: WS, caseId: 'c1', invitationId: 'inv-r1' },
      { id: 'draft', workspaceId: WS, caseId: 'c1', invitationId: null },
    ],
  });
  await assert.rejects(planItems.update(identity, 'c1', 'sent', { customPrompt: 'x' }), (e) => code(e) === 'PLAN_ITEM_LOCKED');
  await assert.rejects(planItems.remove(identity, 'c1', 'sent'), (e) => code(e) === 'PLAN_ITEM_LOCKED');
  await planItems.remove(identity, 'c1', 'draft');
  assert.deepEqual(db.planItem.rows.map((p) => p.id), ['sent']);
});

test('AC-5: finalizing an older round touches only that round and never moves the case status back', async () => {
  const round2 = { id: 'inv-r2', workspaceId: WS, caseId: 'c1', round: 2, status: 'submitted', createdAt: new Date('2026-10-05'), submission: { id: 's2', answers: [] } };
  const round1Open = { ...round1, submission: { id: 's1', answers: [] } };
  const { invitations, db } = setup({ status: 'review_pending', invitations: [round1Open, round2] });
  const dto = { overall: 62, criteria: [{ name: 'A', max: 100, ai: 60, human: 62 }] };

  await invitations.finalizeEvaluation(identity, 'c1', { ...dto, invitationId: 'inv-r1' });
  assert.ok(round1Open.submission.finalizedAt);
  assert.equal(round2.submission.finalizedAt, undefined, 'round 2 untouched');
  assert.equal(db.case.rows[0].status, 'review_pending', 'an older round does not drag the case status');

  await invitations.finalizeEvaluation(identity, 'c1', { ...dto, overall: 78, invitationId: 'inv-r2' });
  assert.equal(round2.submission.finalEvaluation.overall, 78);
  assert.equal(round1Open.submission.finalEvaluation.overall, 62);
  assert.equal(db.case.rows[0].status, 'finalized', 'the latest round moves the case');
  await assert.rejects(invitations.finalizeEvaluation(identity, 'c1', { ...dto, invitationId: 'inv-r2' }), (e) => code(e) === 'ALREADY_FINALIZED');
});
