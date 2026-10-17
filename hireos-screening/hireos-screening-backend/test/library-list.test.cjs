// #174 #176 -- the Resume Library rows: match status and linked roles are separate, the source is returned as
// stored, and bad filters are refused. Searching and filtering are SQL since #413 and are tested against a real
// Postgres in library-db.test.cjs; here the database returns the page in newest-first order.
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

function service(list = people) {
  const queries = [];
  const db = {
    candidate: {
      findMany: async (args) => { queries.push(args); return list.filter((c) => args.where.id.in.includes(c.id)); },
      count: async () => list.length,
      groupBy: async () => [...new Set(list.map((c) => c.ownerId))].map((ownerId) => ({ ownerId, _count: { _all: list.filter((c) => c.ownerId === ownerId).length } })),
    },
    candidateJobRecommendation: {
      groupBy: async ({ where }) => [...new Set(recs.filter((r) => where.candidateId.in.includes(r.candidateId) && r.status === where.status).map((r) => r.candidateId))]
        .map((candidateId) => ({ candidateId, _count: { _all: recs.filter((r) => r.candidateId === candidateId && r.status === 'proposed').length } })),
    },
    resumeVersion: { groupBy: async () => ['manual_upload', 'paste', 'email'].map((source) => ({ source, _count: { _all: list.filter((c) => c.resumeVersions[0]?.source === source).length } })) },
    // The page of ids, the count, and the skill counts: no filters are used here.
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join('?');
      if (sql.includes('GROUP BY tag')) {
        const counts = new Map();
        for (const c of list) for (const s of new Set(c.profiles[0].skills.map((x) => (typeof x === 'string' ? x : x.name)))) counts.set(s, (counts.get(s) ?? 0) + 1);
        return [...counts].map(([value, count]) => ({ value, count: BigInt(count) }));
      }
      if (sql.includes('count(*)')) return [{ count: BigInt(list.length) }];
      const [limit, offset] = values.slice(-2);
      return [...list].sort((a, b) => b.createdAt - a.createdAt).slice(offset, offset + limit).map((c) => ({ id: c.id }));
    },
  };
  const discovery = { getMatchingStatuses: async (_w, ids) => new Map(ids.filter((id) => runs[id]).map((id) => [id, runs[id]])) };
  const candidates = new CandidatesService(db, {}, discovery);
  const lib = new LibraryService(db, candidates, discovery);
  lib.queries = queries;
  return lib;
}
const ids = (list) => list.items.map((row) => row.candidate.id);

test('#172 AC-2: a filter value the list does not know is refused with 422', async () => {
  const s = service();
  await assert.rejects(s.list(identity, { matchStatus: 'linked' }), (e) => e.getStatus() === 422);
  await assert.rejects(s.list(identity, { addedFrom: '16/10/2026' }), (e) => e.getStatus() === 422);
  await assert.rejects(s.list(identity, { limit: '5000' }), (e) => e.getStatus() === 422);
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

