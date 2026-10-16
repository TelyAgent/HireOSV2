// #135 -- a mailbox import reads a bounded amount: an attachment, a message and the whole import each have a byte
// (and count) budget, reading stops as soon as one is passed, and a message that isn't imported stays unread.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { MailService, streamToBuffer, MAIL_IMPORT_LIMITS } = require('../dist/settings/mail.service');
const { SettingsService } = require('../dist/settings/settings.service');

const KB = 1024;
const limits = { attachmentBytes: 100 * KB, messageBytes: 150 * KB, messageAttachments: 3, batchBytes: 250 * KB, batchAttachments: 5 };

/** A stream of `bytes` bytes in 8 KB chunks that records how much was actually pulled from it. */
function source(bytes, counter) {
  let sent = 0;
  return new Readable({
    read() {
      if (sent >= bytes) return this.push(null);
      const n = Math.min(8 * KB, bytes - sent);
      sent += n; counter.read += n;
      this.push(Buffer.alloc(n, 1));
    },
  });
}

/** A fake IMAP mailbox: each message lists its résumé attachments as [filename, actual bytes, stated bytes?]. */
function mailbox(messages) {
  const counter = { read: 0 };
  const client = {
    connect: async () => {}, logout: async () => {},
    getMailboxLock: async () => ({ release() {} }),
    search: async () => messages.map((m) => m.uid),
    fetchOne: async (uid) => {
      const m = messages.find((x) => String(x.uid) === uid);
      return { envelope: { subject: m.subject, from: [{ address: 'cv@example.org' }] }, bodyStructure: {
        childNodes: m.files.map(([filename, , stated], i) => ({ part: String(i + 2), type: 'application', subtype: 'pdf', dispositionParameters: { filename }, ...(stated != null ? { size: stated } : {}) })),
      } };
    },
    download: async (uid, part) => {
      const m = messages.find((x) => String(x.uid) === uid);
      return { content: source(m.files[Number(part) - 2][1], counter) };
    },
  };
  const service = new MailService();
  service.buildImapClient = async () => client;
  return { service, counter };
}

test('#135 AC-1: reading stops as soon as an attachment passes the limit — what was read is dropped', async () => {
  const counter = { read: 0 };
  await assert.rejects(streamToBuffer(source(10 * 1024 * KB, counter), 100 * KB), /over/);
  assert.ok(counter.read < 200 * KB, `read ${counter.read} bytes of a 10 MB stream`);
  // An attachment that understates its size is still cut off by the bytes actually read.
  const { service, counter: c2 } = mailbox([{ uid: 1, subject: 'Liar', files: [['cv.pdf', 5 * 1024 * KB, 10 * KB]] }]);
  const scan = await service.listUnseenResumeAttachments({}, 20, limits);
  assert.deepEqual([scan.messages.length, scan.skipped.map((s) => s.reason)], [0, ['attachment_too_large']]);
  assert.ok(c2.read < 200 * KB, `read ${c2.read} bytes`);
});

test('#135 AC-1: a stated size over the limit is refused before downloading anything', async () => {
  const { service, counter } = mailbox([{ uid: 1, subject: 'Huge', files: [['huge.pdf', 5 * 1024 * KB, 5 * 1024 * KB]] }]);
  const scan = await service.listUnseenResumeAttachments({}, 20, limits);
  assert.deepEqual(scan.skipped.map((s) => s.reason), ['attachment_too_large']);
  assert.equal(counter.read, 0);
});

test('#135 AC-2: attachments each under the limit but too much together are limited; small ones import', async () => {
  const { service } = mailbox([
    { uid: 1, subject: 'Small', files: [['a.pdf', 20 * KB]] },
    { uid: 2, subject: 'Two big', files: [['b.pdf', 90 * KB], ['c.pdf', 90 * KB]] }, // 180 KB > 150 KB per message
    { uid: 3, subject: 'Many', files: [['1.pdf', KB], ['2.pdf', KB], ['3.pdf', KB], ['4.pdf', KB]] }, // > 3 per message
    { uid: 4, subject: 'Fits', files: [['d.pdf', 90 * KB], ['e.pdf', 50 * KB]] },
    { uid: 5, subject: 'Over batch', files: [['f.pdf', 99 * KB], ['g.pdf', 50 * KB]] }, // 20+140+149 > 250 KB
    { uid: 6, subject: 'After', files: [['h.pdf', KB]] },
  ]);
  const scan = await service.listUnseenResumeAttachments({}, 20, limits);
  assert.deepEqual(scan.messages.map((m) => m.subject), ['Small', 'Fits']);
  assert.deepEqual(scan.skipped.map((s) => [s.subject, s.reason]), [['Two big', 'message_too_large'], ['Many', 'too_many_attachments']]);
  assert.equal(scan.deferred, 2, 'the over-budget message and the rest wait for the next import');
  const kept = scan.messages.flatMap((m) => m.attachments).reduce((sum, a) => sum + a.buffer.length, 0);
  assert.ok(kept <= limits.batchBytes);
});

test('#135 AC-3: skipped and deferred messages are not marked read; the import says why', async () => {
  const marked = [];
  const mail = {
    listUnseenResumeAttachments: async () => ({
      messages: [{ uid: 1, subject: 'Small', from: 'x@example.org', attachments: [{ filename: 'a.pdf', mimetype: 'application/pdf', buffer: Buffer.from('%PDF-1') }] }],
      skipped: [{ uid: 2, subject: 'Two big', from: 'y@example.org', reason: 'message_too_large', detail: 'attachments total 180 KB' }],
      deferred: 3,
    }),
    markSeen: async (_c, uids) => marked.push(...uids),
  };
  const db = { workspaceSetting: { update: async () => ({}) }, auditRecord: { create: async () => ({}) } };
  const imports = { createBatch: async () => ({ id: 'batch-1' }) };
  const s = new SettingsService(db, mail, imports);
  s.getMailboxSetting = async () => ({ id: 'mb', key: 'mb', version: 1, payload: { email: 'hr@example.com', password: 'x', purposes: { inbound: true } } });
  s.audit = async () => {};
  const result = await s.importFromMailbox({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'mb');
  assert.deepEqual(marked, [1], 'only the imported message is marked read');
  assert.deepEqual(result.skipped.map((m) => m.reason), ['message_too_large']);
  assert.equal(result.deferred, 3);
  // If the import itself fails, nothing is marked read either.
  const failing = new SettingsService(db, { ...mail, markSeen: async (_c, uids) => marked.push(...uids.map((u) => -u)) }, { createBatch: async () => { throw new Error('db down'); } });
  failing.getMailboxSetting = s.getMailboxSetting; failing.audit = s.audit;
  await assert.rejects(failing.importFromMailbox({ workspaceId: 'ws-1', actorId: 'hr-1', roles: [] }, 'mb'));
  assert.deepEqual(marked, [1]);
});

test('#135: the default limits are an upload\'s 25 MB per attachment, 50 MB per message, 100 MB per import', () => {
  assert.deepEqual(MAIL_IMPORT_LIMITS, { attachmentBytes: 25 * 1024 * KB, messageBytes: 50 * 1024 * KB, messageAttachments: 10, batchBytes: 100 * 1024 * KB, batchAttachments: 50 });
});
