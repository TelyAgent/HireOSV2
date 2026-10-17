require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { Test } = require('@nestjs/testing');
const { TasksService } = require('../dist/intake/tasks.service');
const { IntakeController } = require('../dist/intake/intake.controller');
const { WorkspaceGuard } = require('../dist/intake/workspace.guard');

test('#317 persisted package versions, concurrent reads, history isolation and versioned PDF', async () => {
  const schema = `packages_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let app;
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(name => /^\d/.test(name)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const job = await db.job.create({ data: { workspaceId: 'ws', createdBy: 'owner', title: 'Engineer', jdText: 'Design' } });
    const candidate = await db.candidate.create({ data: { workspaceId: 'ws', name: 'Test candidate' } });
    const task = await db.interviewTask.create({ data: { workspaceId: 'ws', createdBy: 'owner', jobId: job.id, candidateId: candidate.id, version: 42, decision: 'hold', decisionAt: new Date('2026-10-01'), hrConfirmedAt: new Date('2026-10-02'), hmConfirmedAt: new Date('2026-10-03') } });
    const rubric = await db.rubricVersion.create({ data: { workspaceId: 'ws', jobId: job.id, versionNumber: 3, status: 'confirmed' } });
    const card = await db.capabilityCard.create({ data: { workspaceId: 'ws', rubricVersionId: rubric.id, requirement: 'Original requirement', responsibilityType: 'lead', cardPriority: 'P0', competencyTags: '', expectedEvidence: 'Example', levelAnchors: {}, weight: 100, sourceRefs: [] } });
    const service = new TasksService(db);
    const dependencies = Reflect.getMetadata('design:paramtypes', IntakeController);
    const module = await Test.createTestingModule({ controllers: [IntakeController], providers: dependencies.map(provide => ({ provide, useValue: provide === TasksService ? service : {} })) })
      .overrideGuard(WorkspaceGuard).useValue({ canActivate(context) { context.switchToHttp().getRequest().identity = { workspaceId: context.switchToHttp().getRequest().headers['test-workspace'] || 'ws', actorId: 'owner' }; return true; } }).compile();
    app = module.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const base = `http://127.0.0.1:${app.getHttpServer().address().port}/tasks/${task.id}/package`;
    const firstReads = await Promise.all(Array.from({ length: 4 }, () => service.package('ws', task.id)));
    assert.deepEqual(firstReads.map(v => v.packageVersion), [1, 1, 1, 1]);
    assert.equal(await db.evaluationPackageVersion.count(), 1);
    const first = await (await fetch(base)).json();
    assert.equal(first.packageVersion, 1);
    assert.equal(first.rubricVersion, 3);
    assert.equal(first.published, true);
    const frozen = await db.evaluationPackageVersion.findFirst();
    await db.capabilityCard.update({ where: { id: card.id }, data: { requirement: 'Revised requirement' } });
    await db.interviewTask.update({ where: { id: task.id }, data: { decision: 'recommend_offer' } });
    const second = await (await fetch(base)).json();
    assert.equal(second.packageVersion, 2);
    assert.equal(second.evidence[0].requirement, 'Revised requirement');
    const historical = await (await fetch(`${base}/versions/1`)).json();
    assert.equal(historical.historical, true);
    assert.equal(historical.decision, 'hold');
    assert.equal(historical.evidence[0].requirement, 'Original requirement');
    assert.equal(historical.generatedAt, first.generatedAt);
    assert.deepEqual(await db.evaluationPackageVersion.findUnique({ where: { id: frozen.id } }), frozen);
    assert.deepEqual((await (await fetch(`${base}/versions`)).json()).map(v => v.version), [2, 1]);
    assert.equal((await fetch(`${base}/versions/1`, { headers: { 'test-workspace': 'other' } })).status, 404);
    assert.equal((await fetch(`${base}/versions/999`)).status, 404);
    assert.equal((await fetch(`${base}/versions/0`)).status, 400);
    assert.equal((await fetch(`${base}/versions/1`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
    const pdf = Buffer.from(await (await fetch(`${base}.pdf?version=1`)).arrayBuffer()).toString('latin1');
    const hex = text => Buffer.from(text, 'utf16le').swap16().toString('hex');
    assert.ok(pdf.includes(hex('Original requirement')));
    assert.ok(!pdf.includes(hex('Revised requirement')));
    // Operational delivery timestamps and generic task versions do not create revisions.
    await db.interviewTask.update({ where: { id: task.id }, data: { version: 99, offerState: 'pending', offerSentAt: new Date(), packageNeedsReview: true } });
    assert.equal((await service.package('ws', task.id)).packageVersion, 2);
    assert.equal((await service.package('ws', task.id)).needsReview, true);
    assert.equal(await db.evaluationPackageVersion.count(), 2);
    await db.interviewTask.update({ where: { id: task.id }, data: { offerState: 'none', packageNeedsReview: false } });
    const sent = await service.sendOffer({ workspaceId: 'ws', actorId: 'owner' }, task.id);
    assert.equal(sent.offerPackageVersion, 2);
    assert.equal(sent.packageVersion, 2);
    assert.equal(await db.evaluationPackageVersion.count(), 2);
  } finally {
    if (app) await app.close();
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
