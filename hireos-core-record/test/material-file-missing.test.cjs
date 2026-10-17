// #391 -- a material whose file is gone from storage answers 409 MATERIAL_FILE_MISSING up front, instead of a
// download that breaks mid-stream; with the file there, the bytes come back unchanged.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readdirSync, rmSync, unlinkSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { MaterialsService } = require('../dist/materials/materials.service');

const identity = { workspaceId: 'w', actorId: 'a', roles: [] };
function service(dir) {
  const materials = [];
  const generic = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => null }) });
  const tx = new Proxy({ material: {
    findUnique: async () => null,
    create: async ({ data }) => { const m = { id: `m${materials.length + 1}`, version: 1, createdAt: new Date(), updatedAt: new Date(), ...data }; materials.push(m); return m; },
  } }, { get: (t, k) => t[k] ?? generic[k] });
  const db = { $transaction: async (fn) => fn(tx), material: { findFirst: async ({ where }) => materials.find((m) => m.id === where.id) ?? null } };
  return new MaterialsService(db, { get: (k, d) => (k === 'STORAGE_DIR' ? dir : d) });
}
const read = (stream) => new Promise((resolve, reject) => { const chunks = []; stream.on('data', (c) => chunks.push(c)); stream.on('end', () => resolve(Buffer.concat(chunks))); stream.on('error', reject); });
const sha = (b) => createHash('sha256').update(b).digest('hex');

test('#391: file present -> the same bytes; file gone -> 409 MATERIAL_FILE_MISSING before any stream', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'core-391-'));
  try {
    const svc = service(dir);
    const bytes = Buffer.from('%PDF-1.4 synthetic résumé\n'.repeat(100));
    const created = await svc.create(identity, { buffer: bytes, size: bytes.length, mimetype: 'application/pdf', originalname: 'cv.pdf' }, undefined, { idempotencyKey: 'k1' });
    assert.equal(sha(await read((await svc.readContent(identity, created.id)).stream)), sha(bytes));
    for (const file of readdirSync(dir)) unlinkSync(join(dir, file));
    await assert.rejects(svc.readContent(identity, created.id), (e) => e.getStatus() === 409 && e.getResponse().code === 'MATERIAL_FILE_MISSING');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
