// #143 -- listing jobs costs a bounded number of Core Record calls however many jobs a workspace has, writes only
// what changed, and list requests within 30 seconds share one sync.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JobsService, JOB_SYNC_INTERVAL_MS } = require('../dist/jobs/jobs.service');

function setup(remoteCount, { deletedRemotely = 0, closedRemotely = 0, delayMs = 0, failBatch = false } = {}) {
  const remote = Array.from({ length: remoteCount }, (_, i) => ({ id: `j${String(i).padStart(3, '0')}`, title: `Job ${i}`, status: i < closedRemotely ? 'closed' : 'open', createdAt: i, team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', openings: 1 }));
  const local = remote.map((r) => ({ id: r.id, workspaceId: 'w', title: r.title, status: 'open', origin: 'jd_published', team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', openings: 1 }));
  for (let i = 0; i < deletedRemotely; i++) local.push({ id: `gone${i}`, workspaceId: 'w', title: 'Old', status: 'open', origin: 'jd_published', team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', openings: 1 });
  const count = { listJobs: 0, byIds: 0, getJob: 0, updates: 0 };
  const wait = () => new Promise((r) => setTimeout(r, delayMs));
  const match = (row, where) => Object.entries(where).every(([k, v]) => (v && typeof v === 'object' ? ('in' in v ? v.in.includes(row[k]) : 'notIn' in v ? !v.notIn.includes(row[k]) : true) : row[k] === v));
  const db = {
    job: {
      findMany: async ({ where }) => local.filter((r) => match(r, where)).map((r) => ({ ...r, criteriaVersions: [] })),
      update: async ({ where, data }) => { count.updates++; Object.assign(local.find((r) => r.id === where.id), data); },
    },
    // The funnels are counted in SQL (#414); no rows behind them here.
    $queryRaw: async () => [],
  };
  const directory = () => [...remote].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
  const core = {
    listJobs: async () => { count.listJobs++; await wait(); return directory(); },
    listJobsByIds: async (_i, ids) => { count.byIds++; await wait(); if (failBatch) throw new Error('Core Record is unavailable'); return remote.filter((r) => ids.includes(r.id)); },
    getJob: async () => { count.getJob++; return null; },
  };
  return { svc: new JobsService(db, core, { get: async () => null }), count, local, remote };
}
const identity = { workspaceId: 'w', actorId: 'a', roles: [] };

test('AC-1: past 100 jobs, one list costs two Core Record calls and writes nothing when nothing changed', async () => {
  for (const n of [101, 150, 400]) {
    const { svc, count, local } = setup(n);
    await svc.list(identity);
    assert.deepEqual(count, { listJobs: 1, byIds: 1, getJob: 0, updates: 0 }, `${n} jobs`);
    assert.ok(local.every((j) => j.status === 'open'));
  }
});

test('AC-1: jobs deleted in Core Record are archived, closed ones take their status; the rest are not written', async () => {
  const { svc, count, local } = setup(150, { deletedRemotely: 3, closedRemotely: 2 });
  await svc.list(identity);
  assert.equal(count.byIds, 1);
  assert.deepEqual(local.filter((j) => j.id.startsWith('gone')).map((j) => j.status), ['archived', 'archived', 'archived']);
  assert.deepEqual(local.filter((j) => j.status === 'closed').map((j) => j.id), ['j000', 'j001']);
  assert.equal(count.updates, 5);
});

test('AC-1: a failed lookup leaves the jobs as they are', async () => {
  const { svc, count, local } = setup(0, { deletedRemotely: 2, failBatch: true });
  await svc.list(identity);
  assert.equal(count.updates, 0);
  assert.ok(local.every((j) => j.status === 'open'));
});

test('AC-2: concurrent lists share one sync, and lists within 30 seconds reuse it', async () => {
  const { svc, count } = setup(150, { delayMs: 50 });
  await Promise.all([svc.list(identity), svc.list(identity), svc.list(identity)]);
  await svc.list(identity);
  assert.deepEqual([count.listJobs, count.byIds], [1, 1]);
  assert.equal(JOB_SYNC_INTERVAL_MS, 30_000);
});

test('AC-2: once the window has passed, the next list syncs again', async (t) => {
  const { svc, count } = setup(10);
  t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
  await svc.list(identity);
  t.mock.timers.setTime(1_000_000 + JOB_SYNC_INTERVAL_MS - 1);
  await svc.list(identity);
  assert.equal(count.listJobs, 1);
  t.mock.timers.setTime(1_000_000 + JOB_SYNC_INTERVAL_MS + 1);
  await svc.list(identity);
  assert.equal(count.listJobs, 2);
});
