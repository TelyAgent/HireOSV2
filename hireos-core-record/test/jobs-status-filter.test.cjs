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

test('jobs can be fetched by id past the 100-row directory, other workspaces and deleted ids left out (#143)', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { JobsService } = require('../dist/jobs/jobs.service');
  const db = new PrismaService(); await db.$connect();
  const service = new JobsService(db);
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  const other = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  try {
    const oldest = await db.job.create({ data: { workspaceId: identity.workspaceId, title: 'Oldest', status: 'open', createdBy: 'u', createdAt: new Date(Date.now() - 86_400_000) } });
    await db.job.createMany({ data: Array.from({ length: 100 }, (_, i) => ({ workspaceId: identity.workspaceId, title: `Newer ${i}`, status: 'draft', createdBy: 'u' })) });
    const foreign = await db.job.create({ data: { workspaceId: other.workspaceId, title: 'Foreign', status: 'open', createdBy: 'u' } });
    assert.ok(!(await service.list(identity)).some((j) => j.id === oldest.id), 'the directory stops at the newest 100');
    const byIds = await service.listByIds(identity, `${oldest.id}, ${foreign.id},${randomUUID()},${oldest.id}`);
    assert.deepEqual(byIds.map((j) => j.title), ['Oldest']);
    assert.deepEqual(await service.listByIds(identity, ''), []);
    await assert.rejects(service.listByIds(identity, Array.from({ length: 101 }, () => randomUUID()).join(',')));
  } finally {
    await db.job.deleteMany({ where: { workspaceId: { in: [identity.workspaceId, other.workspaceId] } } });
    await db.$disconnect();
  }
});
