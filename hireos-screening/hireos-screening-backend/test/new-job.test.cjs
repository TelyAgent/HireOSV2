// #178 -- "New job": AI reads the JD first (preview, nothing created), then the recruiter's title and team are
// required — each refused on its own when empty, before anything is created — and a new job stays out of
// matching until its criteria are confirmed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JobsService } = require('../dist/jobs/jobs.service');
const { DiscoveryService } = require('../dist/discovery/discovery.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
function setup() {
  const calls = [];
  const facade = {
    isRemote: () => true,
    previewFromText: async (_i, text) => { calls.push(['preview', text]); return { title: '全栈工程师', team: '招聘平台研发部', location: '上海', duplicateOf: null }; },
    createFromText: async (_i, text, key, confirmed) => { calls.push(['create', key, confirmed]); return { coreJobId: 'j-new', title: confirmed.title, jdText: text, duplicate: false }; },
    get: async () => null,
  };
  const db = { job: { findFirst: async () => null } };
  const core = { getJob: async () => ({ id: 'j-new', title: 'Senior Full-stack Engineer', team: 'Platform', location: '上海', status: 'draft' }) };
  const s = new JobsService(db, core, facade);
  s.createLocalJob = async (_i, job) => calls.push(['local', job]);
  s.get = async (_i, id) => ({ id });
  return { s, calls };
}
const fieldError = (field) => (e) => e.getStatus() === 422 && e.response.code === 'INVALID_SCHEMA' && JSON.stringify(e.response).includes(field);

test('#178 AC-1: an empty title or an empty team is refused on its own, and nothing is created', async () => {
  const { s, calls } = setup();
  await assert.rejects(s.quickStart(identity, { text: 'JD text', title: '', team: 'Platform' }, 'k1'), fieldError('title'));
  await assert.rejects(s.quickStart(identity, { text: 'JD text', title: 'Engineer', team: '  ' }, 'k1'), fieldError('team'));
  await assert.rejects(s.quickStart(identity, { text: 'JD text' }, 'k1'), fieldError('title'));
  assert.deepEqual(calls, [], 'no JD, Core Record or local job was touched');
});

test('#178 AC-1/AC-2: the preview creates nothing; the create uses the confirmed title and team with the modal\'s key', async () => {
  const { s, calls } = setup();
  const preview = await s.quickStartPreview(identity, { text: 'JD text' });
  assert.deepEqual(preview, { title: '全栈工程师', team: '招聘平台研发部', location: '上海', duplicateOf: null });
  assert.deepEqual(calls.map((c) => c[0]), ['preview']);
  const out = await s.quickStart(identity, { text: 'JD text', title: 'Senior Full-stack Engineer', team: 'Platform' }, 'modal-key');
  assert.equal(out.job.id, 'j-new');
  const create = calls.find((c) => c[0] === 'create');
  assert.equal(create[1], 'screening.quick-start:modal-key', 'a repeated click reuses the same idempotency key');
  assert.deepEqual(create[2], { title: 'Senior Full-stack Engineer', team: 'Platform' });
});

test('#178 AC-3: matching only looks at open roles whose criteria are confirmed', async () => {
  let where;
  const db = {
    job: { findMany: async (args) => { where = args.where; return []; } },
    jobDiscoveryRun: { create: async () => ({ id: 'run-1' }), update: async ({ data }) => ({ id: 'run-1', ...data }) },
    candidate: { update: async () => ({}) },
  };
  const service = new DiscoveryService(db, { isConfigured: () => false });
  await service['runMatchForCandidate']('ws-1', { id: 'c-1', displayName: 'X', profiles: [], resumeVersions: [] });
  assert.deepEqual(where.criteriaVersions, { some: { status: 'confirmed' } });
  assert.equal(where.status, 'open');
});
