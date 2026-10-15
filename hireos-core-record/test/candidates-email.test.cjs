const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('candidates can be looked up by email within a workspace, case-insensitively', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { CandidatesService } = require('../dist/candidates/candidates.service');
  const db = new PrismaService(); await db.$connect();
  const service = new CandidatesService(db);
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  const other = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  const create = (who, body) => service.create(who, body, { idempotencyKey: randomUUID() });
  try {
    const ada = await create(identity, { displayName: 'Ada', email: 'ada@example.com' });
    await create(identity, { displayName: 'Grace', email: 'grace@example.com' });
    await create(other, { displayName: 'Ada elsewhere', email: 'ada@example.com' });
    const found = await service.findByEmail(identity, '  ADA@example.com ');
    assert.deepEqual(found.map((c) => c.id), [ada.id]);
    assert.deepEqual(await service.findByEmail(identity, 'nobody@example.com'), []);
    await assert.rejects(service.findByEmail(identity, 'not-an-email'));
    await assert.rejects(service.findByEmail(identity, undefined));
  } finally {
    for (const ws of [identity.workspaceId, other.workspaceId]) {
      await db.outboxEvent.deleteMany({ where: { workspaceId: ws } });
      await db.auditRecord.deleteMany({ where: { workspaceId: ws } });
      await db.idempotencyKey.deleteMany({ where: { workspaceId: ws } });
      await db.candidate.deleteMany({ where: { workspaceId: ws } });
    }
    await db.$disconnect();
  }
});
