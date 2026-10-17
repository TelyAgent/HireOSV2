#!/usr/bin/env node
// #387: rewrites every saved corporate-mailbox password under the current MAIL_CREDENTIAL_KEY -- plain text saved
// before encryption, and values under MAIL_CREDENTIAL_KEY_PREVIOUS after a rotation. Safe to run again: values
// already under the current key are left alone. Run from the service directory after `npm run build`:
//   node scripts/encrypt-mail-credentials.cjs            (rewrites)
//   node scripts/encrypt-mail-credentials.cjs --dry-run  (only counts)
const { PrismaClient } = require('@prisma/client');
const { decryptCredential, encryptCredential, isCurrent } = require('../dist/settings/mail-credential-cipher');

(async () => {
  const dryRun = process.argv.includes('--dry-run');
  const db = new PrismaClient();
  const counts = { total: 0, rewritten: 0, alreadyCurrent: 0, noPassword: 0 };
  try {
    for (const row of await db.workspaceSetting.findMany({ where: { kind: 'corporate_mailbox' } })) {
      counts.total++;
      const payload = row.payload ?? {};
      if (!payload.password) { counts.noPassword++; continue; }
      if (isCurrent(payload.password)) { counts.alreadyCurrent++; continue; }
      const password = encryptCredential(decryptCredential(payload.password));
      if (!dryRun) await db.workspaceSetting.update({ where: { id: row.id }, data: { payload: { ...payload, password } } });
      counts.rewritten++;
    }
    console.log(JSON.stringify({ dryRun, ...counts }));
  } finally {
    await db.$disconnect();
  }
})().catch((error) => { console.error(error.response?.code ?? error.message); process.exit(1); });
