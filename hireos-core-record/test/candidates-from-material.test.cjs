const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('a résumé file resolves to one shared candidate, even when resolved concurrently', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { CandidatesService } = require('../dist/candidates/candidates.service');
  const db = new PrismaService(); await db.$connect();
  const service = new CandidatesService(db);
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  const other = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  const material = (ws, name) => db.material.create({ data: { workspaceId: ws, name, mime: 'text/plain', size: 1, hash: randomUUID(), storageKey: randomUUID() } });
  const resolve = (who, body) => service.resolveForMaterial(who, body, { idempotencyKey: randomUUID() });
  try {
    const resume = await material(identity.workspaceId, 'Lin_Chen.txt');
    const first = await resolve(identity, { materialId: resume.id, displayName: 'Lin Chen', source: 'interview' });
    assert.equal(first.created, true); assert.equal(first.displayName, 'Lin Chen');
    assert.equal((await db.material.findUnique({ where: { id: resume.id } })).candidateId, first.id);

    const second = await resolve(identity, { materialId: resume.id, displayName: 'Lin Chen (written)', source: 'written' });
    assert.equal(second.created, false); assert.equal(second.id, first.id, 'the second subsystem reuses the first candidate');
    assert.equal(second.displayName, 'Lin Chen', 'an existing candidate is returned unchanged');

    const racing = await material(identity.workspaceId, 'Race.txt');
    const results = await Promise.all([1, 2, 3].map((n) => resolve(identity, { materialId: racing.id, displayName: `Race ${n}` })));
    assert.equal(new Set(results.map((r) => r.id)).size, 1, 'concurrent resolves agree on one candidate');
    assert.equal(results.filter((r) => r.created).length, 1);

    const elsewhere = await material(other.workspaceId, 'Other.txt');
    await assert.rejects(resolve(identity, { materialId: elsewhere.id, displayName: 'X' }), (e) => e.getStatus() === 404);
    await assert.rejects(resolve(identity, { materialId: 'not-a-uuid', displayName: 'X' }));
    assert.equal(await db.candidate.count({ where: { workspaceId: identity.workspaceId } }), 2);
  } finally {
    for (const ws of [identity.workspaceId, other.workspaceId]) {
      await db.material.deleteMany({ where: { workspaceId: ws } });
      await db.outboxEvent.deleteMany({ where: { workspaceId: ws } });
      await db.auditRecord.deleteMany({ where: { workspaceId: ws } });
      await db.candidate.deleteMany({ where: { workspaceId: ws } });
    }
    await db.$disconnect();
  }
});
