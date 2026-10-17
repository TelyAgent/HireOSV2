const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { TasksService } = require('../dist/intake/tasks.service');
try { process.loadEnvFile('.env'); } catch { /* CI supplies DATABASE_URL. */ }

test('#243 recorded activity: empty, latest 20, isolation and payload minimization', async () => {
  const schema = `activity_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const job = await db.job.create({ data: { workspaceId: 'activity', createdBy: 'actor', title: 'Synthetic', jdText: 'Synthetic' } });
    const candidate = await db.candidate.create({ data: { workspaceId: 'activity', name: 'Synthetic' } });
    const task = await db.interviewTask.create({ data: { workspaceId: 'activity', createdBy: 'actor', jobId: job.id, candidateId: candidate.id } });
    const svc = new TasksService(db);
    assert.deepEqual(await svc.activity('activity', task.id), []);
    for (let i = 0; i < 22; i++) await db.revision.create({ data: {
      id: `record-${String(i).padStart(2, '0')}`, taskId: task.id, actorId: 'recorded-actor', version: i,
      createdAt: new Date('2026-10-17T00:00:00Z'), payload: i === 21 ? { kind: 'stage_decision', reason: 'PRIVATE' } : i === 20 ? { action: 'reviewed' } : { secret: 'PRIVATE' },
    } });
    const rows = await svc.activity('activity', task.id);
    assert.equal(rows.length, 20);
    assert.equal(rows[0].id, 'record-21');
    assert.equal(rows[0].event, 'decision_recorded');
    assert.equal(rows[1].event, 'review_recorded');
    assert.equal(rows[2].event, 'unknown');
    assert.equal(rows[0].actorId, 'recorded-actor');
    assert.ok(!JSON.stringify(rows).includes('PRIVATE'));
    assert.ok(!Object.hasOwn(rows[0], 'payload'));
    await assert.rejects(svc.activity('foreign', task.id), error => error.getStatus() === 404);
    await assert.rejects(svc.activity('activity', 'missing'), error => error.getStatus() === 404);
    assert.equal(await db.revision.count(), 22);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
