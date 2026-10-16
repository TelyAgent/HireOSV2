// #118 #119 #130 #131 #132 -- a written-test case under concurrent requests, against a real Postgres (a throwaway
// schema per run): two separate clients stand in for two requests racing. Every race is run several times.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WS = 'ws-test';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: ['hr'], kind: 'user' };
const ROUNDS = 8;

test('written case concurrency', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `written_conc_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  url.searchParams.set('connection_limit', '10');
  process.env.DATABASE_URL = url.toString();

  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { CaseLifecycleService } = require('../dist/cases/case-lifecycle.service');
  const { InvitationsService } = require('../dist/invitations/invitations.service');

  const admin = new PrismaService();
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  const dbA = new PrismaService();
  const dbB = new PrismaService();
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      // Comments go first: some of them contain ';'.
      const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').split(';').filter((s) => s.trim());
      for (const statement of statements) await dbA.$executeRawUnsafe(statement);
    }
    const config = { get: (_k, d) => d };
    const evaluated = [];
    const evaluator = { evaluate: async ({ answers }) => { evaluated.push(answers); return { overall: 70, criteria: [], summary: 'ok' }; } };
    const mail = { senderAccount: async () => null, sendFromWorkspaceAccount: async () => ({ sent: true }) };
    const make = (db) => {
      const lifecycle = new CaseLifecycleService(db, config);
      return { lifecycle, invitations: new InvitationsService(db, mail, config, evaluator, lifecycle) };
    };
    const A = make(dbA);
    const B = make(dbB);
    const candidate = await dbA.candidate.create({ data: { workspaceId: WS, coreCandidateId: 'cc-1', name: 'Ann' } });
    const job = await dbA.job.create({ data: { workspaceId: WS, coreJobId: 'cj-1', title: 'PM' } });
    const question = { questionId: 'q1', code: 'Q-1', title: 'T', prompt: 'P', competencies: [] };
    let n = 0;
    /** A fresh case in `status`, with one sent round (and optionally its submission). */
    async function caseIn(status, { submitted = false, finalized = false } = {}) {
      n++;
      const cand = await dbA.candidate.create({ data: { workspaceId: WS, coreCandidateId: `cc-${n}-${randomUUID()}`, name: `C${n}` } });
      const kase = await dbA.case.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, status } });
      await dbA.task.create({ data: { workspaceId: WS, caseId: kase.id, title: 'Written test' } });
      const invitation = await dbA.invitation.create({ data: {
        workspaceId: WS, caseId: kase.id, token: randomUUID(), questions: [question], mode: 'deadline_only', deadline: new Date(Date.now() + 86_400_000),
        disclosurePolicy: 'score_and_summary', round: 1, status: submitted ? 'submitted' : 'opened',
      } });
      if (submitted) await dbA.submission.create({ data: { invitationId: invitation.id, answers: [{ questionId: 'q1', answerText: 'a' }], ...(finalized ? { finalizedAt: new Date(), finalEvaluation: { overall: 50, criteria: [] } } : {}) } });
      return { kase, invitation };
    }
    const outcome = (p) => p.then(() => 'ok', (e) => (e.getStatus?.() === 409 ? `409:${e.response.code}` : `error:${e.message}`));

    await t.test('#119 #131 AC-1: a progress event racing a close never brings the closed case back; its task is completed', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const { kase } = await caseIn('awaiting_submission');
        await Promise.all([A.lifecycle.advance(kase.id, 'review_pending'), B.lifecycle.close(identity, kase.id, 'rejected')]);
        const after = await dbA.case.findUnique({ where: { id: kase.id }, include: { task: true } });
        assert.deepEqual([after.status, after.task.status], ['closed', 'completed']);
      }
    });

    await t.test('#130 AC-1/AC-3: a submission racing a close is either accepted before it or refused with nothing kept', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const { kase, invitation } = await caseIn('awaiting_submission');
        const before = evaluated.length;
        const [submit] = await Promise.all([
          outcome(A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'answer' }] })),
          outcome(B.lifecycle.close(identity, kase.id, 'withdrawn')),
        ]);
        const after = await dbA.case.findUnique({ where: { id: kase.id } });
        const sub = await dbA.submission.findUnique({ where: { invitationId: invitation.id } });
        const inv = await dbA.invitation.findUnique({ where: { id: invitation.id } });
        assert.equal(after.status, 'closed');
        if (submit === 'ok') assert.ok(sub, 'accepted (it took the case first) and kept');
        else {
          assert.equal(submit, '409:CASE_ENDED');
          assert.deepEqual([sub, inv.status], [null, 'opened'], 'nothing kept, invitation unchanged');
        }
        await new Promise((r) => setTimeout(r, 20));
        if (submit !== 'ok') assert.equal(evaluated.length, before, 'no scoring for refused answers');
      }
      // A close holding the case: the submission waits for it, then sees the case ended and keeps nothing.
      {
        const { kase, invitation } = await caseIn('awaiting_submission');
        let submitted;
        await dbB.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT status FROM "Case" WHERE id = ${kase.id} FOR UPDATE`;
          await tx.case.update({ where: { id: kase.id }, data: { status: 'closed', closedAt: new Date() } });
          submitted = outcome(A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'late' }] }));
          await new Promise((r) => setTimeout(r, 150));
          assert.equal(await dbA.submission.count({ where: { invitationId: invitation.id } }), 0, 'still waiting for the close');
        });
        assert.equal(await submitted, '409:CASE_ENDED');
        assert.equal(await dbA.submission.count({ where: { invitationId: invitation.id } }), 0);
      }
      // An already closed case refuses answers before its deadline too.
      const { kase, invitation } = await caseIn('closed');
      assert.equal(await outcome(A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'x' }] })), '409:CASE_ENDED');
      assert.equal(await dbA.submission.count({ where: { invitationId: invitation.id } }), 0);
      assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'closed');
    });

    await t.test('#132 AC-1/AC-2: two finalizations or two publications at once — one wins, the other is a conflict, nothing overwritten', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const { kase } = await caseIn('review_pending', { submitted: true });
        const fin = (overall) => ({ overall, criteria: [{ name: 'c', max: 10, ai: 5, human: overall / 10 }] });
        const results = await Promise.all([outcome(A.invitations.finalizeEvaluation(identity, kase.id, fin(60))), outcome(B.invitations.finalizeEvaluation(identity, kase.id, fin(90)))]);
        assert.deepEqual(results.slice().sort(), ['409:ALREADY_FINALIZED', 'ok']);
        const sub = await dbA.submission.findFirst({ where: { invitation: { caseId: kase.id } } });
        assert.equal(sub.finalEvaluation.overall, results[0] === 'ok' ? 60 : 90, 'the saved score is the winner\'s');
        assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'finalized');
        const rel = (text) => ({ overall: 60, showScore: true, outcomeText: text, feedbackText: '', nextStepText: '' });
        const published = await Promise.all([outcome(A.invitations.releaseResult(identity, kase.id, rel('A'))), outcome(B.invitations.releaseResult(identity, kase.id, rel('B')))]);
        assert.deepEqual(published.slice().sort(), ['409:ALREADY_RELEASED', 'ok']);
        const released = await dbA.submission.findFirst({ where: { invitation: { caseId: kase.id } } });
        assert.equal(released.release.outcomeText, published[0] === 'ok' ? 'A' : 'B');
        assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'released');
      }
    });

    await t.test('#131 AC-2: hold racing a submission keeps the progress for resuming', async () => {
      for (let i = 0; i < ROUNDS; i++) {
        const { kase, invitation } = await caseIn('awaiting_submission');
        await Promise.all([A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'a' }] }), B.lifecycle.hold(identity, kase.id)]);
        const held = await dbA.case.findUnique({ where: { id: kase.id } });
        assert.deepEqual([held.status, held.statusBeforeHold], ['on_hold', 'review_pending']);
        await A.lifecycle.resume(identity, kase.id);
        assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'review_pending');
      }
    });

    await t.test('#119 AC-2: opening the link after the answers came in never turns "submitted" back into "opened"', async () => {
      const { kase, invitation } = await caseIn('invited');
      await dbA.invitation.update({ where: { id: invitation.id }, data: { status: 'sent' } });
      await Promise.all([A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'a' }] }), B.invitations.getPublic(invitation.token)]);
      const inv = await dbA.invitation.findUnique({ where: { id: invitation.id } });
      assert.equal(inv.status, 'submitted');
      assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'review_pending');
    });

    await t.test('#118 AC-1: a failure at the case step keeps nothing; the retry is accepted and moves the case', async () => {
      const { kase, invitation } = await caseIn('awaiting_submission');
      const realAdvance = A.lifecycle.advance.bind(A.lifecycle);
      A.lifecycle.advance = async () => { throw new Error('injected failure'); };
      await assert.rejects(A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'a' }] }), /injected failure/);
      assert.equal(await dbA.submission.count({ where: { invitationId: invitation.id } }), 0, 'the answers rolled back with the case step');
      assert.equal((await dbA.invitation.findUnique({ where: { id: invitation.id } })).status, 'opened');
      A.lifecycle.advance = realAdvance;
      await A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'a' }] });
      assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'review_pending');
      // Same for finalize: a failed case step leaves the scoring unsaved, and the retry works.
      A.lifecycle.advance = async () => { throw new Error('injected failure'); };
      const fin = { overall: 50, criteria: [{ name: 'c', max: 10, ai: 5, human: 5 }] };
      await assert.rejects(A.invitations.finalizeEvaluation(identity, kase.id, fin), /injected failure/);
      assert.equal((await dbA.submission.findUnique({ where: { invitationId: invitation.id } })).finalizedAt, null);
      A.lifecycle.advance = realAdvance;
      await A.invitations.finalizeEvaluation(identity, kase.id, fin);
      assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'finalized');
    });

    await t.test('#118 AC-1: answers saved by an older version whose case step failed are caught up by the retry', async () => {
      const { kase, invitation } = await caseIn('awaiting_submission', { submitted: true });
      assert.equal(await outcome(A.invitations.submit(invitation.token, { answers: [{ questionId: 'q1', answerText: 'a' }] })), '409:ALREADY_SUBMITTED');
      assert.equal((await dbA.case.findUnique({ where: { id: kase.id } })).status, 'review_pending');
    });

    await t.test('#118 AC-2: closing completes the task in the same step, and a second close is a conflict', async () => {
      const { kase } = await caseIn('released', { submitted: true, finalized: true });
      const results = await Promise.all([outcome(A.lifecycle.close(identity, kase.id, 'passed')), outcome(B.lifecycle.close(identity, kase.id, 'rejected'))]);
      assert.deepEqual(results.slice().sort(), ['409:ALREADY_ENDED', 'ok']);
      const after = await dbA.case.findUnique({ where: { id: kase.id }, include: { task: true } });
      assert.deepEqual([after.status, after.task.status], ['closed', 'completed']);
    });
  } finally {
    await dbA.$disconnect();
    await dbB.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
