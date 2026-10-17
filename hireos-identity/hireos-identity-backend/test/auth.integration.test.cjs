// Issue #16 — email-code sign-in rules, against a real Postgres (a throwaway schema per run).
// Locally DATABASE_URL comes from .env; CI provides it for projects registered with "database": true.
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
const INVITED = 'invited@example.com';
const OUTSIDER = 'outsider@example.com';
const META = { ip: '203.0.113.7', userAgent: 'node-test' };
const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

test('identity sign-in rules (issue #16)', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `identity_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();

  const { ConfigService } = require('@nestjs/config');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { IdentityConfig } = require('../dist/identity.config');
  const { SessionsService } = require('../dist/sessions/sessions.service');
  const { AuthService } = require('../dist/auth/auth.service');
  const { UsersService } = require('../dist/users/users.service');

  const db = new PrismaService();
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split(';').filter((s) => s.trim())) await db.$executeRawUnsafe(statement);
    }

    const sent = [];
    const mail = { send: async (to, rendered) => void sent.push({ to, code: rendered.subject.match(/\d{6}/)?.[0], subject: rendered.subject }) };
    const config = new IdentityConfig(new ConfigService({ DEFAULT_WORKSPACE_ID: WORKSPACE, LOGIN_CODE_SECRET: 'test-secret' }));
    const sessions = new SessionsService(db);
    const auth = new AuthService(db, config, mail, sessions);
    const users = new UsersService(db, config, sessions, mail);

    await db.workspace.create({ data: { id: WORKSPACE, name: 'Test' } });
    const member = await db.user.create({ data: { email: MEMBER, displayName: 'Member' } });
    const invited = await db.user.create({ data: { email: INVITED, displayName: 'Invited' } });
    const admin = await db.user.create({ data: { email: 'admin@example.com', displayName: 'Admin' } });
    await db.membership.createMany({
      data: [
        { userId: member.id, workspaceId: WORKSPACE, roles: ['hr'], status: 'active' },
        { userId: invited.id, workspaceId: WORKSPACE, roles: ['interviewer'], status: 'invited' },
        { userId: admin.id, workspaceId: WORKSPACE, roles: ['admin'], status: 'active' },
      ],
    });

    /** Rate limits are tested on their own; everywhere else each request starts with a clean slate. */
    const freshCode = async (email) => {
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await auth.requestCode(email, 'en', META);
      return sent.filter((m) => m.to === email).at(-1)?.code;
    };
    const rejection = async (email, code) => {
      try {
        await auth.verifyCode(email, code, META);
      } catch (error) {
        return { status: error.getStatus(), ...error.getResponse() };
      }
      return null;
    };

    await t.test('AC-2: a member gets a 6-digit code by email and signs in with it', async () => {
      const code = await freshCode(MEMBER);
      assert.match(code, /^\d{6}$/);
      const signedIn = await auth.verifyCode(MEMBER, code, META);
      assert.equal(signedIn.identity.email, MEMBER);
      assert.ok(signedIn.token.length >= 43);
    });

    await t.test('AC-2: an invited member becomes active on first sign-in', async () => {
      const code = await freshCode(INVITED);
      await auth.verifyCode(INVITED, code, META);
      const membership = await db.membership.findUnique({ where: { userId_workspaceId: { userId: invited.id, workspaceId: WORKSPACE } } });
      assert.equal(membership.status, 'active');
    });

    await t.test('AC-3: valid 10 minutes, single use', async () => {
      const code = await freshCode(MEMBER);
      const record = await db.loginCode.findFirst({ where: { email: MEMBER }, orderBy: { createdAt: 'desc' } });
      // expiresAt is set by the service, createdAt by the database a moment later.
      assert.ok(Math.abs(record.expiresAt.getTime() - record.createdAt.getTime() - 10 * MINUTE) < 2000);
      assert.notEqual(record.codeHash, code, 'only the HMAC is stored');
      await auth.verifyCode(MEMBER, code, META);
      assert.equal((await rejection(MEMBER, code)).code, 'CODE_USED');
    });

    await t.test('AC-3: resending invalidates the previous code at once', async () => {
      const first = await freshCode(MEMBER);
      const second = await freshCode(MEMBER);
      assert.notEqual(first, second);
      assert.equal((await rejection(MEMBER, first)).code, 'CODE_SUPERSEDED');
      assert.equal((await auth.verifyCode(MEMBER, second, META)).identity.email, MEMBER);
    });

    await t.test('AC-3: five wrong attempts kill the code, even the right one afterwards', async () => {
      const code = await freshCode(MEMBER);
      const wrong = code === '000000' ? '000001' : '000000';
      const left = [];
      for (let i = 0; i < 4; i++) left.push((await rejection(MEMBER, wrong)).attemptsLeft);
      assert.deepEqual(left, [4, 3, 2, 1]);
      assert.equal((await rejection(MEMBER, wrong)).code, 'CODE_ATTEMPTS_EXCEEDED');
      assert.equal((await rejection(MEMBER, code)).code, 'CODE_ATTEMPTS_EXCEEDED');
    });

    await t.test('AC-3: an expired code says so', async () => {
      const code = await freshCode(MEMBER);
      await db.loginCode.updateMany({ where: { email: MEMBER, consumedAt: null, supersededAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
      assert.equal((await rejection(MEMBER, code)).code, 'CODE_EXPIRED');
    });

    await t.test('AC-4: an uninvited email looks exactly like a member, but never gets a code or a session', async () => {
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      const before = sent.length;
      const memberReply = await auth.requestCode(MEMBER, 'en', META);
      const outsiderReply = await auth.requestCode(OUTSIDER, 'en', { ...META, ip: '198.51.100.9' });
      assert.deepEqual(outsiderReply, memberReply);
      assert.equal(sent.length, before + 1, 'only the member was emailed');
      assert.equal(sent.at(-1).to, MEMBER);
      // Verifying behaves the same too: a wrong code costs one attempt in both cases.
      const memberWrong = await rejection(MEMBER, '123456');
      const outsiderWrong = await rejection(OUTSIDER, '123456');
      assert.deepEqual({ code: outsiderWrong.code, attemptsLeft: outsiderWrong.attemptsLeft }, { code: memberWrong.code, attemptsLeft: memberWrong.attemptsLeft });
      // Asking about an email that never requested a code is the same for both, too.
      assert.equal((await rejection('never-asked@example.com', '123456')).code, 'CODE_REQUIRED');
      assert.equal(await db.session.count({ where: { user: { email: OUTSIDER } } }), 0);
    });

    await t.test('AC-5: 60-second resend cooldown, enforced by the server', async () => {
      await freshCode(MEMBER);
      await assert.rejects(auth.requestCode(MEMBER, 'en', META), (error) => error.getStatus() === 429 && error.getResponse().retryAfterSeconds <= 60);
    });

    const seedRequests = (count, spacingMs, extra = {}) =>
      db.authEvent.createMany({
        data: Array.from({ length: count }, (_, i) => ({ type: 'code_requested', createdAt: new Date(Date.now() - 2 * MINUTE - i * spacingMs), ...extra })),
      });

    await t.test('AC-5: at most 5 codes per email per hour', async () => {
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await seedRequests(5, 5 * MINUTE, { email: MEMBER });
      await assert.rejects(auth.requestCode(MEMBER, 'en', META), (error) => error.getStatus() === 429);
    });

    await t.test('AC-5: at most 20 codes per email per day', async () => {
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await seedRequests(20, 70 * MINUTE, { email: MEMBER }); // spread out: never 5 in one hour
      await assert.rejects(auth.requestCode(MEMBER, 'en', META), (error) => error.getStatus() === 429 && error.getResponse().retryAfterSeconds > 3600);
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await seedRequests(19, 70 * MINUTE, { email: MEMBER });
      await auth.requestCode(MEMBER, 'en', META); // the 20th is still allowed
    });

    await t.test('AC-5: at most 20 code requests per IP per hour', async () => {
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await db.authEvent.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({ type: 'code_requested', email: `x${i}@example.com`, ip: META.ip, createdAt: new Date(Date.now() - 2 * MINUTE) })),
      });
      await assert.rejects(auth.requestCode(MEMBER, 'en', META), (error) => error.getStatus() === 429);
      await auth.requestCode(INVITED, 'en', { ...META, ip: '192.0.2.1' }); // another IP is unaffected
    });

    const signIn = async () => {
      const code = await freshCode(MEMBER);
      return (await auth.verifyCode(MEMBER, code, META)).token;
    };
    const backdate = (token, data) => db.session.updateMany({ where: { tokenHash: require('node:crypto').createHash('sha256').update(token).digest('hex') }, data });

    await t.test('AC-6: a session unused for 7 days ends', async () => {
      const token = await signIn();
      assert.ok(await sessions.resolve(token));
      await backdate(token, { lastUsedAt: new Date(Date.now() - 8 * DAY), expiresAt: new Date(Date.now() - DAY) });
      assert.equal(await sessions.resolve(token), null);
    });

    await t.test('AC-6: 30 days after sign-in the session ends however actively it is used', async () => {
      const token = await signIn();
      await backdate(token, { createdAt: new Date(Date.now() - 31 * DAY), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 6 * DAY) });
      assert.equal(await sessions.resolve(token), null);
    });

    await t.test('AC-6: sliding renewal never reaches past 30 days from sign-in', async () => {
      const token = await signIn();
      const createdAt = new Date(Date.now() - 29 * DAY);
      await backdate(token, { createdAt, lastUsedAt: new Date(Date.now() - 10 * MINUTE), expiresAt: new Date(Date.now() + DAY) });
      const identity = await sessions.resolve(token);
      assert.ok(identity);
      assert.ok(identity.expiresAt.getTime() <= createdAt.getTime() + 30 * DAY);
    });

    await t.test('AC-7: signing out revokes the session on the server', async () => {
      const token = await signIn();
      const identity = await sessions.resolve(token);
      await sessions.revoke(identity.sessionId);
      assert.equal(await sessions.resolve(token), null);
    });

    await t.test('AC-7: signing out everywhere revokes every session of the user', async () => {
      const a = await signIn();
      const b = await signIn();
      await sessions.revokeAllForUser(member.id);
      assert.equal(await sessions.resolve(a), null);
      assert.equal(await sessions.resolve(b), null);
    });

    await t.test('AC-8: a removed member loses their sessions at once and can no longer get a code', async () => {
      const token = await signIn();
      const adminIdentity = { userId: admin.id, displayName: 'Admin' };
      await users.remove(adminIdentity, member.id);
      assert.equal(await sessions.resolve(token), null);
      const before = sent.length;
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await auth.requestCode(MEMBER, 'en', META);
      assert.equal(sent.length, before, 'no email for a removed member');
    });
    await t.test('#233: the code email is in the sign-in page language, even when the account chose another', async () => {
      const user = await db.user.create({ data: { email: 'chose-zh@example.com', displayName: 'Chose zh', locale: 'zh', localeSetAt: new Date() } });
      await db.membership.create({ data: { userId: user.id, workspaceId: WORKSPACE, roles: ['hr'], status: 'active' } });
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await auth.requestCode('chose-zh@example.com', 'en', META);
      assert.match(sent.at(-1).subject, /is your HireOS verification code/);
      await db.authEvent.deleteMany({ where: { type: 'code_requested' } });
      await auth.requestCode('chose-zh@example.com', undefined, META);
      assert.match(sent.at(-1).subject, /登录验证码/, 'without a page language, the account language');
    });

    await t.test('#233: an account that never chose a language takes the sign-in page language; one that did keeps its own', async () => {
      const email = 'new-lang@example.com';
      const user = await db.user.create({ data: { email, displayName: 'New' } });
      await db.membership.create({ data: { userId: user.id, workspaceId: WORKSPACE, roles: ['hr'], status: 'active' } });
      const first = await auth.verifyCode(email, await freshCode(email), META, 'en');
      assert.equal(first.identity.locale, 'en');
      assert.equal(first.identity.localeChosen, true);
      const second = await auth.verifyCode(email, await freshCode(email), META, 'zh');
      assert.equal(second.identity.locale, 'en', 'the account keeps the language it already has');
    });

    await t.test('#233: choosing a language in any module makes it the account language', async () => {
      const { AuthController } = require('../dist/auth/auth.controller');
      const email = 'switcher@example.com';
      const user = await db.user.create({ data: { email, displayName: 'Switcher' } });
      await db.membership.create({ data: { userId: user.id, workspaceId: WORKSPACE, roles: ['hr'], status: 'active' } });
      const signedIn = await auth.verifyCode(email, await freshCode(email), META);
      assert.equal(signedIn.identity.localeChosen, false, 'no page language sent: still the default');
      const controller = new AuthController(auth, sessions, config, db);
      await controller.updateMe({ auth: signedIn.identity, headers: { cookie: `hireos_sid=${signedIn.token}` }, cookies: {} }, { locale: 'en' });
      const after = await sessions.resolve(signedIn.token);
      assert.deepEqual([after.locale, after.localeChosen], ['en', true]);
      await controller.updateMe({ auth: after, headers: { cookie: `hireos_sid=${signedIn.token}` }, cookies: {} }, { displayName: 'Renamed' });
      assert.equal((await sessions.resolve(signedIn.token)).locale, 'en', 'saving the name leaves the language alone');
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
