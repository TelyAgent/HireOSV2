const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { TasksService } = require('../dist/intake/tasks.service');
try { process.loadEnvFile('.env'); } catch { /* CI supplies DATABASE_URL. */ }

test('#246 migration, resolution, replay, concurrent actors/attachments and preserved history', async () => {
  const schema = `resolve_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const identity = { workspaceId: 'resolve', actorId: 'owner' };
    const job = await db.job.create({ data: { workspaceId: 'resolve', createdBy: 'owner', title: 'Synthetic', jdText: '' } });
    const candidate = await db.candidate.create({ data: { workspaceId: 'resolve', name: 'Synthetic' } });
    const task = await db.interviewTask.create({ data: { workspaceId: 'resolve', createdBy: 'owner', jobId: job.id, candidateId: candidate.id } });
    const frozen = await db.evaluationPackageVersion.create({ data: { workspaceId: 'resolve', taskId: task.id, version: 1, contentHash: 'frozen', content: { published: true, score: 4, source: 'original' } } });
    const rubric = await db.rubricVersion.create({ data: { workspaceId: 'resolve', jobId: job.id, versionNumber: 1 } });
    const card = await db.capabilityCard.create({ data: { workspaceId: 'resolve', rubricVersionId: rubric.id, requirement: 'Synthetic', responsibilityType: 'lead', cardPriority: 'P0', competencyTags: '', expectedEvidence: '', levelAnchors: {}, weight: 100, sourceRefs: [] } });
    const round = await db.interviewRound.create({ data: { workspaceId: 'resolve', taskId: task.id, sequence: 1, name: 'Synthetic', format: 'video', duration: 30, competencies: '', questions: 0, mandatory: 0, notes: '' } });
    const score = await db.cardScore.create({ data: { workspaceId: 'resolve', roundId: round.id, cardId: card.id, score: 4, note: 'Original human score' } });
    const reports = [];
    for (let i = 0; i < 5; i++) reports.push(await db.material.create({ data: { workspaceId: 'resolve', name: `Report ${i}`, mime: 'text/plain', size: 5, hash: `${i}`, text: `Unchanged ${i}`, segments: [], readStatus: 'available' } }));
    // Legacy links intentionally have no selection/audit.
    for (const report of reports.slice(0, 2)) await db.taskMaterial.create({ data: { taskId: task.id, materialId: report.id, kind: 'screening' } });
    const before = await db.interviewTask.findUnique({ where: { id: task.id } });
    const svc = new TasksService(db);
    let view = await svc.screeningReports('resolve', task.id);
    assert.equal(view.currentId, null); assert.equal(view.needsResolution, true); assert.equal(view.history.length, 0);
    const input = { materialId: reports[1].id, expectedRevision: 0 };
    const duplicate = await Promise.all([svc.resolveScreening(identity, task.id, input), svc.resolveScreening(identity, task.id, input)]);
    assert.equal(duplicate.filter(r => r.replayed).length, 1);
    view = await svc.screeningReports('resolve', task.id);
    assert.equal(view.currentId, reports[1].id); assert.equal(view.needsResolution, false);
    assert.equal(view.reports.find(r => r.id === reports[0].id).state, 'superseded');
    assert.equal(view.reports.find(r => r.id === reports[0].id).text, 'Unchanged 0');
    assert.equal(view.history[0].actorId, 'owner');
    const choices = await Promise.allSettled([
      svc.resolveScreening(identity, task.id, { materialId: reports[0].id, expectedRevision: 1 }),
      svc.resolveScreening({ ...identity, actorId: 'other' }, task.id, { materialId: reports[1].id, expectedRevision: 1 }),
    ]);
    assert.equal(choices.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(choices.find(r => r.status === 'rejected').reason.getStatus(), 409);
    view = await svc.screeningReports('resolve', task.id);
    const current = view.currentId;
    await svc.attach(identity, task.id, { materialId: reports[2].id, kind: 'screening' });
    await assert.rejects(svc.resolveScreening(identity, task.id, { materialId: reports[2].id, expectedRevision: view.revision }), e => e.getStatus() === 409);
    view = await svc.screeningReports('resolve', task.id);
    assert.equal(view.currentId, current); assert.equal(view.needsResolution, true);
    const revision = view.revision;
    await svc.attach(identity, task.id, { materialId: reports[2].id, kind: 'screening' });
    assert.equal((await svc.screeningReports('resolve', task.id)).revision, revision);
    await assert.rejects(svc.resolveScreening(identity, task.id, { materialId: reports[4].id, expectedRevision: revision }), e => e.getStatus() === 400);
    await assert.rejects(svc.resolveScreening({ ...identity, workspaceId: 'foreign' }, task.id, input), e => e.getStatus() === 404);
    await assert.rejects(svc.screeningReports('foreign', task.id), e => e.getStatus() === 404);
    const race = await Promise.allSettled([
      svc.attach(identity, task.id, { materialId: reports[3].id, kind: 'screening' }),
      svc.resolveScreening(identity, task.id, { materialId: reports[2].id, expectedRevision: revision }),
    ]);
    assert.equal(race[0].status, 'fulfilled');
    if (race[1].status === 'rejected') assert.equal(race[1].reason.getStatus(), 409);
    view = await svc.screeningReports('resolve', task.id);
    assert.equal(view.reports.find(r => r.id === reports[3].id).state, 'unresolved');
    // Triage joins the same membership lock without changing existing report content.
    await db.taskMaterial.create({ data: { taskId: task.id, materialId: reports[4].id, kind: 'other' } });
    assert.ok(!(await svc.screeningReports('resolve', task.id)).reports.some(r => r.id === reports[4].id));
    const oldRevision = view.revision;
    const triageInput = { materialId: reports[4].id, kind: 'screening' };
    const rollbackSvc = new TasksService({ $transaction: fn => db.$transaction(tx => fn(new Proxy(tx, { get(target, prop) {
      if (prop === 'taskMaterial') return { ...target.taskMaterial, update: async () => { throw new Error('injected audit failure'); } };
      return target[prop];
    } }))) });
    await assert.rejects(rollbackSvc.triageMaterial(identity, task.id, triageInput), /injected audit failure/);
    assert.equal((await svc.screeningReports('resolve', task.id)).revision, oldRevision);
    assert.equal((await db.taskMaterial.findUnique({ where: { taskId_materialId: { taskId: task.id, materialId: reports[4].id } } })).kind, 'other');
    const triages = await Promise.all([svc.triageMaterial(identity, task.id, triageInput), svc.triageMaterial(identity, task.id, triageInput)]);
    assert.equal(triages.filter(r => r.replayed).length, 1);
    assert.equal((await svc.screeningReports('resolve', task.id)).revision, oldRevision + 1);
    assert.equal((await svc.screeningReports('resolve', task.id)).currentId, view.currentId);
    await assert.rejects(svc.resolveScreening(identity, task.id, { materialId: reports[4].id, expectedRevision: oldRevision }), e => e.getStatus() === 409);
    await assert.rejects(svc.triageMaterial(identity, task.id, { ...triageInput, kind: 'assessment' }), e => e.getStatus() === 409);
    await assert.rejects(svc.triageMaterial({ ...identity, actorId: 'someone-else' }, task.id, triageInput), e => e.getStatus() === 409);
    await assert.rejects(svc.triageMaterial({ ...identity, workspaceId: 'foreign' }, task.id, triageInput), e => e.getStatus() === 404);
    await assert.rejects(svc.triageMaterial(identity, task.id, { ...triageInput, materialId: randomUUID() }), e => e.getStatus() === 404);
    await assert.rejects(svc.triageMaterial(identity, task.id, { ...triageInput, kind: 'resume' }));
    const assessment = await db.material.create({ data: { workspaceId: 'resolve', name: 'Assessment attachment', mime: 'text/plain', size: 5, hash: 'assessment', text: 'Do not rewrite', segments: [], readStatus: 'available' } });
    await db.taskMaterial.create({ data: { taskId: task.id, materialId: assessment.id, kind: 'other' } });
    const assessmentResult = await svc.triageMaterial(identity, task.id, { materialId: assessment.id, kind: 'assessment' });
    assert.equal(assessmentResult.triagedBy, 'owner'); assert.ok(assessmentResult.triagedAt);
    assert.equal((await svc.screeningReports('resolve', task.id)).revision, oldRevision + 1);
    assert.deepEqual(await db.material.findUnique({ where: { id: assessment.id } }), assessment);
    const concurrent = await db.material.create({ data: { workspaceId: 'resolve', name: 'Concurrent attachment', mime: 'text/plain', size: 1, hash: 'concurrent', text: 'Immutable', segments: [], readStatus: 'available' } });
    await db.taskMaterial.create({ data: { taskId: task.id, materialId: concurrent.id, kind: 'other' } });
    const triageRace = await Promise.allSettled([
      svc.triageMaterial(identity, task.id, { materialId: concurrent.id, kind: 'screening' }),
      svc.resolveScreening(identity, task.id, { materialId: reports[1].id, expectedRevision: oldRevision + 1 }),
    ]);
    assert.equal(triageRace[0].status, 'fulfilled');
    if (triageRace[1].status === 'rejected') assert.equal(triageRace[1].reason.getStatus(), 409);
    assert.equal((await svc.screeningReports('resolve', task.id)).reports.find(r => r.id === concurrent.id).state, 'unresolved');
    const after = await db.interviewTask.findUnique({ where: { id: task.id } });
    for (const field of ['version', 'decision', 'decisionAt', 'hrConfirmedAt', 'hmConfirmedAt']) assert.deepEqual(after[field], before[field]);
    assert.equal(await db.material.count(), 7);
    assert.deepEqual(await db.cardScore.findUnique({ where: { id: score.id } }), score);
    assert.deepEqual(await db.evaluationPackageVersion.findUnique({ where: { id: frozen.id } }), frozen);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
