const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
try { process.loadEnvFile('.env'); } catch { /* CI supplies DATABASE_URL. */ }

test('#216/#215 decision conflicts and evaluation guards in isolated PostgreSQL', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `decision_guard_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { DecisionsService } = require('../dist/decisions/decisions.service');
  const db = new PrismaService();
  const service = new DecisionsService(db);
  const identity = { workspaceId: 'guard-test', actorId: 'reviewer-a', roles: [] };
  const baseRequest = { outcome: 'advance', nextStepTarget: 'move_to_interview', reason: 'Synthetic evidence reviewed', expectedDecisionId: null };
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split('\n').filter(line => !line.trim().startsWith('--')).join('\n').split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    }
    const job = await db.job.create({ data: { workspaceId: identity.workspaceId, title: 'Synthetic role', team: 'Test', location: 'Remote', employmentType: 'Full-time', seniority: 'Mid', status: 'open', criteriaStatus: 'confirmed', assessmentRequired: false } });
    async function seed(freshness = 'current', status = 'completed') {
      const candidate = await db.candidate.create({ data: { workspaceId: identity.workspaceId, displayName: 'Synthetic candidate', ownerId: identity.actorId } });
      const app = await db.application.create({ data: { workspaceId: identity.workspaceId, candidateId: candidate.id, jobId: job.id, linkedBy: identity.actorId, linkReason: 'test' } });
      await db.humanTask.create({ data: { workspaceId: identity.workspaceId, applicationId: app.id, sourceModule: 'screening', taskType: 'screening_review', title: 'Review', subjectLabel: 'Synthetic', requiredAction: 'decide', completionRule: {}, linkRoute: `/applications/${app.id}` } });
      let evaluation;
      if (freshness) {
        const session = await db.screeningSession.create({ data: { workspaceId: identity.workspaceId, applicationId: app.id, ownerId: identity.actorId } });
        evaluation = await db.screeningEvaluation.create({ data: { workspaceId: identity.workspaceId, applicationId: app.id, sessionId: session.id, version: 1, status, freshness, completedAt: new Date('2026-10-17T00:00:00Z'), inputManifest: {}, eligibilityResults: [], evaluationStatus: 'evaluated', strengths: [], missingInformation: [] } });
      }
      return { app, evaluation, request: { ...baseRequest, expectedEvaluationId: evaluation?.id ?? 'missing', expectedEvaluationVersion: 1 } };
    }
    async function counts(id) {
      return [await db.screeningDecision.count({ where: { applicationId: id } }), await db.screeningOutboxEvent.count({ where: { aggregateId: id } }), await db.humanTask.count({ where: { applicationId: id, status: 'completed' } }), await db.auditRecord.count({ where: { payload: { path: ['applicationId'], equals: id } } })];
    }
    await t.test('different sequential submissions conflict and preserve original result and side effects', async () => {
      const { app, request } = await seed();
      const first = await service.record(identity, app.id, request);
      assert.equal(first.replayed, false);
      const before = await counts(app.id);
      await assert.rejects(service.record({ ...identity, actorId: 'reviewer-b' }, app.id, { ...request, outcome: 'hold', nextStepTarget: 'record_only', reason: 'Different conclusion' }), e => e.getStatus() === 409 && e.getResponse().code === 'DECISION_CONFLICT' && e.getResponse().decision.id === first.decision.id);
      assert.deepEqual(await counts(app.id), before);
      await db.humanTask.updateMany({ where: { applicationId: app.id }, data: { status: 'open', completedAt: null, completionRef: null } });
      await service.record(identity, app.id, request);
      assert.equal(await db.humanTask.count({ where: { applicationId: app.id, status: 'completed' } }), 0, 'replay must not complete newly reopened tasks');
      const replay = await service.record(identity, app.id, request);
      assert.equal(replay.replayed, true);
      assert.equal(replay.decision.id, first.decision.id);
      assert.deepEqual(await counts(app.id), [1, 1, 0, 1]);
    });
    await t.test('concurrent requests create exactly one decision, outbox, task completion and audit', async () => {
      for (let i = 0; i < 5; i++) {
        const { app, request } = await seed();
        const results = await Promise.allSettled([service.record(identity, app.id, request), service.record({ ...identity, actorId: 'reviewer-b' }, app.id, { ...request, reason: 'Second reviewer' })]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        const rejected = results.find(r => r.status === 'rejected');
        assert.equal(rejected.reason.getResponse().code, 'DECISION_CONFLICT');
        assert.deepEqual(await counts(app.id), [1, 1, 1, 1]);
      }
    });
    await t.test('missing, stale and unfinished evaluations block all outcomes and targets without writes', async () => {
      for (const [freshness, status] of [[null, 'completed'], ['stale', 'completed'], ['current', 'running']]) {
        const { app, request } = await seed(freshness, status);
        for (const target of ['move_to_interview', 'send_assessment', 'record_only']) {
          for (const outcome of ['strong_advance', 'advance', 'hold', 'do_not_advance', 'request_information']) {
            await assert.rejects(service.record(identity, app.id, { ...request, outcome, nextStepTarget: target }), e => e.getResponse().code === 'CURRENT_EVALUATION_REQUIRED');
            assert.deepEqual(await counts(app.id), [0, 0, 0, 0]);
          }
        }
      }
    });
    await t.test('current completed evaluation is pinned to the new decision', async () => {
      const { app, evaluation, request } = await seed();
      const result = await service.record(identity, app.id, request);
      assert.equal((await db.screeningDecision.findUnique({ where: { id: result.decision.id } })).evaluationId, evaluation.id);
      assert.equal(result.decision.evaluationId, evaluation.id);
      assert.equal(result.decision.evaluationVersion, 1);
      assert.equal(result.decision.evaluationCompletedAt, '2026-10-17T00:00:00.000Z');
      const { ScreeningService } = require('../dist/screening/screening.service');
      const detail = await new ScreeningService(db, {}).getDetail(identity, app.id);
      assert.equal(detail.decision.evaluationId, evaluation.id);
      assert.equal(detail.decision.evaluationVersion, 1);
      await assert.rejects(service.record({ ...identity, workspaceId: 'other' }, app.id, request), e => e.getStatus() === 404);
    });
    await t.test('missing or changed preconditions reject; re-review of new evaluation succeeds', async () => {
      const { app, evaluation, request } = await seed();
      for (const field of ['expectedEvaluationId', 'expectedEvaluationVersion', 'expectedDecisionId']) {
        const input = { ...request }; delete input[field];
        await assert.rejects(service.record(identity, app.id, input), e => e.getResponse().code === 'DECISION_PRECONDITION_REQUIRED');
      }
      for (const input of [{ ...request, expectedEvaluationVersion: 2 }, { ...request, expectedEvaluationId: 'another-application-evaluation' }]) {
        await assert.rejects(service.record(identity, app.id, input), e => e.getResponse().code === 'EVALUATION_VERSION_CONFLICT');
      }
      await db.screeningEvaluation.update({ where: { id: evaluation.id }, data: { freshness: 'stale' } });
      const next = await db.screeningEvaluation.create({ data: { workspaceId: identity.workspaceId, applicationId: app.id, sessionId: evaluation.sessionId, version: 2, status: 'completed', freshness: 'current', completedAt: new Date(), inputManifest: {}, eligibilityResults: [], evaluationStatus: 'evaluated', strengths: [], missingInformation: [] } });
      await assert.rejects(service.record(identity, app.id, request), e => e.getResponse().code === 'EVALUATION_VERSION_CONFLICT');
      assert.deepEqual(await counts(app.id), [0, 0, 0, 0]);
      const accepted = await service.record(identity, app.id, { ...request, outcome: 'hold', nextStepTarget: 'record_only', expectedEvaluationId: next.id, expectedEvaluationVersion: 2 });
      assert.equal(accepted.decision.evaluationVersion, 2);
      assert.deepEqual(await counts(app.id), [1, 0, 1, 1]);
    });
    await t.test('identical concurrent retries return the same decision with exactly one set of side effects', async () => {
      const { app, request } = await seed();
      const results = await Promise.all([service.record(identity, app.id, request), service.record(identity, app.id, request)]);
      assert.equal(results[0].decision.id, results[1].decision.id);
      assert.deepEqual(results.map(r => r.replayed).sort(), [false, true]);
      assert.deepEqual(await counts(app.id), [1, 1, 1, 1]);
      await assert.rejects(service.record(identity, app.id, { ...request, expectedEvaluationVersion: 2 }), e => e.getResponse().code === 'DECISION_CONFLICT');
      await assert.rejects(service.record({ ...identity, actorId: 'other' }, app.id, request), e => e.getResponse().code === 'DECISION_CONFLICT');
    });
    await t.test('withdrawal prevents a stale page from recreating the decision; refreshed page can decide', async () => {
      const { app, request } = await seed();
      const input = { ...request, outcome: 'hold', nextStepTarget: 'record_only' };
      const first = await service.record(identity, app.id, input);
      await service.withdraw(identity, app.id, first.decision.id, { reason: 'Synthetic reconsideration' });
      const before = await counts(app.id);
      await assert.rejects(service.record(identity, app.id, input), e => e.getResponse().code === 'DECISION_CONFLICT');
      assert.deepEqual(await counts(app.id), before);
      const second = await service.record(identity, app.id, { ...input, expectedDecisionId: first.decision.id });
      assert.equal(second.replayed, false);
      assert.notEqual(second.decision.id, first.decision.id);
      await assert.rejects(service.record(identity, app.id, input), e => e.getResponse().code === 'DECISION_CONFLICT');
      assert.equal((await service.record(identity, app.id, { ...input, expectedDecisionId: first.decision.id })).replayed, true);
    });
    await t.test('HTTP controller preserves guard errors, success basis and explicit replay response', async () => {
      const { Test } = require('@nestjs/testing');
      const { DecisionsController } = require('../dist/decisions/decisions.controller');
      const { WorkspaceGuard } = require('../dist/auth/workspace.guard');
      const module = await Test.createTestingModule({ controllers: [DecisionsController], providers: [{ provide: DecisionsService, useValue: service }] })
        .overrideGuard(WorkspaceGuard).useValue({ canActivate: context => { context.switchToHttp().getRequest().identity = identity; return true; } }).compile();
      const http = module.createNestApplication({ logger: false });
      await http.listen(0, '127.0.0.1');
      try {
        const send = (id, body) => fetch(`http://127.0.0.1:${http.getHttpServer().address().port}/applications/${id}/decisions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const { app, request, evaluation } = await seed();
        const missing = await send(app.id, baseRequest);
        assert.equal(missing.status, 400);
        assert.equal((await missing.json()).code, 'DECISION_PRECONDITION_REQUIRED');
        const stale = await send(app.id, { ...request, expectedEvaluationVersion: 99 });
        assert.equal(stale.status, 409);
        assert.equal((await stale.json()).code, 'EVALUATION_VERSION_CONFLICT');
        const first = await send(app.id, request);
        assert.equal(first.status, 201);
        const saved = await first.json();
        assert.equal(saved.decision.evaluationId, evaluation.id);
        assert.equal(saved.replayed, false);
        const replay = await send(app.id, request);
        assert.equal((await replay.json()).replayed, true);
        const conflict = await send(app.id, { ...request, reason: 'Different reason' });
        assert.equal(conflict.status, 409);
        assert.equal((await conflict.json()).decision.id, saved.decision.id);
        const absent = await seed(null);
        const rejected = await send(absent.app.id, { ...absent.request, outcome: 'do_not_advance', nextStepTarget: 'record_only' });
        assert.equal(rejected.status, 409);
        assert.equal((await rejected.json()).code, 'CURRENT_EVALUATION_REQUIRED');
        assert.deepEqual(await counts(absent.app.id), [0, 0, 0, 0]);
      } finally { await http.close(); }
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
