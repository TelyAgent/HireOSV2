const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
try { process.loadEnvFile('.env'); } catch {}

test('#424 persistent screening batches', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async t => {
  const schema = `batches_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { ScreeningService } = require('../dist/screening/screening.service');
  const { ScreeningBatchesService } = require('../dist/screening/screening-batches.service');
  const { ServiceUnavailableException } = require('@nestjs/common');
  const db = new PrismaService();
  const other = new PrismaService();
  const ai = { isConfigured: () => false };
  const screening = new ScreeningService(db, ai);
  const A = new ScreeningBatchesService(db, screening);
  const B = new ScreeningBatchesService(other, new ScreeningService(other, ai));
  const who = { workspaceId: 'batch-tests', actorId: 'author', roles: [] };
  const code = expected => error => error.getResponse?.().code === expected;
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    }
    async function seed(count = 3, identity = who) {
      const job = await db.job.create({ data: { workspaceId: identity.workspaceId, title: 'Frozen Engineer', team: 'Test', location: 'Remote', employmentType: 'Full-time', seniority: 'Mid', status: 'open', criteriaStatus: 'confirmed', assessmentRequired: false } });
      await db.jobCriteriaVersion.create({ data: { workspaceId: identity.workspaceId, jobId: job.id, version: 1, status: 'confirmed', requirements: [], dimensions: [{ id: 'skills', name: 'Skills', weight: 100, rubric: 'Evidence' }] } });
      const apps = [];
      for (let n = 0; n < count; n++) {
        const candidate = await db.candidate.create({ data: { workspaceId: identity.workspaceId, displayName: `Synthetic ${n}`, ownerId: identity.actorId } });
        const fields = Object.fromEntries(['sourceEntries', 'resumeVersionRefs', 'employmentHistory', 'skills', 'education', 'certifications', 'projects', 'location', 'workAuthorization', 'languages', 'missingFields', 'corrections'].map(k => [k, []]));
        await db.candidateProfile.create({ data: { ...fields, workspaceId: identity.workspaceId, candidateId: candidate.id, version: 1, parseStatus: 'succeeded', displayName: candidate.displayName } });
        apps.push(await db.application.create({ data: { workspaceId: identity.workspaceId, candidateId: candidate.id, jobId: job.id, linkedBy: identity.actorId, linkReason: 'test' } }));
      }
      return { job, apps, request: { idempotencyKey: randomUUID(), applicationIds: apps.map(a => a.id) } };
    }
    await t.test('concurrent start is idempotent, input fixed and results are atomically committed', async () => {
      const { job, apps, request } = await seed(3);
      const starts = await Promise.all([A.start(who, job.id, request), B.start(who, job.id, request)]);
      assert.equal(starts[0].id, starts[1].id);
      assert.equal(await db.screeningBatch.count(), 1);
      assert.equal(await db.screeningBatchItem.count(), 3);
      await assert.rejects(A.start(who, job.id, { ...request, applicationIds: [apps[0].id] }), code('BATCH_IDEMPOTENCY_CONFLICT'));
      const batch = starts[0];
      assert.equal('snapshot' in batch.items[0], false);
      await db.job.update({ where: { id: job.id }, data: { title: 'Changed after snapshot' } });
      const claims = await Promise.all([A.claim(who.workspaceId), B.claim(who.workspaceId), A.claim(who.workspaceId), B.claim(who.workspaceId)]);
      assert.equal(claims.filter(Boolean).length, 2);
      const actual = claims.filter(Boolean);
      assert.ok(actual.every(item => item.snapshot.input.job.title === 'Frozen Engineer'));
      await A.cancel(who, batch.id);
      await B.cancel(who, batch.id);
      assert.deepEqual((await A.get(who, batch.id)).counts, { queued: 0, running: 2, completed: 0, failed: 0, cancelled: 1, unknown: 0 });
      await Promise.all(actual.map(item => A.execute(item)));
      const finished = await A.get(who, batch.id);
      assert.equal(finished.counts.completed, 2);
      assert.equal(finished.counts.cancelled, 1);
      for (const item of finished.items.filter(i => i.status === 'completed')) {
        const evaluation = await db.screeningEvaluation.findUniqueOrThrow({ where: { id: item.evaluationId } });
        assert.equal(evaluation.inputManifest.batchItemId, item.id);
        assert.equal(evaluation.freshness, 'stale', 'old baseline must not become current');
      }
      assert.equal(await db.application.count({ where: { jobId: job.id } }), 3);
    });
    await t.test('known failure can retry once; successful work is untouched', async () => {
      const { job, request } = await seed(2);
      const batch = await A.start(who, job.id, request);
      const first = await A.claim(who.workspaceId);
      const second = await B.claim(who.workspaceId);
      const failing = new ScreeningBatchesService(db, { runBatchInput: async () => { throw new ServiceUnavailableException({ code: 'AI_EVALUATION_FAILED', message: 'AI_HTTP_503: private response' }); } });
      await failing.execute(first);
      await A.execute(second);
      assert.equal((await A.get(who, batch.id)).counts.failed, 1);
      const before = await db.screeningEvaluation.count();
      const retry = { idempotencyKey: randomUUID() };
      await Promise.all([A.retry(who, batch.id, first.id, retry), B.retry(who, batch.id, first.id, retry)]);
      const retried = await A.claim(who.workspaceId);
      assert.equal(retried.id, first.id);
      assert.equal(retried.attempt, 2);
      await A.execute(retried);
      assert.equal((await A.get(who, batch.id)).counts.completed, 2);
      assert.equal(await db.screeningEvaluation.count(), before + 1);
      await A.retry(who, batch.id, first.id, retry);
      assert.equal(await A.claim(who.workspaceId), null);
      await assert.rejects(A.retry(who, batch.id, second.id, { idempotencyKey: randomUUID() }), code('BATCH_ITEM_NOT_RETRYABLE'));
    });
    await t.test('crash/timeout remain unknown, retain capacity, reconcile never repeats evaluation', async () => {
      const local = { ...who, workspaceId: 'unknown-workspace' };
      const { job, request } = await seed(3, local);
      const batch = await A.start(local, job.id, request);
      const first = await A.claim(local.workspaceId);
      const second = await B.claim(local.workspaceId);
      await db.screeningBatchItem.update({ where: { id: first.id }, data: { leaseUntil: new Date(0) } });
      const timeout = new ScreeningBatchesService(db, { runBatchInput: async () => { throw new ServiceUnavailableException({ code: 'AI_EVALUATION_FAILED', message: 'AI_TIMEOUT' }); } });
      await timeout.execute(second);
      const current = await A.reconcile(local, batch.id);
      assert.equal(current.counts.unknown, 2);
      assert.equal(current.counts.queued, 1);
      assert.equal(await B.claim(local.workspaceId), null);
      await assert.rejects(A.retry(local, batch.id, first.id, { idempotencyKey: randomUUID() }), code('BATCH_ITEM_NOT_RETRYABLE'));
      const before = await db.screeningEvaluation.count();
      await A.reconcile(local, batch.id);
      assert.equal(await db.screeningEvaluation.count(), before);
      // A late live worker may still commit its one result after its lease became unknown.
      await A.execute(first);
      assert.equal((await A.get(local, batch.id)).counts.completed, 1);
      const next = await B.claim(local.workspaceId);
      assert.ok(next);
      await B.execute(next);
      assert.equal((await A.get(local, batch.id)).counts.completed, 2);
    });
    await t.test('frozen resume reaches evaluator unchanged; persistence failure does not leave a result', async () => {
      const local = { ...who, workspaceId: 'ai-snapshot-workspace' };
      const { job, apps, request } = await seed(1, local);
      const material = await db.material.create({ data: { workspaceId: local.workspaceId, name: 'synthetic.txt', mime: 'text/plain', size: 30, hash: randomUUID(), text: 'Original resume skills', segments: [], readStatus: 'readable' } });
      await db.resumeVersion.create({ data: { workspaceId: local.workspaceId, candidateId: apps[0].candidateId, materialId: material.id, version: 1, parseStatus: 'succeeded' } });
      const calls = [];
      const fakeAi = { isConfigured: () => true, modelName: () => 'synthetic-model', evaluate: async input => { calls.push(input); return { coverage: 1, confidence: 0.8, dimensionScores: [{ dimensionId: 'skills', evaluated: true, score: 80, reason: 'Synthetic', evidenceQuote: null }], hardRequirementFindings: [] }; } };
      const real = new ScreeningService(db, fakeAi);
      const batches = new ScreeningBatchesService(db, real);
      const batch = await batches.start(local, job.id, request);
      await db.material.update({ where: { id: material.id }, data: { text: 'Changed resume text' } });
      const item = await batches.claim(local.workspaceId);
      await batches.execute(item);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].resumeText, 'Original resume skills');
      assert.equal((await batches.get(local, batch.id)).counts.completed, 1);
      assert.equal((await db.screeningEvaluation.findFirst({ where: { applicationId: apps[0].id } })).freshness, 'stale');
      const next = await batches.start(local, job.id, { ...request, idempotencyKey: randomUUID() });
      const failingDb = new Proxy(db, { get(target, key) {
        if (key !== '$transaction') return target[key];
        return fn => db.$transaction(tx => fn(new Proxy(tx, { get(inner, name) {
          return name === 'auditRecord' ? { ...inner.auditRecord, create: async () => { throw new Error('injected commit failure'); } } : inner[name];
        } })));
      } });
      const failing = new ScreeningBatchesService(db, new ScreeningService(failingDb, fakeAi));
      const claim = await batches.claim(local.workspaceId);
      await failing.execute(claim);
      assert.equal((await batches.get(local, next.id)).counts.unknown, 1);
      assert.equal(await db.screeningEvaluation.count({ where: { applicationId: apps[0].id } }), 1);
      await batches.reconcile(local, next.id);
      assert.equal(calls.length, 2, 'reconcile must not call AI again');
    });
    await t.test('HTTP start/reload/cancel uses durable records and invalid bodies are rejected', async () => {
      const { Test } = require('@nestjs/testing');
      const { ScreeningBatchesController } = require('../dist/screening/screening-batches.controller');
      const { WorkspaceGuard } = require('../dist/auth/workspace.guard');
      const module = await Test.createTestingModule({ controllers: [ScreeningBatchesController], providers: [{ provide: ScreeningBatchesService, useValue: A }] })
        .overrideGuard(WorkspaceGuard).useValue({ canActivate: ctx => { ctx.switchToHttp().getRequest().identity = who; return true; } }).compile();
      const http = module.createNestApplication({ logger: false });
      await http.listen(0, '127.0.0.1');
      try {
        const base = `http://127.0.0.1:${http.getHttpServer().address().port}`;
        const { job, request } = await seed(1);
        const post = (route, data) => fetch(base + route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        assert.equal((await post(`/jobs/${job.id}/screening-batches`, {})).status, 400);
        const started = await post(`/jobs/${job.id}/screening-batches`, request);
        assert.equal(started.status, 201);
        const batch = await started.json();
        assert.equal(batch.counts.queued, 1);
        const reread = await (await fetch(`${base}/screening-batches/${batch.id}`)).json();
        assert.equal(reread.id, batch.id);
        assert.equal('snapshot' in reread.items[0], false);
        const cancelled = await (await post(`/screening-batches/${batch.id}/cancel`, {})).json();
        assert.equal(cancelled.counts.cancelled, 1);
      } finally { await http.close(); }
    });
    await t.test('workspace isolation and malformed/member validation are write-free', async () => {
      const { job, request } = await seed(1);
      await assert.rejects(A.start(who, job.id, {}), code('INVALID_BATCH_REQUEST'));
      await assert.rejects(A.start(who, job.id, { ...request, applicationIds: ['missing'] }), code('BATCH_MEMBER_NOT_IN_JOB'));
      const batch = await A.start(who, job.id, request);
      const foreign = { ...who, workspaceId: 'foreign' };
      await assert.rejects(A.get(foreign, batch.id), code('BATCH_NOT_FOUND'));
      await assert.rejects(A.cancel(foreign, batch.id), code('BATCH_NOT_FOUND'));
      await assert.rejects(A.retry(foreign, batch.id, batch.items[0].id, { idempotencyKey: 'x' }), code('BATCH_ITEM_NOT_FOUND'));
      await assert.rejects(A.list(foreign, job.id), code('JOB_NOT_FOUND'));
      await A.cancel(who, batch.id);
    });
  } finally {
    await other.$disconnect();
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
