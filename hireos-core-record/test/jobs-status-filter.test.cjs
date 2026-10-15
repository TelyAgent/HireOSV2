const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('the job directory can be narrowed to one status (published = open) before the row cap', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { JobsService } = require('../dist/jobs/jobs.service');
  const db = new PrismaService(); await db.$connect();
  const service = new JobsService(db);
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  try {
    for (const [title, status] of [['Draft A', 'draft'], ['Open B', 'open'], ['Open C', 'open'], ['Closed D', 'closed']]) {
      await db.job.create({ data: { workspaceId: identity.workspaceId, title, status, createdBy: identity.actorId } });
    }
    assert.equal((await service.list(identity)).length, 4);
    assert.deepEqual((await service.list(identity, undefined, 'open')).map((j) => j.title).sort(), ['Open B', 'Open C']);
    assert.deepEqual((await service.list(identity, 'C', 'open')).map((j) => j.title), ['Open C']);
    await assert.rejects(service.list(identity, undefined, 'bogus'));
  } finally {
    await db.job.deleteMany({ where: { workspaceId: identity.workspaceId } });
    await db.$disconnect();
  }
});
