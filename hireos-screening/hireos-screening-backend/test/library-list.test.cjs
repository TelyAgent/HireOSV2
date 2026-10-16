// #171 #172 #174 #176 -- the Resume Library list: search covers name, email and tags; every filter works alone
// and combined (an intersection); the total is the whole library; match status and linked roles are separate;
// the source is returned as stored.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { LibraryService } = require('../dist/library/library.service');
const { CandidatesService } = require('../dist/library/candidates.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const person = (id, name, email, skills, source, ownerId, createdAt, applications = []) => ({
  id, displayName: name, identityStatus: 'provisional', email, phone: null, ownerId, createdAt: new Date(createdAt), lastMatchedAt: null, retention: 'standard',
  libraryEntry: null, applications,
  profiles: [{ displayName: name, dataStatus: 'complete', parseStatus: 'succeeded', location: null, workAuthorization: null, skills, education: [], employmentHistory: [], compensationExpectation: null, missingFields: [] }],
  resumeVersions: source ? [{ source, material: { name: `${id}.pdf` } }] : [],
});
const people = [
  person('c-nina', 'Nina Torres', 'nina@example.com', ['SQL', 'Python'], 'manual_upload', 'hr-1', '2026-10-01', [{ jobId: 'j-1', status: 'active' }, { jobId: 'j-2', status: 'active' }, { jobId: 'j-2', status: 'active' }]),
  person('c-mai', 'Mai Tran', 'mai@example.com', [{ name: 'PostgreSQL' }, { name: 'Tableau' }], 'paste', 'hr-2', '2026-10-10', [{ jobId: 'j-1', status: 'active' }]),
  person('c-li', 'Li Chen', 'li.chen@example.com', ['Java'], 'email', 'hr-1', '2026-10-15'),
  person('c-ana', 'Ana Silva', null, [], null, 'hr-2', '2026-10-16'),
];
const runs = {
  'c-nina': { isMatching: false, lastRun: { status: 'recommendations_ready', reason: null } },
  'c-mai': { isMatching: false, lastRun: { status: 'no_match', reason: { message: 'No current open role met the matching threshold.' } } },
  'c-li': { isMatching: true, lastRun: null },
};
const recs = [{ candidateId: 'c-li', status: 'proposed' }];
function service() {
  const db = {
    candidate: { findMany: async () => people },
    candidateJobRecommendation: { findMany: async () => recs },
  };
  const discovery = { getMatchingStatuses: async (_w, ids) => new Map(ids.filter((id) => runs[id]).map((id) => [id, runs[id]])) };
  const candidates = new CandidatesService(db, {}, discovery);
  return new LibraryService(db, candidates, discovery);
}
const ids = (list) => list.items.map((row) => row.candidate.id);

test('#171 AC-1: searching a tag finds the candidates who have it; the count matches the rows', async () => {
  const list = await service().list(identity, { q: 'SQL' });
  assert.deepEqual(ids(list), ['c-nina', 'c-mai'], 'SQL and PostgreSQL (a partial tag word)');
  assert.equal(list.total, 4);
});

test('#171 AC-2: case and partial words match name, email or tag; a query matching nothing is truly empty', async () => {
  const s = service();
  assert.deepEqual(ids(await s.list(identity, { q: 'sql' })), ['c-nina', 'c-mai']);
  assert.deepEqual(ids(await s.list(identity, { q: 'tablea' })), ['c-mai']);
  assert.deepEqual(ids(await s.list(identity, { q: 'LI.CHEN@' })), ['c-li']);
  assert.deepEqual(ids(await s.list(identity, { q: 'torr' })), ['c-nina']);
  assert.deepEqual(ids(await s.list(identity, { q: 'kubernetes' })), []);
});

test('#172 AC-1: each filter works on its own', async () => {
  const s = service();
  assert.deepEqual(ids(await s.list(identity, { tag: 'python' })), ['c-nina']);
  assert.deepEqual(ids(await s.list(identity, { source: 'paste' })), ['c-mai']);
  assert.deepEqual(ids(await s.list(identity, { owner: 'hr-2' })), ['c-mai', 'c-ana']);
  assert.deepEqual(ids(await s.list(identity, { matchStatus: 'no_match' })), ['c-mai']);
  assert.deepEqual(ids(await s.list(identity, { addedFrom: '2026-10-10', addedTo: '2026-10-15' })), ['c-mai', 'c-li']);
  const all = await s.list(identity, {});
  assert.deepEqual(all.facets.sources.map((f) => f.value).sort(), ['email', 'manual_upload', 'paste', 'structured_entry']);
  assert.deepEqual(all.facets.owners, [{ value: 'hr-1', count: 2 }, { value: 'hr-2', count: 2 }]);
});

test('#172 AC-2: filters combine as an intersection, with count and empty result matching', async () => {
  const s = service();
  assert.deepEqual(ids(await s.list(identity, { owner: 'hr-1', addedFrom: '2026-10-05' })), ['c-li']);
  assert.deepEqual(ids(await s.list(identity, { q: 'sql', owner: 'hr-2' })), ['c-mai']);
  const none = await s.list(identity, { tag: 'Java', source: 'paste' });
  assert.deepEqual(ids(none), []);
  assert.equal(none.total, 4);
  await assert.rejects(s.list(identity, { matchStatus: 'linked' }), (e) => e.getStatus() === 422);
  await assert.rejects(s.list(identity, { addedFrom: '16/10/2026' }), (e) => e.getStatus() === 422);
});

test('#174: linked roles are counted per distinct job and kept apart from the match status', async () => {
  const rows = Object.fromEntries((await service().list(identity, {})).items.map((row) => [row.candidate.id, row]));
  assert.deepEqual([rows['c-nina'].linkedRoleCount, rows['c-mai'].linkedRoleCount, rows['c-li'].linkedRoleCount], [2, 1, 0]);
  assert.equal(rows['c-nina'].matchStatus, 'recommendations_handled', 'linked, yet the match status is still its own');
  assert.equal(rows['c-mai'].matchStatus, 'no_match');
  assert.equal(rows['c-mai'].matchReason, 'No current open role met the matching threshold.');
  assert.equal(rows['c-li'].matchStatus, 'running');
  assert.equal(rows['c-ana'].matchStatus, 'not_started');
});

test('#176 AC-2: the source is returned as stored; a candidate without a résumé file reads as manual entry', async () => {
  const rows = Object.fromEntries((await service().list(identity, {})).items.map((row) => [row.candidate.id, row]));
  assert.equal(rows['c-nina'].latestSource, 'manual_upload');
  assert.equal(rows['c-ana'].latestSource, 'structured_entry');
});
