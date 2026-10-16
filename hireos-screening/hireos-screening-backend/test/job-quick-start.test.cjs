// Screening's "New job" entry: the JD becomes a draft in JD + Core Record, and Screening uses it
// right away -- Screening can be used on its own, so nobody has to publish the job in JD first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { JobsService, screeningStatus } = require('../dist/jobs/jobs.service');

test('quick_start jobs read a Core draft as open; everything else follows Core', () => {
  assert.equal(screeningStatus('draft', 'quick_start'), 'open');
  assert.equal(screeningStatus('open', 'quick_start'), 'open');
  for (const status of ['paused', 'closed', 'archived']) assert.equal(screeningStatus(status, 'quick_start'), status);
  assert.equal(screeningStatus('draft', 'jd_published'), 'draft');
});

function setup({ remote = true, existing = null, duplicate = false } = {}) {
  const jobs = new Map(existing ? [[existing.id, existing]] : []); const versions = []; const intakeCalls = [];
  const db = {
    job: {
      findFirst: async ({ where, include }) => {
        const job = jobs.get(where.id); if (!job) return null;
        return include ? { ...job, criteriaVersions: versions.filter((v) => v.jobId === job.id) } : job;
      },
      update: async ({ where, data }) => Object.assign(jobs.get(where.id), data),
    },
    $transaction: async (fn) => fn({
      job: { create: async ({ data }) => { jobs.set(data.id, { criteriaStatus: 'draft', criteriaVersion: 0, confirmedBy: null, confirmedAt: null, applicantCount: 0, assessmentRequired: false, ...data }); } },
      jobCriteriaVersion: { create: async ({ data }) => { versions.push(data); } },
    }),
  };
  const coreRecord = { getJob: async (_i, id) => ({ id, title: 'Payments Engineer', status: 'draft', location: 'Shanghai', openings: 1 }) };
  const facade = {
    isRemote: () => remote,
    createFromText: async (_i, text, key) => { intakeCalls.push({ text, key }); return { coreJobId: existing?.id ?? 'core-job-1', title: 'Payments Engineer', jdText: text, duplicate }; },
    get: async () => null,
  };
  return { service: new JobsService(db, coreRecord, facade), jobs, versions, intakeCalls };
}

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };

test('a new JD becomes an open quick_start job in Screening, backed by a JD draft', async () => {
  const { service, jobs, versions, intakeCalls } = setup();
  const result = await service.quickStart(identity, { text: 'Payments Engineer\n\nOwn the ledger.', title: 'Payments Engineer', team: 'Finance Platform' }, 'key-1');
  assert.deepEqual(intakeCalls, [{ text: 'Payments Engineer\n\nOwn the ledger.', key: 'screening.quick-start:key-1' }]);
  assert.equal(result.duplicate, false);
  const job = jobs.get('core-job-1');
  assert.equal(job.status, 'open', 'usable in Screening although it is still a draft in Core Record');
  assert.equal(job.origin, 'quick_start'); assert.equal(job.location, 'Shanghai');
  assert.equal(job.jdText, 'Payments Engineer\n\nOwn the ledger.');
  assert.equal(versions.length, 1); assert.equal(versions[0].version, 0);
  assert.equal(result.job.id, 'core-job-1');
});

test('the same JD again returns the job Screening already has, flagged as a duplicate', async () => {
  const existing = { id: 'core-job-9', workspaceId: 'ws-1', title: 'Payments Engineer', team: 'Unassigned', location: 'Unspecified', employmentType: 'Unspecified', seniority: 'Unspecified', status: 'open', origin: 'jd_published', criteriaStatus: 'draft', criteriaVersion: 0, confirmedBy: null, confirmedAt: null, openings: 1, applicantCount: 0, assessmentRequired: false };
  const { service, jobs, versions } = setup({ existing, duplicate: true });
  const result = await service.quickStart(identity, { text: 'Payments Engineer', title: 'Payments Engineer', team: 'Finance Platform' });
  assert.equal(result.duplicate, true); assert.equal(result.job.id, 'core-job-9');
  assert.equal(jobs.get('core-job-9').origin, 'jd_published', 'a published job stays as it was');
  assert.equal(versions.length, 0);
});

test('empty text is rejected; mock mode creates a local-only job (with the confirmed title, #178) without calling JD', async () => {
  await assert.rejects(setup().service.quickStart(identity, { text: '   ', title: 'X', team: 'Y' }), (e) => e.getStatus() === 422 && e.response?.code === 'INVALID_SCHEMA');
  const { service, jobs, intakeCalls } = setup({ remote: false });
  const result = await service.quickStart(identity, { text: 'Local Role\n\nDo things.', title: 'Local Role', team: 'Ops' });
  assert.equal(intakeCalls.length, 0);
  assert.equal(jobs.get(result.job.id).title, 'Local Role'); assert.equal(jobs.get(result.job.id).status, 'open');
});

test('job sync carries Core field changes (e.g. edits made in HireOS JD) to existing jobs', async () => {
  const local = { id: 'job-q', title: 'Payments Engineer', status: 'open', origin: 'quick_start', team: 'Unassigned', location: 'Unspecified', employmentType: 'Unspecified', seniority: 'Unspecified', openings: 1 };
  const updates = [];
  const db = {
    job: {
      findMany: async ({ where, select }) => (select ? [local] : []),
      update: async ({ where, data }) => { updates.push({ id: where.id, data }); },
    },
    preLinkMatchEvaluation: { findMany: async () => [] },
    candidateJobRecommendation: { findMany: async () => [] },
    application: { findMany: async () => [] },
    resumeVersion: { findMany: async () => [] },
  };
  const coreRecord = { listJobs: async () => [{ id: 'job-q', title: 'Payments Engineer', status: 'draft', location: 'Hangzhou', team: 'Payments', openings: 2 }] };
  const service = new JobsService(db, coreRecord, { isRemote: () => true });
  await service.list(identity);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].data, { title: 'Payments Engineer', status: 'open', team: 'Payments', location: 'Hangzhou', employmentType: 'Unspecified', seniority: 'Unspecified', openings: 2 });
});
