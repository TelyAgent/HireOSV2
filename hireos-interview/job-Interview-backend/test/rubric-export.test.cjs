const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir, writeFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { RubricExportService } = require('../dist/rubric/rubric-export.service');
try { process.loadEnvFile('.env'); } catch { /* CI supplies DATABASE_URL. */ }

test('#253 frozen draft/confirmed PDF, replay, stale request, failure audit and workspace isolation', async () => {
  const schema = `export_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const identity = { workspaceId: 'export-test', actorId: 'reviewer' };
    const job = await db.job.create({ data: { workspaceId: identity.workspaceId, createdBy: 'reviewer', title: '平台工程师 / Platform Engineer', jdText: '' } });
    const rubric = await db.rubricVersion.create({ data: { workspaceId: identity.workspaceId, jobId: job.id, versionNumber: 1 } });
    for (let i = 0; i < 10; i++) await db.capabilityCard.create({ data: { workspaceId: identity.workspaceId, rubricVersionId: rubric.id,
      requirement: `能力 ${i + 1}: 设计可靠的分布式系统 / Design reliable distributed systems`, weight: 10, requiredLevel: 3,
      responsibilityType: 'lead', cardPriority: 'P0', competencyTags: 'architecture', expectedEvidence: '项目实例与取舍说明 / Project evidence and trade-offs',
      levelAnchors: { l1: '了解基本概念', l2: '参与实现', l3: '独立设计 / Independent design', l4: '指导团队', l5: '定义组织标准' }, sourceRefs: [] } });
    const firstCard = await db.capabilityCard.findFirst({ where: { rubricVersionId: rubric.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    const source = await db.parseJob.create({ data: { workspaceId: identity.workspaceId, jobId: job.id, type: 'capability_cards', inputVersion: 1,
      input: { sourceId: 'jd:1', segments: [{ id: 'segment-1', text: 'Design reliable systems / 设计可靠系统' }] },
      result: { cards: [{ requirement: firstCard.requirement, responsibilityType: 'lead', cardPriority: 'P0', competencyTags: ['architecture'], expectedEvidence: firstCard.expectedEvidence,
        levelAnchors: firstCard.levelAnchors, weight: 10, segmentId: 'segment-1', quote: 'Design reliable systems' }], warnings: [] } } });
    await db.rubricVersion.update({ where: { id: rubric.id }, data: { sourceParseJobId: source.id } });
    await db.capabilityCard.update({ where: { id: firstCard.id }, data: { sourceRefs: [{ segmentId: 'segment-1', quote: 'Design reliable systems' }] } });
    const svc = new RubricExportService(db);
    const input = { requestId: randomUUID(), rubricId: rubric.id, revision: 1 };
    const results = await Promise.all([svc.create(identity, job.id, input), svc.create(identity, job.id, input)]);
    assert.equal(results[0].id, results[1].id);
    assert.equal(await db.rubricExport.count(), 1);
    const id = results[0].id;
    const first = await svc.download(identity.workspaceId, job.id, id);
    assert.equal(first.subarray(0, 8).toString(), '%PDF-1.4');
    assert.match(first.toString('latin1'), /\/Count [3-9]/);
    const record = await db.rubricExport.findUnique({ where: { id } });
    assert.equal(record.snapshot.status, 'draft'); assert.equal(record.snapshot.cards[0].source.status, 'verified');
    assert.equal(record.snapshot.cards[1].source.status, 'not_recorded');
    assert.equal(record.snapshot.cards[0].source.refs[0].quote, 'Design reliable systems');
    await db.rubricVersion.update({ where: { id: rubric.id }, data: { status: 'confirmed', confirmedBy: 'human-confirmed', confirmedAt: new Date('2026-10-17T00:00:00Z'), version: 2 } });
    await db.capabilityCard.updateMany({ where: { rubricVersionId: rubric.id }, data: { requirement: 'Changed later' } });
    assert.deepEqual(await svc.download(identity.workspaceId, job.id, id), first);
    await assert.rejects(svc.create(identity, job.id, { ...input, requestId: randomUUID() }), e => e.getStatus() === 409);
    const confirmed = await svc.create(identity, job.id, { ...input, requestId: randomUUID(), revision: 2 });
    assert.equal(confirmed.rubricStatus, 'confirmed');
    const confirmedRecord = await db.rubricExport.findUnique({ where: { id: confirmed.id } });
    assert.equal(confirmedRecord.snapshot.confirmedBy, 'human-confirmed');
    const broken = new RubricExportService(db); broken.render = () => { throw new Error('synthetic renderer failure'); };
    const failed = await broken.create(identity, job.id, { ...input, requestId: randomUUID(), revision: 2 });
    assert.equal(failed.status, 'failed'); assert.equal(failed.errorCode, 'PDF_GENERATION_FAILED');
    await assert.rejects(svc.download(identity.workspaceId, job.id, failed.id), e => e.getStatus() === 409);
    await assert.rejects(svc.download('foreign', job.id, id), e => e.getStatus() === 404);
    await assert.rejects(svc.list('foreign', job.id), e => e.getStatus() === 404);
    await assert.rejects(svc.create({ ...identity, workspaceId: 'foreign' }, job.id, { ...input, requestId: randomUUID() }), e => e.getStatus() === 404);
    await assert.rejects(svc.create(identity, job.id, { ...input, revision: 2 }), e => e.getStatus() === 409);
    const history = await svc.list(identity.workspaceId, job.id);
    assert.equal(history.length, 3); assert.ok(history.every(r => !('snapshot' in r) && !('pdf' in r)));
    const pendingInput = { ...input, requestId: randomUUID(), revision: 2 };
    const failingPersistence = new RubricExportService(new Proxy(db, { get(target, prop) {
      if (prop === 'rubricExport') return { ...target.rubricExport, update: async () => { throw new Error('injected persistence failure'); } };
      const value = target[prop]; return typeof value === 'function' ? value.bind(target) : value;
    } }));
    await assert.rejects(failingPersistence.create(identity, job.id, pendingInput), /injected persistence failure/);
    const pending = await svc.create(identity, job.id, pendingInput);
    assert.equal(pending.status, 'pending');
    await assert.rejects(svc.download(identity.workspaceId, job.id, pending.id), e => e.getStatus() === 409);
    if (process.env.RUBRIC_PDF_EVIDENCE) await writeFile(process.env.RUBRIC_PDF_EVIDENCE, first);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
