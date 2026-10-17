// #171 #172 #174 -- Resume Library search and filters, now SQL (#413), against a real Postgres (a throwaway schema
// per run): search covers name, shown email and tags; every filter works alone and combined; counts and paging
// come from the database. Results are newest first.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WS = 'ws-1';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: [] };
const ids = (list) => list.items.map((row) => row.candidate.id);

test('Resume Library search and filters in the database', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `screening_libdb_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { LibraryService } = require('../dist/library/library.service');
  const { CandidatesService } = require('../dist/library/candidates.service');
  const { DiscoveryService } = require('../dist/discovery/discovery.service');
  const db = new PrismaService();
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').split(';').filter((s) => s.trim());
      for (const statement of statements) await db.$executeRawUnsafe(statement);
    }
    const profile = (candidateId, displayName, skills, version = 1, contact) => ({
      workspaceId: WS, candidateId, version, displayName, sourceEntries: [], resumeVersionRefs: [], employmentHistory: [], skills, education: [],
      certifications: [], projects: [], location: {}, workAuthorization: {}, languages: [], missingFields: [], corrections: [], ...(contact ? { contact } : {}),
    });
    const person = async (id, name, email, skills, source, ownerId, createdAt) => {
      await db.candidate.create({ data: { id, workspaceId: WS, displayName: name, email, ownerId, createdAt: new Date(createdAt) } });
      await db.candidateProfile.create({ data: profile(id, name, skills) });
      if (source) {
        const material = await db.material.create({ data: { workspaceId: WS, name: `${id}.pdf`, mime: 'application/pdf', size: 1, hash: randomUUID(), text: 'x', segments: [] } });
        await db.resumeVersion.create({ data: { workspaceId: WS, candidateId: id, materialId: material.id, version: 1, parseStatus: 'succeeded', source } });
      }
    };
    await person('c-nina', 'Nina Torres', 'nina@example.com', ['SQL', 'Python'], 'manual_upload', 'hr-1', '2026-10-01');
    await person('c-mai', 'Mai Tran', 'mai@example.com', [{ name: 'PostgreSQL' }, { name: 'Tableau' }], 'paste', 'hr-2', '2026-10-10');
    await person('c-li', 'Li Chen', 'li.chen@example.com', ['Java'], 'email', 'hr-1', '2026-10-15');
    await person('c-ana', 'Ana Silva', null, [], null, 'hr-2', '2026-10-16');
    const job = (id) => db.job.create({ data: { id, workspaceId: WS, title: id, team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', status: 'open' } });
    await job('j-1');
    await job('j-2');
    const link = (candidateId, jobId) => db.application.create({ data: { workspaceId: WS, candidateId, jobId, linkedBy: 'hr-1', linkReason: 'r', cycleId: randomUUID() } });
    await link('c-nina', 'j-1');
    await link('c-nina', 'j-2');
    await link('c-nina', 'j-2'); // a second cycle on the same job counts once
    await link('c-mai', 'j-1');
    await db.jobDiscoveryRun.create({ data: { workspaceId: WS, candidateId: 'c-nina', status: 'recommendations_ready' } });
    await db.jobDiscoveryRun.create({ data: { workspaceId: WS, candidateId: 'c-mai', status: 'no_match', reason: { message: 'No current open role met the matching threshold.' } } });
    await db.processingJob.create({ data: { workspaceId: WS, type: 'job_discovery_match', input: {}, candidateId: 'c-li', status: 'queued' } });
    const ev = await db.preLinkMatchEvaluation.create({ data: { workspaceId: WS, candidateId: 'c-li', jobId: 'j-1', criteriaVersion: 1, status: 'completed', coverage: 0.5, rationale: 'r', gaps: [], evidence: [] } });
    await db.candidateJobRecommendation.create({ data: { workspaceId: WS, candidateId: 'c-li', jobId: 'j-1', prelinkEvaluationId: ev.id, confidence: 0.5, rationale: 'r', gaps: [], status: 'proposed' } });

    const discovery = new DiscoveryService(db, {});
    const s = new LibraryService(db, new CandidatesService(db, {}, discovery), discovery);

    await t.test('#171 AC-1: searching a tag finds the candidates who have it; the count matches the rows', async () => {
      const list = await s.list(identity, { q: 'SQL' });
      assert.deepEqual(ids(list), ['c-mai', 'c-nina'], 'SQL and PostgreSQL (a partial tag word)');
      assert.equal(list.matched, 2);
      assert.equal(list.total, 4);
    });

    await t.test('#171 AC-2: case and partial words match name, email or tag; a query matching nothing is truly empty', async () => {
      assert.deepEqual(ids(await s.list(identity, { q: 'sql' })), ['c-mai', 'c-nina']);
      assert.deepEqual(ids(await s.list(identity, { q: 'tablea' })), ['c-mai']);
      assert.deepEqual(ids(await s.list(identity, { q: 'LI.CHEN@' })), ['c-li']);
      assert.deepEqual(ids(await s.list(identity, { q: 'torr' })), ['c-nina']);
      assert.deepEqual(ids(await s.list(identity, { q: 'kubernetes' })), []);
      assert.deepEqual(ids(await s.list(identity, { q: '%' })), [], 'a % in the search is the character, not a wildcard');
    });

    await t.test('#172 AC-1: each filter works on its own', async () => {
      assert.deepEqual(ids(await s.list(identity, { tag: 'python' })), ['c-nina']);
      assert.deepEqual(ids(await s.list(identity, { source: 'paste' })), ['c-mai']);
      assert.deepEqual(ids(await s.list(identity, { source: 'structured_entry' })), ['c-ana']);
      assert.deepEqual(ids(await s.list(identity, { owner: 'hr-2' })), ['c-ana', 'c-mai']);
      assert.deepEqual(ids(await s.list(identity, { matchStatus: 'no_match' })), ['c-mai']);
      assert.deepEqual(ids(await s.list(identity, { matchStatus: 'running' })), ['c-li'], 'queued match job: running, though one is proposed');
      assert.deepEqual(ids(await s.list(identity, { matchStatus: 'not_started' })), ['c-ana']);
      assert.deepEqual(ids(await s.list(identity, { addedFrom: '2026-10-10', addedTo: '2026-10-15' })), ['c-li', 'c-mai']);
      const all = await s.list(identity, {});
      assert.deepEqual(all.facets.sources.map((f) => f.value).sort(), ['email', 'manual_upload', 'paste', 'structured_entry']);
      assert.ok(all.facets.tags.some((f) => f.value === 'SQL' && f.count === 1));
      assert.deepEqual(all.facets.owners, [{ value: 'hr-1', count: 2 }, { value: 'hr-2', count: 2 }]);
    });

    await t.test('#172 AC-2: filters combine as an intersection, with count and empty result matching', async () => {
      assert.deepEqual(ids(await s.list(identity, { owner: 'hr-1', addedFrom: '2026-10-05' })), ['c-li']);
      assert.deepEqual(ids(await s.list(identity, { q: 'sql', owner: 'hr-2' })), ['c-mai']);
      const none = await s.list(identity, { tag: 'Java', source: 'paste' });
      assert.deepEqual([ids(none), none.matched, none.total], [[], 0, 4]);
    });

    await t.test('#174: linked roles are counted per distinct job and kept apart from the match status', async () => {
      const rows = Object.fromEntries((await s.list(identity, {})).items.map((row) => [row.candidate.id, row]));
      assert.deepEqual([rows['c-nina'].linkedRoleCount, rows['c-mai'].linkedRoleCount, rows['c-li'].linkedRoleCount], [2, 1, 0]);
      assert.equal(rows['c-nina'].matchStatus, 'recommendations_handled');
      assert.equal(rows['c-mai'].matchReason, 'No current open role met the matching threshold.');
    });

    await t.test('#171 (review): email search finds the email the list shows — the latest profile\'s, not the record\'s first one', async () => {
      await db.candidate.create({ data: { id: 'c-moved', workspaceId: WS, displayName: 'Mai Tran', email: 'old@example.test', ownerId: 'hr-1', createdAt: new Date('2026-10-12') } });
      await db.candidateProfile.create({ data: profile('c-moved', 'Mai Tran', ['SQL'], 1) });
      await db.candidateProfile.create({ data: profile('c-moved', 'Mai Tran', ['SQL'], 2, { email: 'new@example.test', phone: null }) });
      assert.deepEqual(ids(await s.list(identity, { q: 'new@example' })), ['c-moved']);
      assert.deepEqual(ids(await s.list(identity, { q: 'old@example' })), [], 'the replaced address is no longer what the list shows');
      assert.deepEqual(ids(await s.list(identity, { q: 'nina@' })), ['c-nina'], 'versions without a contact still match the record');
      await db.candidate.delete({ where: { id: 'c-moved' } });
    });

    await t.test('#171 (review) #413: search and paging run in the database, so the 1,101st candidate is found; only the page is limited', async () => {
      const base = Date.UTC(2026, 0, 1);
      const many = Array.from({ length: 1200 }, (_, i) => ({ id: `m-${i}`, workspaceId: 'ws-many', displayName: `Person ${i}`, email: `p${i}@example.com`, ownerId: 'hr-1', createdAt: new Date(base + (1200 - i) * 60000) }));
      await db.candidate.createMany({ data: many });
      await db.candidateProfile.createMany({ data: many.map((c, i) => ({ ...profile(c.id, c.displayName, i === 1100 ? ['Rust'] : ['Java']), workspaceId: 'ws-many' })) });
      const other = { workspaceId: 'ws-many', actorId: 'hr-1', roles: [] };
      assert.deepEqual(ids(await s.list(other, { q: 'Person 1100' })), ['m-1100']);
      assert.deepEqual(ids(await s.list(other, { q: 'rust' })), ['m-1100']);
      const first = await s.list(other, { limit: '50' });
      assert.deepEqual([first.items.length, first.matched, first.total], [50, 1200, 1200]);
      const page12 = await s.list(other, { offset: '1100', limit: '100' });
      assert.deepEqual([page12.items.length, page12.items[0].candidate.id, page12.matched], [100, 'm-1100', 1200]);
      assert.equal((await s.list(other, { offset: '1150', limit: '100' })).items.length, 50);
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
