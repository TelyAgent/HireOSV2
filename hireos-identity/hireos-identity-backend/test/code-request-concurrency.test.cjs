// #133 -- code requests are rate limited and codes replaced under concurrency, by the database (not a process
// lock): two separate clients stand in for two service instances. Real Postgres, a throwaway schema per run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WORKSPACE = 'ws-test';
const MEMBER = 'member@example.com';

test('#133 code requests under concurrency', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `identity_conc_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  url.searchParams.set('connection_limit', '10');
  process.env.DATABASE_URL = url.toString();

  const { ConfigService } = require('@nestjs/config');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { IdentityConfig } = require('../dist/identity.config');
  const { SessionsService } = require('../dist/sessions/sessions.service');
  const { AuthService } = require('../dist/auth/auth.service');

  const admin = new PrismaService();
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  // Two clients, two connection pools: two "instances" of the service.
  const dbA = new PrismaService();
  const dbB = new PrismaService();
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split(';').filter((s) => s.trim())) await dbA.$executeRawUnsafe(statement);
    }
    const sent = [];
    const mail = { send: async (to, rendered) => void sent.push({ to, code: rendered.subject.match(/\d{6}/)?.[0] }) };
    const config = new IdentityConfig(new ConfigService({ DEFAULT_WORKSPACE_ID: WORKSPACE, LOGIN_CODE_SECRET: 'test-secret' }));
    const authA = new AuthService(dbA, config, mail, new SessionsService(dbA));
    const authB = new AuthService(dbB, config, mail, new SessionsService(dbB));
    await dbA.workspace.create({ data: { id: WORKSPACE, name: 'Test' } });
    const member = await dbA.user.create({ data: { email: MEMBER, displayName: 'Member' } });
    await dbA.membership.create({ data: { userId: member.id, workspaceId: WORKSPACE, roles: ['hr'], status: 'active' } });

    const outcome = (p) => p.then(() => 'sent', (e) => (e.getStatus?.() === 429 ? 'limited' : `error:${e.message}`));
    const burst = (count, call) => Promise.all(Array.from({ length: count }, (_, i) => outcome(call(i % 2 ? authB : authA, i))));

    await t.test('AC-1: same email at once from two instances — one code within the cooldown, the rest 429', async () => {
      const results = await burst(8, (auth) => auth.requestCode(MEMBER, 'en', { ip: '198.51.100.1', userAgent: 'test' }));
      assert.deepEqual(results.filter((r) => r === 'sent').length, 1, results.join(','));
      assert.ok(results.every((r) => r === 'sent' || r === 'limited'), results.join(','));
      assert.equal(sent.filter((s) => s.to === MEMBER).length, 1, 'one email went out');
      assert.equal(await dbA.loginCode.count({ where: { email: MEMBER, supersededAt: null, consumedAt: null } }), 1);
    });

    await t.test('AC-3: after the cooldown, concurrent resends leave exactly one valid code; the older one is superseded', async () => {
      // Move the earlier request out of the cooldown window.
      await dbA.authEvent.updateMany({ where: { email: MEMBER }, data: { createdAt: new Date(Date.now() - 2 * 60 * 1000) } });
      const before = sent.filter((s) => s.to === MEMBER).length;
      const results = await burst(6, (auth) => auth.requestCode(MEMBER, 'en', { ip: '198.51.100.1', userAgent: 'test' }));
      assert.equal(results.filter((r) => r === 'sent').length, 1, results.join(','));
      const codes = sent.filter((s) => s.to === MEMBER);
      assert.equal(codes.length, before + 1);
      assert.equal(await dbA.loginCode.count({ where: { email: MEMBER, supersededAt: null, consumedAt: null } }), 1, 'one valid code');
      const [oldCode, newCode] = [codes[codes.length - 2].code, codes[codes.length - 1].code];
      if (oldCode !== newCode) {
        await assert.rejects(authA.verifyCode(MEMBER, oldCode, { ip: '198.51.100.1' }), (e) => e.response.code === 'CODE_SUPERSEDED');
      }
      const signedIn = await authB.verifyCode(MEMBER, newCode, { ip: '198.51.100.1' });
      assert.ok(signedIn.token);
      await assert.rejects(authA.verifyCode(MEMBER, newCode, { ip: '198.51.100.1' }), (e) => e.response.code === 'CODE_USED', 'consumed once');
    });

    await t.test('AC-2: different emails from one IP at once never exceed the hourly IP limit', async () => {
      const results = await burst(30, (auth, i) => auth.requestCode(`person${i}@example.org`, 'en', { ip: '203.0.113.99', userAgent: 'test' }));
      assert.equal(results.filter((r) => r === 'sent').length, 20, results.join(','));
      assert.equal(results.filter((r) => r === 'limited').length, 10);
      assert.equal(await dbA.authEvent.count({ where: { type: 'code_requested', ip: '203.0.113.99' } }), 20);
    });
  } finally {
    await dbA.$disconnect();
    await dbB.$disconnect();
    await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.$disconnect();
  }
});
