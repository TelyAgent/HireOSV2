// #389 -- background jobs are taken workspace by workspace: one workspace's burst no longer makes another wait.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { FairQueue } = require('../dist/shared/fair-queue');
const { ProfilesService } = require('../dist/profiles/profiles.service');

/** Enough of Prisma's processingJob for the claim: status filter, groupBy by workspace, oldest first. */
function memoryDb(jobs) {
  const claimable = (j, where) => j.type === where.type && where.OR.some((c) => c.status === j.status) && (!where.workspaceId || j.workspaceId === where.workspaceId);
  return { processingJob: {
    groupBy: async ({ where }) => {
      const heads = new Map();
      for (const j of jobs.filter((x) => claimable(x, where))) {
        const head = heads.get(j.workspaceId);
        if (!head || j.createdAt < head._min.createdAt) heads.set(j.workspaceId, { workspaceId: j.workspaceId, _min: { createdAt: j.createdAt } });
      }
      return [...heads.values()];
    },
    findFirst: async ({ where }) => jobs.filter((j) => claimable(j, where)).sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
    updateMany: async ({ where }) => {
      const j = jobs.find((x) => x.id === where.id && where.OR.some((c) => c.status === x.status));
      if (!j) return { count: 0 };
      j.status = 'running';
      return { count: 1 };
    },
  } };
}
const job = (id, workspaceId, t) => ({ id, type: 'resume_parse', workspaceId, status: 'queued', nextRunAt: new Date(0), createdAt: new Date(1_000_000 + t) });

test('AC-1: workspace B queued after 30 of A runs right after A’s first job, not after all 30', async () => {
  const jobs = [...Array.from({ length: 30 }, (_, i) => job(`a${i}`, 'A', i)), job('b0', 'B', 31)];
  const svc = new ProfilesService(memoryDb(jobs), {}, {}, {});
  const order = [];
  svc.processClaimed = async (id) => { order.push(id); jobs.find((j) => j.id === id).status = 'succeeded'; };
  while (jobs.some((j) => j.status === 'queued')) await svc.processQueued();
  assert.deepEqual(order.slice(0, 3), ['a0', 'b0', 'a1']);
  assert.equal(order.length, 31);
});

test('AC-1: three workspaces take turns, each oldest-first', async () => {
  const jobs = [job('a0', 'A', 0), job('a1', 'A', 1), job('a2', 'A', 2), job('b0', 'B', 3), job('b1', 'B', 4), job('c0', 'C', 5)];
  const db = memoryDb(jobs);
  const queue = new FairQueue();
  const where = { type: 'resume_parse', OR: [{ status: 'queued' }] };
  const order = [];
  for (let next; (next = await queue.next(db, where)); ) { order.push(next.id); next.status = 'succeeded'; }
  assert.deepEqual(order, ['a0', 'b0', 'c0', 'a1', 'b1', 'a2']);
});

test('AC-2: a single workspace still runs oldest first, and nothing claimable means nothing', async () => {
  const jobs = [job('a1', 'A', 5), job('a0', 'A', 1)];
  const db = memoryDb(jobs);
  const queue = new FairQueue();
  const where = { type: 'resume_parse', OR: [{ status: 'queued' }] };
  assert.equal((await queue.next(db, where)).id, 'a0');
  jobs.forEach((j) => { j.status = 'succeeded'; });
  assert.equal(await queue.next(db, where), null);
});
