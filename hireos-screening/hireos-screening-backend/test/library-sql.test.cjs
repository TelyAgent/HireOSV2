// #413 -- the Resume Library filtered, counted and paged in Postgres, against a real Postgres (a throwaway schema
// per run). The reference is each candidate judged on its own in JS by the same rules (latest profile's skills
// and email, latest résumé source, owner, date added) with the match status from matchStatusesOf(), as before.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WS = 'ws-library';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: ['hr'] };

test('library filters in SQL equal judging each candidate (#413)', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `screening_library_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { LibraryService, MATCH_STATUSES } = require('../dist/library/library.service');
  const { DiscoveryService } = require('../dist/discovery/discovery.service');
  const db = new PrismaService();
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').split(';').filter((s) => s.trim());
      for (const statement of statements) await db.$executeRawUnsafe(statement);
    }
    let seed = 413;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const skillsPool = ['React', 'Go', 'PostgreSQL', 'Product 50%_off', 'Figma', 'Kubernetes'];
    const job = await db.job.create({ data: { workspaceId: WS, title: 'J', team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', status: 'open' } });
    const truth = [];
    for (let i = 0; i < 70; i++) {
      const createdAt = new Date(Date.UTC(2026, 9, 1 + (i % 15), 23, 30, i)); // 23:30 UTC: the next day in Shanghai
      const name = pick(['Ann Lee', 'Bob Wu', 'Chen Hao', 'Dana', '王小明']) + ` ${i}`;
      const email = rand() < 0.7 ? `${name.split(' ')[0].toLowerCase()}${i}@${pick(['acme.com', 'example.org'])}` : null;
      const cand = await db.candidate.create({ data: { workspaceId: WS, displayName: name, ownerId: pick(['hr-1', 'hr-2', 'hr-3']), email, createdAt } });
      const t = { id: cand.id, name, email, ownerId: cand.ownerId, createdAt, skills: [], profileEmail: undefined, source: null };
      const profiles = Math.floor(rand() * 3);
      for (let v = 1; v <= profiles; v++) {
        const skills = skillsPool.filter(() => rand() < 0.35).map((s) => (rand() < 0.5 ? { name: s } : s));
        const contact = rand() < 0.3 ? null : { email: rand() < 0.5 ? `alt${i}@other.net` : null, phone: null };
        await db.candidateProfile.create({ data: { workspaceId: WS, candidateId: cand.id, version: v, displayName: name, sourceEntries: [], resumeVersionRefs: [], employmentHistory: [], skills, education: [], certifications: [], projects: [], location: {}, workAuthorization: {}, languages: [], missingFields: [], corrections: [], ...(contact ? { contact } : {}) } });
        if (v === profiles) { t.skills = skills.map((s) => (typeof s === 'string' ? s : s.name)); t.profileEmail = contact === null ? undefined : (contact.email ?? ''); }
      }
      const versions = Math.floor(rand() * 3);
      for (let v = 1; v <= versions; v++) {
        const material = await db.material.create({ data: { workspaceId: WS, name: `cv${i}-${v}`, mime: 'text/plain', size: 1, hash: randomUUID(), text: 'x', segments: [] } });
        const source = pick(['manual_upload', 'email_import', 'bulk_upload']);
        await db.resumeVersion.create({ data: { workspaceId: WS, candidateId: cand.id, materialId: material.id, version: v, parseStatus: 'succeeded', isLatest: v === versions, source } });
        if (v === versions) t.source = source;
      }
      if (rand() < 0.15) await db.processingJob.create({ data: { workspaceId: WS, type: 'job_discovery_match', input: {}, candidateId: cand.id, status: pick(['queued', 'running', 'succeeded']) } });
      if (rand() < 0.3) {
        const ev = await db.preLinkMatchEvaluation.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, criteriaVersion: 1, status: 'completed', coverage: 0.5, rationale: 'r', gaps: [], evidence: [] } });
        await db.candidateJobRecommendation.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, prelinkEvaluationId: ev.id, confidence: 0.5, rationale: 'r', gaps: [], status: pick(['proposed', 'confirmed', 'rejected']) } });
      }
      for (let r = 0; r < Math.floor(rand() * 3); r++) {
        await db.jobDiscoveryRun.create({ data: { workspaceId: WS, candidateId: cand.id, status: pick(['recommendations_ready', 'no_match', 'no_open_jobs', 'insufficient_data', 'failed', 'running']), createdAt: new Date(Date.UTC(2026, 9, 10, 0, r)) } });
      }
      truth.push(t);
    }
    const library = new LibraryService(db, { toFrontendCandidate: (c) => ({ id: c.id }) }, new DiscoveryService(db, {}));
    const statuses = await library.matchStatusesOf(WS, truth.map((x) => x.id));
    for (const x of truth) x.matchStatus = statuses.get(x.id).matchStatus;

    const shownEmail = (x) => (x.profileEmail === undefined ? x.email ?? '' : x.profileEmail);
    const has = (text, needle) => text.toLowerCase().includes(needle.toLowerCase());
    const judge = (f) => (x) => (!f.q || has(x.name, f.q) || has(shownEmail(x), f.q) || x.skills.some((s) => has(s, f.q)))
      && (!f.tag || x.skills.some((s) => s.toLowerCase() === f.tag.toLowerCase()))
      && (!f.source || (f.source === 'structured_entry' ? x.source === null : x.source === f.source))
      && (!f.owner || x.ownerId === f.owner)
      && (!f.addedFrom || x.createdAt >= new Date(`${f.addedFrom}T00:00:00Z`))
      && (!f.addedTo || x.createdAt < new Date(new Date(`${f.addedTo}T00:00:00Z`).getTime() + 86_400_000))
      && (!f.matchStatus || x.matchStatus === f.matchStatus);
    const newestFirst = (a, b) => b.createdAt - a.createdAt || (a.id < b.id ? 1 : -1);

    const cases = [{}, { q: 'chen' }, { q: 'acme' }, { q: 'other.net' }, { q: 'react' }, { q: '50%_' }, { tag: 'go' }, { tag: 'product 50%_off' },
      { source: 'email_import' }, { source: 'structured_entry' }, { owner: 'hr-2' }, { addedFrom: '2026-10-05', addedTo: '2026-10-09' },
      ...MATCH_STATUSES.map((matchStatus) => ({ matchStatus })), { q: 'a', matchStatus: 'not_started', owner: 'hr-1' }];
    let nonEmpty = 0;
    for (const f of cases) {
      const expected = truth.filter(judge(f)).sort(newestFirst).map((x) => x.id);
      if (expected.length) nonEmpty++;
      const page1 = await library.list(identity, { ...f, limit: '7' });
      const page2 = await library.list(identity, { ...f, limit: '7', offset: '7' });
      assert.equal(page1.matched, expected.length, JSON.stringify(f));
      assert.deepEqual([...page1.items, ...page2.items].map((x) => x.candidate.id), expected.slice(0, 14), JSON.stringify(f));
      assert.equal(page1.total, 70);
      for (const item of page1.items) assert.equal(item.matchStatus, truth.find((x) => x.id === item.candidate.id).matchStatus);
    }
    assert.ok(nonEmpty >= cases.length - 4, `most filters match someone (${nonEmpty}/${cases.length})`);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
