// #125 #127 #128 -- a saved mail password is only ever sent to the server and account it was saved for, and mail
// connections never reach loopback, private or other internal addresses (unless an operator allowlists the host).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SettingsService } = require('../dist/settings/settings.service');
const { resolveMailTarget, isBlockedAddress } = require('../dist/settings/mail-target');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const saved = {
  email: 'hr@example.com', password: 'stored-secret', imapHost: 'imap.example.com', imapPort: 993, imapTls: true,
  smtpHost: 'smtp.example.com', smtpPort: 465, smtpSecure: true, provider: 'custom', mailbox: 'INBOX', purposes: { inbound: true, outbound: true },
};
function service() {
  const sentTo = [];
  const mail = {
    testImap: async (creds) => { sentTo.push(['imap', creds.imapHost, creds.password]); return { messagesExist: 0 }; },
    testSmtp: async (creds) => { sentTo.push(['smtp', creds.smtpHost, creds.password]); },
  };
  const s = new SettingsService({}, mail, {});
  s.getMailboxSetting = async (workspaceId, id) => (workspaceId === 'ws-1' && id === 'mb-1' ? { id: 'mb-1', key: 'k', version: 1, payload: { ...saved } } : null);
  return { s, sentTo };
}
const form = (over = {}) => {
  const { password: _p, ...rest } = saved;
  return { ...rest, ...over };
};
const refused = (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA' && e.response.fieldPaths.includes('password');

test('#125/#127 AC-1: a new host, port or account without a new password is refused and nothing connects', async () => {
  for (const change of [{ smtpHost: 'smtp.attacker.test' }, { imapHost: 'imap.attacker.test' }, { smtpPort: 2525 }, { imapTls: false }, { email: 'other@example.com' }]) {
    const { s, sentTo } = service();
    await assert.rejects(s.testCorporateMailbox(identity, form(change), 'mb-1'), refused, JSON.stringify(change));
    await assert.rejects(s.updateCorporateMailbox(identity, 'mb-1', form(change)), refused, JSON.stringify(change));
    assert.deepEqual(sentTo, [], 'the stored password went nowhere');
  }
});

test('#125/#127 AC-2: the same server keeps the stored password; a new password goes to the new server', async () => {
  const same = service();
  await same.s.testCorporateMailbox(identity, form({ name: 'Renamed', smtpHost: 'SMTP.example.com ' }), 'mb-1');
  assert.deepEqual(same.sentTo.map((c) => c[2]), ['stored-secret', 'stored-secret']);
  const moved = service();
  await moved.s.testCorporateMailbox(identity, form({ smtpHost: 'smtp.newprovider.com', password: 'new-secret' }), 'mb-1');
  assert.deepEqual(moved.sentTo.map((c) => c[2]), ['new-secret', 'new-secret']);
});

test('#125/#127 AC-3: another workspace\'s mailbox is not found, and its password is never used', async () => {
  const { s, sentTo } = service();
  await assert.rejects(s.updateCorporateMailbox({ ...identity, workspaceId: 'ws-2' }, 'mb-1', form()), (e) => e.getStatus() === 404);
  await assert.rejects(s.testCorporateMailbox({ ...identity, workspaceId: 'ws-2' }, form(), 'mb-1'), (e) => e.getStatus() === 400 && e.response.code === 'CREDENTIALS_REQUIRED');
  assert.deepEqual(sentTo, []);
});

test('#128 AC-2: loopback, private, link-local, shared, reserved and IPv6 internal addresses are refused', async () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.0.5', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
    assert.ok(isBlockedAddress(address), address);
    await assert.rejects(resolveMailTarget('mail.internal.test', async () => [{ address, family: address.includes(':') ? 6 : 4 }]), /private or local network/, address);
  }
  // An address literal is judged the same way, and one internal answer among public ones is enough to refuse.
  await assert.rejects(resolveMailTarget('127.0.0.1'), /private or local network/);
  await assert.rejects(resolveMailTarget('[::1]'), /private or local network/);
  await assert.rejects(resolveMailTarget('mixed.test', async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]), /private or local network/);
});

test('#128 AC-3: a public mail server is used at the address checked, with its name for TLS; an allowlisted private host works', async () => {
  const target = await resolveMailTarget('smtp.example.com', async () => [{ address: '93.184.216.34', family: 4 }]);
  assert.deepEqual(target, { address: '93.184.216.34', servername: 'smtp.example.com' }, 'connect to the checked address, not a fresh lookup');
  await assert.rejects(resolveMailTarget('missing.test', async () => { throw new Error('ENOTFOUND'); }), /could not be found/);
  process.env.MAIL_PRIVATE_HOST_ALLOWLIST = 'mail.corp.local';
  try {
    assert.deepEqual(await resolveMailTarget('mail.corp.local', async () => [{ address: '10.0.0.25', family: 4 }]), { address: '10.0.0.25', servername: 'mail.corp.local' });
    await assert.rejects(resolveMailTarget('other.corp.local', async () => [{ address: '10.0.0.26', family: 4 }]), /private or local network/);
  } finally {
    delete process.env.MAIL_PRIVATE_HOST_ALLOWLIST;
  }
});
