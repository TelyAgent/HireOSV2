// #121 #129 #136 -- what a candidate's submission must be, when it is due, and that answering them never waits for
// the automatic scoring.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertAnswersMatchQuestions, effectiveDeadline, assertBeforeDeadline } = require('../dist/invitations/rounds');
const { InvitationsService } = require('../dist/invitations/invitations.service');

const questions = [{ questionId: 'q1' }, { questionId: 'q2' }];
const invalid = (fields) => (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA' && fields.every((f) => e.response.fieldPaths.includes(f));

test('#136 AC-1/AC-2: unknown, repeated, missing or blank answers are refused; the asked questions answered once pass', () => {
  assert.throws(() => assertAnswersMatchQuestions(questions, [{ questionId: 'q1', answerText: 'a' }, { questionId: 'qX', answerText: 'b' }]), invalid(['answers.1.questionId', 'answers']));
  assert.throws(() => assertAnswersMatchQuestions(questions, [{ questionId: 'q1', answerText: 'a' }, { questionId: 'q1', answerText: 'b' }]), invalid(['answers.1.questionId', 'answers']));
  assert.throws(() => assertAnswersMatchQuestions(questions, [{ questionId: 'q1', answerText: 'a' }]), invalid(['answers']));
  assert.throws(() => assertAnswersMatchQuestions(questions, [{ questionId: 'q1', answerText: 'a' }, { questionId: 'q2', answerText: '   ' }]), invalid(['answers.1.answerText']));
  assert.doesNotThrow(() => assertAnswersMatchQuestions(questions, [{ questionId: 'q2', answerText: 'b' }, { questionId: 'q1', answerText: 'a' }]), 'any order');
});

test('#129 AC-1/AC-2: timed mode is due at the opening time plus its duration, or the deadline if sooner', () => {
  const opened = new Date('2026-10-16T10:00:00Z');
  const deadline = new Date('2026-10-20T10:00:00Z');
  const timed = { mode: 'timed', durationMin: 60, deadline, openedAt: opened };
  assert.equal(effectiveDeadline(timed).toISOString(), '2026-10-16T11:00:00.000Z');
  assert.doesNotThrow(() => assertBeforeDeadline(effectiveDeadline(timed), new Date('2026-10-16T10:59:00Z')), 'within the duration');
  assert.throws(() => assertBeforeDeadline(effectiveDeadline(timed), new Date('2026-10-16T11:05:00Z')), (e) => e.response.code === 'DEADLINE_PASSED', 'past the duration, before the deadline');
  // The deadline still applies when it comes first.
  assert.equal(effectiveDeadline({ ...timed, openedAt: new Date('2026-10-20T09:30:00Z') }).toISOString(), deadline.toISOString());
  // Not opened yet, or deadline-only: just the deadline (AC-3).
  assert.equal(effectiveDeadline({ ...timed, openedAt: null }).toISOString(), deadline.toISOString());
  assert.equal(effectiveDeadline({ mode: 'deadline_only', durationMin: null, deadline, openedAt: opened }).toISOString(), deadline.toISOString());
});

test('#129 AC-2: the clock starts on the first open only — opening again does not restart it', async () => {
  const opened = new Date(Date.now() - 50 * 60_000);
  const invitation = { id: 'i-1', caseId: 'c-1', round: 1, token: 't', status: 'opened', openedAt: opened, mode: 'timed', durationMin: 60, deadline: new Date(Date.now() + 86_400_000),
    questions: [], workspaceId: 'ws', submission: null, case: { candidate: { name: 'A' }, job: { title: 'J' } } };
  const writes = [];
  const db = { invitation: { findUnique: async () => invitation, updateMany: async (q) => { writes.push(q); return { count: 0 }; } } };
  const service = new InvitationsService(db, { senderAccount: async () => null }, { get: (_k, d) => d }, {}, {});
  const view = await service.getPublic('t');
  assert.deepEqual(writes, [], 'an opened invitation is not opened again');
  assert.equal(view.openedAt, opened.toISOString());
  assert.equal(view.dueAt, new Date(opened.getTime() + 60 * 60_000).toISOString(), 'the page shows the same due time the API enforces');
});

test('#121 AC-1: the submission is confirmed without waiting for a slow automatic scoring, which then runs on its own', async () => {
  let release;
  const slow = new Promise((r) => { release = r; });
  const evaluator = { evaluate: async () => { await slow; return { overall: 80, criteria: [], summary: 's' }; } };
  const submission = { id: 's-1', invitationId: 'i-1', answers: [{ questionId: 'q1', answerText: 'a' }], finalizedAt: null, evaluationStatus: 'pending', evaluationAttempts: 0 };
  const invitation = { id: 'i-1', caseId: 'c-1', round: 1, token: 't', mode: 'deadline_only', durationMin: null, deadline: null, openedAt: null, questions: [{ questionId: 'q1' }], submission: null };
  const tx = {
    $queryRaw: async () => [{ status: 'awaiting_submission' }],
    submission: { create: async () => submission },
    invitation: { update: async () => ({}), findFirst: async () => ({ round: 1 }) },
    case: { updateMany: async () => ({ count: 1 }) },
  };
  const db = {
    invitation: { findUnique: async () => invitation, findFirst: async () => ({ round: 1 }) },
    submission: {
      updateMany: async ({ where, data }) => {
        if (where.finalizedAt === null && submission.finalizedAt) return { count: 0 };
        if (where.evaluationStatus === 'running' && submission.evaluationStatus !== 'running') return { count: 0 };
        const { evaluationAttempts, ...rest } = data;
        Object.assign(submission, rest, evaluationAttempts ? { evaluationAttempts: submission.evaluationAttempts + 1 } : {});
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...submission, invitation }),
    },
    $transaction: async (fn) => fn(tx),
  };
  const lifecycle = { lockCase: async () => ({ status: 'awaiting_submission' }), advance: async () => true };
  const service = new InvitationsService(db, {}, { get: (_k, d) => d }, evaluator, lifecycle);
  const started = Date.now();
  assert.deepEqual(await service.submit('t', { answers: [{ questionId: 'q1', answerText: 'a' }] }), { status: 'submitted' });
  assert.ok(Date.now() - started < 200, 'answered at once');
  assert.equal(submission.evaluationStatus, 'running', 'scoring is under way, visibly');
  release();
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(submission.evaluationStatus, 'done');
});

