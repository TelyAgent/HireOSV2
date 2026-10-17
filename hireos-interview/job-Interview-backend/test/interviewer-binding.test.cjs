require('dotenv').config({ quiet: true });
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { createServer } = require('node:http');
const { PrismaClient } = require('@prisma/client');
const { ConfigService } = require('@nestjs/config');
const { InterviewersService } = require('../dist/interviewers/interviewers.service');

test('#426 initial binding: membership verification, isolation, concurrency, immutable audit', async () => {
  const schema = `binding_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let mode = 'active', calls = 0;
  const server = createServer(async (req, res) => {
    calls++; assert.equal(req.headers['x-internal-token'], 'internal-test');
    assert.equal(req.url, '/internal/memberships/verify');
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks));
    res.setHeader('content-type', 'application/json');
    if (mode === 'error') { res.statusCode = 503; return res.end('{}'); }
    if (mode === 'invalid') return res.end('null');
    res.end(JSON.stringify({ active: mode !== 'inactive', workspaceId: mode === 'foreign' ? 'elsewhere' : body.workspaceId, userId: body.userId }));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const sql of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(sql);
    }
    const service = new InterviewersService(db, new ConfigService({ IDENTITY_INTERNAL_URL: `http://127.0.0.1:${server.address().port}`, IDENTITY_INTERNAL_TOKEN: 'internal-test' }));
    const admin = { workspaceId: 'ws', actorId: 'admin', roles: ['admin'] };
    const create = workspaceId => db.interviewer.create({ data: { workspaceId, name: 'Synthetic' } });
    const row = await create('ws'), other = await create('other');
    assert.equal((await service.bindings(admin))[0].accountBinding, null);
    await assert.rejects(service.bind({ ...admin, roles: ['hr'] }, row.id, { accountId: 'a' }), e => e.status === 403);
    await assert.rejects(service.bind(admin, other.id, { accountId: 'a' }), e => e.status === 404);
    await assert.rejects(service.bind(admin, 'missing', { accountId: 'a' }), e => e.status === 404);
    assert.equal(calls, 0);
    for (const value of ['inactive', 'foreign', 'invalid', 'error']) {
      mode = value;
      await assert.rejects(service.bind(admin, row.id, { accountId: 'a' }));
      assert.equal(await db.interviewerAccountBinding.count(), 0);
    }
    mode = 'active';
    const pair = await Promise.all([service.bind(admin, row.id, { accountId: 'a' }), service.bind(admin, row.id, { accountId: 'a' })]);
    assert.deepEqual(pair[0], pair[1]);
    const saved = pair[0]; assert.equal(saved.boundBy, 'admin'); assert.ok(saved.boundAt instanceof Date);
    mode = 'error';
    assert.deepEqual(await service.bind({ ...admin, actorId: 'second-admin' }, row.id, { accountId: 'a' }), saved);
    await assert.rejects(service.bind(admin, row.id, { accountId: 'b' }), e => e.status === 409);
    mode = 'active';
    const race = await create('ws');
    const results = await Promise.allSettled(['a', 'b'].map(accountId => service.bind(admin, race.id, { accountId })));
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
    assert.equal(await db.interviewerAccountBinding.count(), 2);
    assert.equal((await service.bindings({ ...admin, workspaceId: 'other' }))[0].accountBinding, null);
    assert.deepEqual(await db.interviewerAccountBinding.findUnique({ where: { interviewerId: row.id } }), saved);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await db.$disconnect();
    await new Promise(r => server.close(r));
  }
});
