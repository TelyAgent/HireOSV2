// #141 -- the jobs list funnel, computed by grouping each collection once: the same numbers as before for every
// case, and work that grows with the rows, not with rows × jobs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeJobFunnels } = require('../dist/jobs/job-funnels');

/** The implementation before #141, verbatim: each job filters every collection. */
function oldFunnels(jobIds, evaluations, recs, applications, resumeInfo) {
  const result = new Map();
  for (const jobId of jobIds) {
    const linked = new Set(applications.filter((a) => a.jobId === jobId).map((a) => a.candidateId));
    const jobRecs = recs.filter((r) => r.jobId === jobId);
    const matched = new Set([...linked, ...jobRecs.map((r) => r.candidateId)]);
    const pending = new Set(jobRecs.filter((r) => r.status === 'proposed' && !linked.has(r.candidateId)).map((r) => r.candidateId));
    const evaluated = evaluations.filter((e) => e.jobId === jobId).map((e) => e.candidateId);
    const pool = new Set([...evaluated, ...matched]);
    const sources = new Map();
    let today = 0;
    for (const id of pool) {
      const info = resumeInfo.get(id);
      if (!info) continue;
      sources.set(info.source, (sources.get(info.source) || 0) + 1);
      if (info.today) today++;
    }
    result.set(jobId, { resumes: pool.size, matched: matched.size, linked: linked.size, pending: pending.size, today, sources: [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })) });
  }
  return result;
}

/** Deterministic synthetic data covering the cases in AC-1. */
function fixture(jobs = 6, candidates = 40) {
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const jobIds = Array.from({ length: jobs }, (_, i) => `j${i}`);
  const evaluations = [], recs = [], applications = [];
  const resumeInfo = new Map();
  const statuses = ['proposed', 'deferred', 'confirmed'];
  for (let c = 0; c < candidates; c++) {
    const id = `c${c}`;
    if (c % 9 !== 0) resumeInfo.set(id, { source: ['manual_upload', 'email', 'paste'][c % 3], version: 1 + (c % 3), isLatest: true, today: c % 4 === 0 });
    for (const jobId of jobIds) {
      const r = rand();
      if (r < 0.5) evaluations.push({ candidateId: id, jobId });
      if (r < 0.15) evaluations.push({ candidateId: id, jobId }); // a repeated evaluation
      if (r < 0.35) recs.push({ candidateId: id, jobId, status: statuses[c % 3] });
      if (r < 0.12) applications.push({ candidateId: id, jobId }); // the same person linked to several jobs
    }
  }
  return { jobIds, evaluations, recs, applications, resumeInfo };
}

test('#141 AC-1: identical resumes / matched / linked / pending / today / sources for every job', () => {
  for (const [jobs, candidates] of [[1, 5], [6, 40], [25, 120]]) {
    const f = fixture(jobs, candidates);
    assert.deepEqual(computeJobFunnels(f.jobIds, f.evaluations, f.recs, f.applications, f.resumeInfo), oldFunnels(f.jobIds, f.evaluations, f.recs, f.applications, f.resumeInfo));
  }
  // Edge cases: no rows; a job nobody touched; a linked candidate without a résumé on record.
  assert.deepEqual(computeJobFunnels(['j'], [], [], [], new Map()), oldFunnels(['j'], [], [], [], new Map()));
  const edge = { jobIds: ['a', 'b'], evaluations: [], recs: [{ candidateId: 'x', jobId: 'a', status: 'proposed' }], applications: [{ candidateId: 'x', jobId: 'a' }, { candidateId: 'y', jobId: 'a' }], resumeInfo: new Map([['x', { source: 'email', version: 2, isLatest: true, today: true }]]) };
  assert.deepEqual(computeJobFunnels(edge.jobIds, edge.evaluations, edge.recs, edge.applications, edge.resumeInfo), oldFunnels(edge.jobIds, edge.evaluations, edge.recs, edge.applications, edge.resumeInfo));
  assert.equal(computeJobFunnels(edge.jobIds, edge.evaluations, edge.recs, edge.applications, edge.resumeInfo).get('a').pending, 0, 'linked is not pending');
});

/** Counts reads of array elements, as a deterministic measure of work (not of time). */
function counting(rows, counter) {
  return new Proxy(rows, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) counter.reads++; return Reflect.get(target, key, receiver); } });
}

test('#141 AC-2: each input row is read a fixed number of times, however many jobs there are', () => {
  for (const jobs of [5, 50]) {
    const f = fixture(jobs, 60);
    const rows = f.evaluations.length + f.recs.length + f.applications.length;
    const newWork = { reads: 0 }, oldWork = { reads: 0 };
    computeJobFunnels(f.jobIds, counting(f.evaluations, newWork), counting(f.recs, newWork), counting(f.applications, newWork), f.resumeInfo);
    oldFunnels(f.jobIds, counting(f.evaluations, oldWork), counting(f.recs, oldWork), counting(f.applications, oldWork), f.resumeInfo);
    assert.equal(newWork.reads, rows, `${jobs} jobs: one read per input row`);
    assert.ok(oldWork.reads >= rows * jobs, `${jobs} jobs: the old way reads every row once per job (${oldWork.reads})`);
  }
});