test('#121 AC-2/AC-3: a failing AI is recorded as failed and retried; once a reviewer finalizes, scoring is skipped and never overwrites', async () => {
  const submission = { id: 's-1', answers: [], finalizedAt: null, evaluationStatus: 'pending', evaluationAttempts: 0, evaluation: null };
  let calls = 0;
  const evaluator = { evaluate: async () => { calls++; if (calls === 1) throw new Error('AI_TIMEOUT'); return { overall: 70, criteria: [], summary: 's' }; } };
  const db = { submission: {
    updateMany: async ({ where, data }) => {
      if (where.finalizedAt === null && submission.finalizedAt) return { count: 0 };
      if (where.evaluationAttempts && submission.evaluationAttempts >= where.evaluationAttempts.lt) return { count: 0 };
      if (where.OR && !where.OR.some((c) => (c.evaluationStatus?.in ?? [c.evaluationStatus]).includes(submission.evaluationStatus))) return { count: 0 };
      if (where.evaluationStatus === 'running' && submission.evaluationStatus !== 'running') return { count: 0 };
      const { evaluationAttempts, ...rest } = data;
      Object.assign(submission, rest, evaluationAttempts ? { evaluationAttempts: submission.evaluationAttempts + 1 } : {});
      return { count: 1 };
    },
    findUniqueOrThrow: async () => ({ ...submission, invitation: { questions: [] } }),
  } };
  const service = new InvitationsService(db, {}, { get: (_k, d) => d }, evaluator, {});
  await service.evaluate('s-1');
  assert.deepEqual([submission.evaluationStatus, submission.evaluationError], ['failed', 'AI_TIMEOUT']);
  await service.evaluate('s-1');
  assert.deepEqual([submission.evaluationStatus, submission.evaluation.overall, submission.evaluationAttempts], ['done', 70, 2]);
  // Finalized by a reviewer: a further run is not even started, and nothing is written over the review.
  Object.assign(submission, { evaluationStatus: 'failed', finalizedAt: new Date(), evaluation: null });
  await service.evaluate('s-1');
  assert.deepEqual([submission.evaluationStatus, submission.evaluation, calls], ['failed', null, 2]);
});

test('#136 AC-1: refused answers change nothing — no transaction, no submission, no scoring', async () => {
  const invitation = { id: 'i-1', caseId: 'c-1', round: 1, token: 't', mode: 'deadline_only', durationMin: null, deadline: null, openedAt: null, questions: [{ questionId: 'q1' }], submission: null };
  let touched = 0;
  const db = { invitation: { findUnique: async () => invitation }, $transaction: async () => { touched++; } };
  const service = new InvitationsService(db, {}, { get: (_k, d) => d }, { evaluate: async () => { touched++; } }, {});
  await assert.rejects(service.submit('t', { answers: [{ questionId: 'q9', answerText: 'x' }] }), (e) => e.getStatus() === 422);
  assert.equal(touched, 0);
});
