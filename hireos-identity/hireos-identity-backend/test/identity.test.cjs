const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('../dist/auth/auth-crypto');
const templates = require('../dist/mail/templates');

test('identity app module compiles', () => {
  assert.equal(typeof require('../dist/app.module').AppModule, 'function');
});

test('sign-in codes are 6 digits and only their HMAC is comparable', () => {
  for (let i = 0; i < 200; i++) assert.match(crypto.generateCode(), /^\d{6}$/);
  const hash = crypto.hashCode('012345', 'secret');
  assert.equal(crypto.safeEqualHex(hash, crypto.hashCode('012345', 'secret')), true);
  assert.equal(crypto.safeEqualHex(hash, crypto.hashCode('012346', 'secret')), false);
  assert.equal(crypto.safeEqualHex(hash, crypto.hashCode('012345', 'other-secret')), false);
  assert.equal(crypto.safeEqualHex(hash, 'abc'), false);
});

test('session tokens are random and stored only as a hash', () => {
  const a = crypto.newSessionToken();
  const b = crypto.newSessionToken();
  assert.notEqual(a, b);
  assert.ok(a.length >= 43);
  assert.equal(crypto.hashToken(a), crypto.hashToken(a));
  assert.notEqual(crypto.hashToken(a), a);
});

test('emails are normalized before lookup', () => {
  assert.equal(crypto.normalizeEmail('  Maya.Chen@Example.COM '), 'maya.chen@example.com');
  assert.equal(crypto.isValidEmail('maya@example.com'), true);
  assert.equal(crypto.isValidEmail('maya@example'), false);
  assert.equal(crypto.isValidEmail('not an email'), false);
});

test('returnTo only accepts same-site paths into known subsystems', () => {
  assert.equal(crypto.sanitizeReturnTo('/screening/jobs?x=1', ''), '/screening/jobs?x=1');
  assert.equal(crypto.sanitizeReturnTo('/hireos/jd/jobs/new', '/hireos'), '/hireos/jd/jobs/new');
  assert.equal(crypto.sanitizeReturnTo('/screening', ''), '/screening');
  for (const bad of ['//evil.com/screening/', 'https://evil.com/screening/', '/\\evil.com', '/screeningx/', '/other/', '/screening/\n', 42, null]) {
    assert.equal(crypto.sanitizeReturnTo(bad, ''), null, String(bad));
  }
  assert.equal(crypto.sanitizeReturnTo('/screening/jobs', '/hireos'), null);
});

test('cookie header parsing keeps the first value and tolerates junk', () => {
  assert.deepEqual(crypto.parseCookies('a=1; hireos_sid=abc%3D; a=2; junk'), { a: '1', hireos_sid: 'abc=' });
  assert.deepEqual(crypto.parseCookies(undefined), {});
});

test('roles are filtered to the known set', () => {
  assert.deepEqual(crypto.normalizeRoles(['hr', 'bogus', 'admin', 'hr']), ['hr', 'admin']);
  assert.deepEqual(crypto.normalizeRoles('admin'), []);
});

test('sign-in email puts the code first in the subject, in both languages', () => {
  const en = templates.renderLoginCodeEmail('817296', 'en');
  assert.equal(en.subject, '817296 is your HireOS verification code');
  assert.match(en.html, /8 1 7 2 9 6/);
  assert.match(en.text, /817296/);
  const zh = templates.renderLoginCodeEmail('817296', templates.mailLocale('zh-CN'));
  assert.equal(zh.subject, '817296 是你的 HireOS 登录验证码');
  assert.equal(templates.mailLocale('en-US'), 'en');
  assert.equal(templates.mailLocale(undefined), 'zh');
});

test('invite email escapes the inviter name', () => {
  const mail = templates.renderInviteEmail({ inviterName: '<b>x</b>', signInUrl: 'https://h/account/login', locale: 'en' });
  assert.ok(!mail.html.includes('<b>x</b>'));
  assert.match(mail.html, /&lt;b&gt;x&lt;\/b&gt;/);
});

test('client IP skips exactly the trusted proxy hops and ignores forged X-Forwarded-For entries', () => {
  const { clientIp } = require('../dist/auth/http');
  const req = (xff, peer) => ({ headers: xff === undefined ? {} : { 'x-forwarded-for': xff }, socket: { remoteAddress: peer } });
  // Local: no proxies → the socket peer.
  assert.equal(clientIp(req(undefined, '127.0.0.1'), 0), '127.0.0.1');
  // Server: client → host nginx (sets XFF=client) → gateway nginx (appends host nginx) → us.
  assert.equal(clientIp(req('203.0.113.7, 172.18.0.1', '172.18.0.5'), 2), '203.0.113.7');
  // A forged leading entry doesn't change the answer.
  assert.equal(clientIp(req('6.6.6.6, 203.0.113.7, 172.18.0.1', '172.18.0.5'), 2), '203.0.113.7');
  // Fewer hops than configured → leftmost known address rather than undefined.
  assert.equal(clientIp(req(undefined, '172.18.0.5'), 2), '172.18.0.5');
});
