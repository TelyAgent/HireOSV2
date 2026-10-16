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

/** Enough of Prisma's where for the library query, evaluated in memory, like the database would. */
function matches(c, where) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'workspaceId') return true;
    if (key === 'AND') return cond.every((w) => matches(c, w));
    if (key === 'OR') return cond.some((w) => matches(c, w));
    if (key === 'id') return cond.in.includes(c.id);
    if (key === 'ownerId') return c.ownerId === cond;
    if (key === 'createdAt') return (!cond.gte || c.createdAt >= cond.gte) && (!cond.lt || c.createdAt < cond.lt);
    if (key === 'displayName' || key === 'email') return (c[key] ?? '').toLowerCase().includes(cond.contains.toLowerCase());
    if (key === 'resumeVersions') return cond.none ? c.resumeVersions.length === 0 : c.resumeVersions.some((v) => v.source === cond.some.source);
    throw new Error(`unexpected where key ${key}`);
  });
}
const skillNames = (c) => c.profiles[0].skills.map((s) => (typeof s === 'string' ? s : s.name).toLowerCase());
function service(list = people) {
  const queries = [];
  const db = {
    candidate: {
      findMany: async (args) => { queries.push(args); return list.filter((c) => matches(c, args.where)); },
      count: async () => list.length,
      groupBy: async () => [...new Set(list.map((c) => c.ownerId))].map((ownerId) => ({ ownerId, _count: { _all: list.filter((c) => c.ownerId === ownerId).length } })),
    },
    candidateJobRecommendation: {
      groupBy: async ({ where }) => [...new Set(recs.filter((r) => where.candidateId.in.includes(r.candidateId) && r.status === where.status).map((r) => r.candidateId))]
        .map((candidateId) => ({ candidateId, _count: { _all: recs.filter((r) => r.candidateId === candidateId && r.status === 'proposed').length } })),
    },
    resumeVersion: { groupBy: async () => ['manual_upload', 'paste', 'email'].map((source) => ({ source, _count: { _all: list.filter((c) => c.resumeVersions[0]?.source === source).length } })) },
    // The two raw queries: candidates by skill (LIKE pattern), and skill counts.
    $queryRaw: async (strings, ...values) => {
      if (strings.join('').includes('GROUP BY tag')) {
        const counts = new Map();
        for (const c of list) for (const s of new Set(c.profiles[0].skills.map((x) => (typeof x === 'string' ? x : x.name)))) counts.set(s, (counts.get(s) ?? 0) + 1);
        return [...counts].map(([value, count]) => ({ value, count: BigInt(count) }));
      }
      const pattern = values[1];
      const test = pattern.startsWith('%') ? (n) => n.includes(pattern.slice(1, -1)) : (n) => n === pattern;
      return list.filter((c) => skillNames(c).some(test)).map((c) => ({ candidateId: c.id }));
    },
  };
  const discovery = { getMatchingStatuses: async (_w, ids) => new Map(ids.filter((id) => runs[id]).map((id) => [id, runs[id]])) };
  const candidates = new CandidatesService(db, {}, discovery);
  const lib = new LibraryService(db, candidates, discovery);
  lib.queries = queries;
  return lib;
}
const ids = (list) => list.items.map((row) => row.candidate.id);

test('#171 AC-1: searching a tag finds the candidates who have it; the count matches the rows', async () => {
  const list = await service().list(identity, { q: 'SQL' });
  assert.deepEqual(ids(list), ['c-nina', 'c-mai'], 'SQL and PostgreSQL (a partial tag word)');
  assert.equal(list.matched, 2);
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
  assert.ok(all.facets.tags.some((f) => f.value === 'SQL' && f.count === 1));
  assert.deepEqual(all.facets.owners, [{ value: 'hr-1', count: 2 }, { value: 'hr-2', count: 2 }]);
});

test('#172 AC-2: filters combine as an intersection, with count and empty result matching', async () => {
  const s = service();
  assert.deepEqual(ids(await s.list(identity, { owner: 'hr-1', addedFrom: '2026-10-05' })), ['c-li']);
  assert.deepEqual(ids(await s.list(identity, { q: 'sql', owner: 'hr-2' })), ['c-mai']);
  const none = await s.list(identity, { tag: 'Java', source: 'paste' });
  assert.deepEqual(ids(none), []);
  assert.equal(none.matched, 0);
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

test('#171 (review): search runs in the database, so the 1,001st candidate is found; only the page is limited', async () => {
  const many = Array.from({ length: 1200 }, (_, i) => person(`c-${i}`, `Person ${i}`, `p${i}@example.com`, i === 1100 ? ['Rust'] : ['Java'], 'paste', 'hr-1', new Date(Date.UTC(2026, 0, 1) + (1200 - i) * 60000).toISOString()));
  const s = service(many);
  assert.deepEqual(ids(await s.list(identity, { q: 'Person 1100' })), ['c-1100']);
  assert.deepEqual(ids(await s.list(identity, { q: 'rust' })), ['c-1100']);
  const all = await s.list(identity, { limit: '50' });
  assert.deepEqual([all.items.length, all.matched, all.total], [50, 1200, 1200]);
  assert.ok(s.queries.every((q) => q.take === undefined), 'no query caps the candidates searched');
  await assert.rejects(s.list(identity, { limit: '5000' }), (e) => e.getStatus() === 422);
});
