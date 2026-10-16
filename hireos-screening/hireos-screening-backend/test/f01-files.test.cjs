// #162 #163 #165 #166 -- each refused or failed file says why, in its own category: over the page limit, password-
// protected (isolated), damaged, a scan without text, empty, or an unsupported type. Real sample files throughout.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MaterialsService } = require('../dist/intake/materials.service');
const { SecurityScanService } = require('../dist/intake/security-scan.service');
const { ImportsService, errorDetails } = require('../dist/intake/imports.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const fixture = (name) => fs.readFileSync(path.join(__dirname, 'fixtures', 'f01', name));
const pdf = (name, buffer = fixture(name)) => ({ originalname: name, mimetype: 'application/pdf', size: buffer.length, buffer });

/** Just the Prisma calls saveUpload makes: no existing file, store the new one. */
function materials() {
  const stored = [];
  const db = {
    material: {
      findFirst: async () => null,
      create: async ({ data }) => { const row = { id: `m-${stored.length + 1}`, ...data }; stored.push(row); return row; },
    },
  };
  const core = { uploadMaterial: async () => null };
  return { service: new MaterialsService(db, new SecurityScanService(), core), stored };
}

async function save(file) {
  const { service } = materials();
  return (await service.saveUpload(identity, file)).material;
}

test('#162 AC-1/AC-2: a 10-page PDF is read; an 11-page PDF is refused with its reason, server-side', async () => {
  const ten = await save(pdf('ten-pages.pdf'));
  assert.equal(ten.readStatus, 'available');
  assert.equal(ten.errorCode, null);

  const eleven = await save(pdf('eleven-pages.pdf'));
  assert.equal(eleven.readStatus, 'failed');
  assert.equal(eleven.errorCode, 'PDF_TOO_MANY_PAGES');
  assert.equal(eleven.text, '', 'nothing is kept for later parsing');
});

test('#163 AC-1/AC-2: a password-protected PDF is quarantined for its encryption; an owner-password-only PDF still reads', async () => {
  const locked = await save(pdf('encrypted.pdf'));
  assert.equal(locked.securityStatus, 'quarantined');
  assert.equal(locked.readStatus, 'blocked');
  assert.equal(locked.errorCode, 'PDF_ENCRYPTED');
  assert.equal(locked.text, '');

  const readable = await save(pdf('owner-only.pdf'));
  assert.equal(readable.securityStatus, 'passed');
  assert.equal(readable.readStatus, 'available');
});

test('#165 AC-1/AC-2: a damaged PDF and a scan without text are told apart', async () => {
  const damaged = await save(pdf('corrupt.pdf'));
  assert.equal(damaged.errorCode, 'FILE_UNREADABLE');
  const scan = await save(pdf('scan.pdf'));
  assert.equal(scan.errorCode, 'OCR_REQUIRED');
  assert.equal((await save(pdf('one-page.pdf'))).readStatus, 'available', '#163 AC-3: a normal PDF is unaffected');
});

test('#166 AC-1/AC-2: an empty file and an unsupported type are refused with a readable message, not "Bad Request Exception"', async () => {
  const { service } = materials();
  const refusal = async (file) => {
    try {
      await service.saveUpload(identity, file);
    } catch (error) {
      return errorDetails(error);
    }
    assert.fail('expected a refusal');
  };
  const empty = await refusal({ originalname: 'empty.txt', mimetype: 'text/plain', size: 0, buffer: Buffer.alloc(0) });
  assert.equal(empty.code, 'EMPTY_FILE');
  assert.match(empty.message, /empty/i);
  assert.equal(empty.retryable, false);

  const png = await refusal({ originalname: 'photo.png', mimetype: 'image/png', size: 8, buffer: Buffer.from('\x89PNG\r\n\x1a\n', 'latin1') });
  assert.equal(png.code, 'UNSUPPORTED_FILE_TYPE');
  assert.match(png.message, /PDF, DOCX and TXT/);
  for (const result of [empty, png]) assert.doesNotMatch(result.message, /Bad Request Exception/);
});

test('#163 AC-2: a quarantined file never reaches candidate creation or AI', async () => {
  const locked = await save(pdf('encrypted.pdf'));
  const updates = []; const queued = [];
  const service = new ImportsService({}, {}, { extractIdentitySignals: () => assert.fail('no parsing') }, {});
  service.updateItem = async (_i, _o, _b, _item, data) => updates.push(data);
  service.enqueueCandidateCreation = async () => queued.push(1);
  await service['processSavedMaterial'](identity, 'op-1', 'batch-1', 'item-1', { kind: 'created', material: locked }, 'manual_upload');
  assert.deepEqual(queued, []);
  assert.equal(updates[0].outcome, 'quarantined');
  assert.equal(updates[0].errorCode, 'PDF_ENCRYPTED');
});

test('#162 AC-3 / #166 AC-3: in a mixed batch, the bad files fail on their own and the good one goes on', async () => {
  const { service: materialsService } = materials();
  const items = new Map(); const queued = [];
  const db = {
    ingestionOperation: { create: async () => ({ id: 'op-1', batch: { id: 'batch-1' } }) },
    importItem: { create: async ({ data }) => { const row = { id: `i-${items.size + 1}`, ...data }; items.set(row.id, row); return row; } },
    activityEvent: { create: async () => ({}) },
  };
  const service = new ImportsService(db, materialsService, { extractIdentitySignals: () => ({ displayName: 'Mai Tran', email: null, phone: null }) }, {});
  service.recordActivity = async () => {};
  service.findPossibleDuplicate = async () => null;
  service.enqueueCandidateCreation = async (_i, _o, _b, itemId) => queued.push(items.get(itemId).fileName);
  service.updateItem = async (_i, _o, _b, itemId, data) => Object.assign(items.get(itemId), data);
  service.finalizeBatch = async () => [...items.values()];
  const empty = { originalname: 'empty.txt', mimetype: 'text/plain', size: 0, buffer: Buffer.alloc(0) };
  const result = await service.createBatch(identity, [pdf('eleven-pages.pdf'), empty, pdf('one-page.pdf')]);
  const byName = Object.fromEntries(result.map((item) => [item.fileName, item]));
  assert.equal(byName['eleven-pages.pdf'].errorCode, 'PDF_TOO_MANY_PAGES');
  assert.equal(byName['empty.txt'].errorCode, 'EMPTY_FILE');
  assert.deepEqual(queued, ['one-page.pdf'], 'only the valid file goes on to candidate creation');
});
