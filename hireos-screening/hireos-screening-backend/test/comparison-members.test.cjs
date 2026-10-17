// #209 -- a comparison is created with exactly the candidates chosen: at least two, each still linked to the job;
// an unknown, withdrawn or other job's application is refused and no comparison is made.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ComparisonsService } = require('../dist/comparisons/comparisons.service');

const identity = { workspaceId: 'w', actorId: 'hr-1', roles: [] };
function setup() {
  const apps = [
    { id: 'a1', jobId: 'j1', status: 'active' }, { id: 'a2', jobId: 'j1', status: 'active' }, { id: 'a3', jobId: 'j1', status: 'active' },
    { id: 'gone', jobId: 'j1', status: 'withdrawn' }, { id: 'other', jobId: 'j2', status: 'active' },
  ];
  const created = [];
  const db = {
    application: { findMany: async ({ where }) => apps.filter((a) => where.id.in.includes(a.id)), findFirst: async ({ where }) => apps.find((a) => a.id === where.id) ?? null },
    job: { findFirst: async () => ({ id: 'j1' }) },
    comparisonSet: { create: async ({ data }) => { created.push(data); return { id: 'c1' }; } },
  };
  const svc = new ComparisonsService(db);
  svc.get = async () => ({ id: 'c1', memberIds: created.at(-1).members.create.map((m) => m.applicationId) });
  return { svc, created };
}
const code = (expected) => (e) => e.getResponse().code === expected;

test('AC-1: two of three linked candidates make a comparison of exactly those two', async () => {
  const { svc, created } = setup();
  const out = await svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1', 'a3'] });
  assert.deepEqual(out.memberIds, ['a1', 'a3']);
  assert.equal(created.length, 1);
});

test('AC-1: fewer than two is refused', async () => {
  const { svc, created } = setup();
  await assert.rejects(svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1'] }), code('COMPARISON_NEEDS_TWO_MEMBERS'));
  await assert.rejects(svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1', 'a1'] }), code('COMPARISON_NEEDS_TWO_MEMBERS'));
  assert.equal(created.length, 0);
});

test('AC-4: unknown, withdrawn and other-job applications are refused, nothing created', async () => {
  const { svc, created } = setup();
  await assert.rejects(svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1', 'nope'] }), code('APPLICATION_NOT_LINKED'));
  await assert.rejects(svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1', 'gone'] }), code('APPLICATION_NOT_LINKED'));
  await assert.rejects(svc.create(identity, { jobId: 'j1', purpose: 'p', applicationIds: ['a1', 'other'] }), code('APPLICATIONS_MUST_SHARE_JOB'));
  assert.equal(created.length, 0);
});
