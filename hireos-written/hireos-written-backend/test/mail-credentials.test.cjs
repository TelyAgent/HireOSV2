// #125 #127 #128 -- a saved mailbox password is only sent to the server and account it was saved for, and SMTP
// connections never reach loopback, private or other internal addresses.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MailAccountsService } = require('../dist/mail-accounts/mail-accounts.service');
const { resolveMailTarget } = require('../dist/mail-accounts/mail-target');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
function setup() {
  const account = { id: 'a-1', workspaceId: 'ws-1', name: 'HR', provider: 'custom', email: 'hr@example.com', password: 'stored-secret', smtpHost: 'smtp.example.com',
    smtpPort: 465, smtpSecure: true, enabled: true, status: 'connected', lastError: null, updatedAt: new Date('2026-10-16') };
  const tested = [];
  const db = { mailAccount: {
    findFirst: async ({ where }) => (where.id === 'a-1' && where.workspaceId === 'ws-1' ? { ...account } : null),
    update: async ({ data }) => ({ ...account, ...data }),
  } };
  const mail = { testConnection: async (creds) => { tested.push([creds.smtpHost, creds.password]); } };
  return { service: new MailAccountsService(db, mail), tested };
}
const refused = (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA' && e.response.fieldPaths.includes('password');

test('#125/#127 AC-1: a new host, port, security mode or account without a new password is refused before any connection', async () => {
  for (const change of [{ smtpHost: 'smtp.attacker.test' }, { smtpPort: 2525 }, { smtpSecure: false }, { email: 'other@example.com' }]) {
    const { service, tested } = setup();
    await assert.rejects(service.update(identity, 'a-1', change), refused, JSON.stringify(change));
    assert.deepEqual(tested, [], 'the stored password went nowhere');
  }
});

test('#125/#127 AC-2: a rename keeps the stored password for the same server; a new password goes to the new one', async () => {
  const same = setup();
  await same.service.update(identity, 'a-1', { name: 'Recruiting', smtpHost: 'SMTP.example.com' });
  assert.deepEqual(same.tested, [['SMTP.example.com', 'stored-secret']]);
  const moved = setup();
  await moved.service.update(identity, 'a-1', { smtpHost: 'smtp.newprovider.com', password: 'new-secret' });
  assert.deepEqual(moved.tested, [['smtp.newprovider.com', 'new-secret']]);
});

test('#125/#127 AC-3: another workspace\'s account is not found and nothing connects', async () => {
  const { service, tested } = setup();
  await assert.rejects(service.update({ ...identity, workspaceId: 'ws-2' }, 'a-1', { name: 'x' }), (e) => e.getStatus() === 404);
  assert.deepEqual(tested, []);
});

test('#128: internal addresses are refused for SMTP; a public server is connected at the checked address', async () => {
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fd12::1', '::ffff:192.168.0.1']) {
    await assert.rejects(resolveMailTarget('smtp.internal.test', async () => [{ address, family: address.includes(':') ? 6 : 4 }]), /private or local network/, address);
  }
  assert.deepEqual(await resolveMailTarget('smtp.example.com', async () => [{ address: '93.184.216.34', family: 4 }]), { address: '93.184.216.34', servername: 'smtp.example.com' });
});
