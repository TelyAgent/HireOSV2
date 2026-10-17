const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
try { process.loadEnvFile('.env'); } catch {}
const { PrismaClient } = require('@prisma/client');
const { InternalController } = require('../dist/internal/internal.controller');

test('#426 internal verification: trusted token, active account and exact active workspace membership', async () => {
  const schema = `verify_member_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    await db.workspace.create({ data: { id: 'ws', name: 'Synthetic' } });
    const user = await db.user.create({ data: { email: 'synthetic@example.com', displayName: 'Synthetic' } });
    await db.membership.create({ data: { workspaceId: 'ws', userId: user.id, roles: ['interviewer'], status: 'active' } });
    const where = { userId_workspaceId: { userId: user.id, workspaceId: 'ws' } };
    const ctrl = new InternalController({}, { internalToken: 'test-secret' }, db);
    const req = { headers: { 'x-internal-token': 'test-secret' } }, body = { workspaceId: 'ws', userId: user.id };
    await assert.rejects(ctrl.verifyMember({ headers: {} }, body), e => e.status === 403);
    await assert.rejects(ctrl.verifyMember(req, {}), e => e.status === 400);
    assert.deepEqual(await ctrl.verifyMember(req, body), { active: true, userId: user.id, workspaceId: 'ws' });
    assert.deepEqual(await ctrl.verifyMember(req, { ...body, workspaceId: 'other' }), { active: false });
    assert.deepEqual(await ctrl.verifyMember(req, { ...body, userId: 'missing' }), { active: false });
    for (const status of ['invited', 'removed']) {
      await db.membership.update({ where, data: { status } });
      assert.deepEqual(await ctrl.verifyMember(req, body), { active: false });
    }
    await db.membership.update({ where, data: { status: 'active' } });
    await db.user.update({ where: { id: user.id }, data: { status: 'disabled' } });
    assert.deepEqual(await ctrl.verifyMember(req, body), { active: false });
  } finally { await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.$disconnect(); }
});
