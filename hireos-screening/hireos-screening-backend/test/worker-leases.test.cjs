// #385 -- with two instances, a background job's outcome belongs to the worker holding its lease, and a handoff
// event is sent by exactly one dispatcher.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { InterviewHandoffDispatcherService } = require('../dist/decisions/interview-handoff-dispatcher.service');
const { DiscoveryService } = require('../dist/discovery/discovery.service');
const { ProfilesService } = require('../dist/profiles/profiles.service');

function matches(row, where) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((sub) => matches(row, sub));
    if (cond === null) return row[key] == null;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('notIn' in cond) return !cond.notIn.includes(row[key]);
      if ('lt' in cond) return row[key] != null && row[key] < cond.lt;
      if ('lte' in cond) return row[key] != null && row[key] <= cond.lte;
    }
    return row[key] === cond;
  });
}
function table(rows) {
  return {
    rows,
    findMany: async ({ where, take }) => rows.filter((r) => matches(r, where)).slice(0, take),
    findFirst: async ({ where }) => rows.find((r) => matches(r, where)) ?? null,
    updateMany: async ({ where, data }) => {
      const hit = rows.filter((r) => matches(r, where));
      for (const r of hit) Object.assign(r, data);
      return { count: hit.length };
    },
  };
}
const config = { get: (_k, d) => d };

test('AC-2: two dispatchers reading the same pending event send it once', async () => {
  const events = table([{ id: 'e1', workspaceId: 'w', eventType: 'candidate.assessment_requested', payload: {}, status: 'pending', attempt: 0, createdAt: new Date(), nextAttemptAt: null, leaseToken: null, leaseUntil: null }]);
  let posts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { posts++; await new Promise((r) => setTimeout(r, 20)); return new Response('{}'); };
  try {
    const db = { screeningOutboxEvent: events };
    await Promise.all([new InterviewHandoffDispatcherService(db, config).tick(), new InterviewHandoffDispatcherService(db, config).tick()]);
    assert.equal(posts, 1);
    assert.equal(events.rows[0].status, 'dispatched');
  } finally {
    globalThis.fetch = original;
  }
});

test('AC-2: an event left sending by a dispatcher that died is sent again once its lease runs out, not before', async () => {
  const row = { id: 'e1', workspaceId: 'w', eventType: 'candidate.assessment_requested', payload: {}, status: 'sending', attempt: 0, createdAt: new Date(), nextAttemptAt: null, leaseToken: 'dead', leaseUntil: new Date(Date.now() + 30_000) };
  const events = table([row]);
  let posts = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { posts++; return new Response('{}'); };
  try {
    const dispatcher = new InterviewHandoffDispatcherService({ screeningOutboxEvent: events }, config);
    await dispatcher.tick();
    assert.equal(posts, 0, 'still leased');
    row.leaseUntil = new Date(Date.now() - 1);
    await dispatcher.tick();
    assert.deepEqual([posts, row.status, row.leaseToken], [1, 'dispatched', null]);
  } finally {
    globalThis.fetch = original;
  }
});

test('AC-1: a match worker whose lease ran out does not overwrite the result of the worker that took over', async () => {
  const job = { id: 'j1', workspaceId: 'w', candidateId: 'c1', type: 'auto_match', status: 'running', leaseToken: 'old', input: {} };
  const db = { processingJob: table([job]), candidate: { findFirst: async () => null } };
  const svc = new DiscoveryService(db, {});
  // The first worker reads its job, then stalls; meanwhile the lease lapses and a second worker finishes it.
  const realFindFirst = db.processingJob.findFirst;
  db.processingJob.findFirst = async (args) => {
    const found = await realFindFirst(args);
    Object.assign(job, { leaseToken: 'new', status: 'succeeded' });
    return found;
  };
  await svc.processClaimedMatchJob('j1', 'old');
  assert.deepEqual([job.status, job.leaseToken], ['succeeded', 'new'], 'the stale worker’s failure was not written');
});

test('AC-1: a parse worker whose lease ran out keeps nothing: its profile transaction is abandoned and no failure is written', async () => {
  const job = { id: 'p1', workspaceId: 'w', type: 'resume_parse', status: 'running', leaseToken: 'old', attempt: 1, materialId: 'm1', candidateId: 'c1', resumeVersionId: 'r1', input: {} };
  const writes = [];
  const db = {
    processingJob: table([job]),
    material: { findUnique: async () => ({ id: 'm1', readStatus: 'available', segments: [], text: 'x', name: 'cv' }) },
    candidate: { findUnique: async () => ({ id: 'c1', displayName: 'N', email: null, phone: null }), update: async () => writes.push('candidate') },
    candidateProfile: { findFirst: async () => null, create: async ({ data }) => { writes.push('profile'); return { id: 'prof', ...data }; } },
    resumeVersion: { update: async () => writes.push('resume'), updateMany: async () => writes.push('resume-failed') },
  };
  let committed = false;
  db.$transaction = async (fn) => { const out = await fn(db); committed = true; return out; };
  const parser = { parse: () => ({}) };
  const svc = new ProfilesService(db, parser, { isConfigured: () => false }, { enqueueAutoMatch: async () => writes.push('match') });
  svc.parseLocally = () => ({ parserVersion: 'v', displayName: 'N', sourceEntries: [], employmentHistory: [], skills: [], education: [], certifications: [], projects: [], languages: [], missingFields: [] });
  // The lease lapses and another worker claims the job after this one has read it, before it finishes.
  const realFindFirst = db.processingJob.findFirst;
  db.processingJob.findFirst = async (args) => { const found = await realFindFirst(args); job.leaseToken = 'new'; return found; };
  await svc.processClaimed('p1', 'old');
  assert.equal(committed, false, 'the transaction threw, so Postgres rolls back the profile it wrote');
  assert.ok(writes.includes('profile'), 'the worker did get as far as writing its profile');
  assert.ok(!writes.includes('match') && !writes.includes('resume-failed'));
  assert.deepEqual([job.status, job.leaseToken], ['running', 'new']);
});
