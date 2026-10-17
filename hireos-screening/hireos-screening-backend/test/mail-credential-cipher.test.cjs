// #387 -- mailbox passwords at rest: encrypted under MAIL_CREDENTIAL_KEY, plain text from before still read,
// rotation through MAIL_CREDENTIAL_KEY_PREVIOUS, and no key in production means a clear error, never plain text.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { decryptCredential, encryptCredential, isCurrent, isEncrypted } = require('../dist/settings/mail-credential-cipher');

const keyA = randomBytes(32).toString('base64');
const keyB = randomBytes(32).toString('base64');
const prod = (extra) => ({ NODE_ENV: 'production', ...extra });

test('AC-1: a saved password is ciphertext that decrypts back, and differs every time it is saved', () => {
  const env = prod({ MAIL_CREDENTIAL_KEY: keyA });
  const one = encryptCredential('abcd efgh ijkl mnop', env);
  const two = encryptCredential('abcd efgh ijkl mnop', env);
  assert.ok(isEncrypted(one) && !one.includes('abcd'));
  assert.notEqual(one, two);
  assert.equal(decryptCredential(one, env), 'abcd efgh ijkl mnop');
});

test('AC-2: plain text saved before encryption is read as it is', () => {
  assert.equal(decryptCredential('legacy-app-password', prod({ MAIL_CREDENTIAL_KEY: keyA })), 'legacy-app-password');
  assert.equal(isCurrent('legacy-app-password', prod({ MAIL_CREDENTIAL_KEY: keyA })), false);
});

test('AC-3: after a rotation values under either key are read; new ones go under the new key', () => {
  const old = encryptCredential('secret', prod({ MAIL_CREDENTIAL_KEY: keyA }));
  const rotated = prod({ MAIL_CREDENTIAL_KEY: keyB, MAIL_CREDENTIAL_KEY_PREVIOUS: keyA });
  assert.equal(decryptCredential(old, rotated), 'secret');
  assert.equal(isCurrent(old, rotated), false);
  assert.equal(isCurrent(encryptCredential('secret', rotated), rotated), true);
  assert.throws(() => decryptCredential(old, prod({ MAIL_CREDENTIAL_KEY: keyB })), (e) => e.getResponse().code === 'MAIL_CREDENTIAL_KEY_MISMATCH');
});

test('AC-3: in production without a key, saving and reading fail clearly; a malformed key is refused', () => {
  const sealed = encryptCredential('secret', prod({ MAIL_CREDENTIAL_KEY: keyA }));
  assert.throws(() => encryptCredential('secret', prod({})), (e) => e.getResponse().code === 'MAIL_CREDENTIAL_KEY_MISSING');
  assert.throws(() => decryptCredential(sealed, prod({})), (e) => e.getResponse().code === 'MAIL_CREDENTIAL_KEY_MISSING');
  assert.throws(() => encryptCredential('secret', prod({ MAIL_CREDENTIAL_KEY: 'short' })), (e) => e.getResponse().code === 'MAIL_CREDENTIAL_KEY_INVALID');
});

test('outside production a development key stands in, still encrypting', () => {
  const sealed = encryptCredential('secret', {});
  assert.ok(isEncrypted(sealed));
  assert.equal(decryptCredential(sealed, {}), 'secret');
});

test('a tampered value is rejected, not decrypted', () => {
  const env = prod({ MAIL_CREDENTIAL_KEY: keyA });
  const sealed = encryptCredential('secret', env);
  const parts = sealed.split(':');
  parts[5] = Buffer.from('tampered').toString('base64url');
  assert.throws(() => decryptCredential(parts.join(':'), env));
});
