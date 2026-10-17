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
  const request = { outcome: 'advance', nextStepTarget: 'move_to_interview', reason: 'Synthetic evidence reviewed' };
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
        evaluation = await db.screeningEvaluation.create({ data: { workspaceId: identity.workspaceId, applicationId: app.id, sessionId: session.id, version: 1, status, freshness, inputManifest: {}, eligibilityResults: [], evaluationStatus: 'evaluated', strengths: [], missingInformation: [] } });
      }
      return { app, evaluation };
    }
    async function counts(id) {
      return [await db.screeningDecision.count({ where: { applicationId: id } }), await db.screeningOutboxEvent.count({ where: { aggregateId: id } }), await db.humanTask.count({ where: { applicationId: id, status: 'completed' } }), await db.auditRecord.count({ where: { payload: { path: ['applicationId'], equals: id } } })];
    }
    await t.test('different sequential submissions conflict and preserve original result and side effects', async () => {
      const { app } = await seed();
      const first = await service.record(identity, app.id, request);
      assert.equal(first.replayed, false);
      const before = await counts(app.id);
      await assert.rejects(service.record({ ...identity, actorId: 'reviewer-b' }, app.id, { ...request, outcome: 'hold', nextStepTarget: 'record_only', reason: 'Different conclusion' }), e => e.getStatus() === 409 && e.getResponse().code === 'DECISION_CONFLICT' && e.getResponse().decision.id === first.decision.id);
      assert.deepEqual(await counts(app.id), before);
      const replay = await service.record(identity, app.id, request);
      assert.equal(replay.replayed, true);
      assert.equal(replay.decision.id, first.decision.id);
      assert.deepEqual(await counts(app.id), before);
    });
    await t.test('concurrent requests create exactly one decision, outbox, task completion and audit', async () => {
      for (let i = 0; i < 5; i++) {
        const { app } = await seed();
        const results = await Promise.allSettled([service.record(identity, app.id, request), service.record({ ...identity, actorId: 'reviewer-b' }, app.id, { ...request, reason: 'Second reviewer' })]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        const rejected = results.find(r => r.status === 'rejected');
        assert.equal(rejected.reason.getResponse().code, 'DECISION_CONFLICT');
        assert.deepEqual(await counts(app.id), [1, 1, 1, 1]);
      }
    });
    await t.test('missing, stale and unfinished evaluations cannot advance to either subsystem', async () => {
      for (const [freshness, status] of [[null, 'completed'], ['stale', 'completed'], ['current', 'running']]) {
        const { app } = await seed(freshness, status);
        for (const target of ['move_to_interview', 'send_assessment']) {
          await assert.rejects(service.record(identity, app.id, { ...request, nextStepTarget: target }), e => e.getResponse().code === 'CURRENT_EVALUATION_REQUIRED');
          assert.deepEqual(await counts(app.id), [0, 0, 0, 0]);
        }
      }
    });
    await t.test('current completed evaluation is pinned to the new decision', async () => {
      const { app, evaluation } = await seed();
      const result = await service.record(identity, app.id, request);
      assert.equal((await db.screeningDecision.findUnique({ where: { id: result.decision.id } })).evaluationId, evaluation.id);
      await assert.rejects(service.record({ ...identity, workspaceId: 'other' }, app.id, request), e => e.getStatus() === 404);
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
