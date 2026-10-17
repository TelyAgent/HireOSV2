// #414 -- the jobs list's funnels counted in Postgres equal the in-memory count of #141 on the same rows, against
// a real Postgres (a throwaway schema per run): candidates across jobs, repeat evaluations, every recommendation
// status, applications, several résumé versions (latest or not, uploaded today or before), and empty jobs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WS = 'ws-funnels';

/** The rows the list used to read, counted the way it used to (jobs.service before #414). */
async function inMemory(db, computeJobFunnels, jobIds, startOfToday) {
  const [evaluations, recs, applications] = await Promise.all([
    db.preLinkMatchEvaluation.findMany({ where: { workspaceId: WS, jobId: { in: jobIds } }, distinct: ['candidateId', 'jobId'], select: { candidateId: true, jobId: true } }),
    db.candidateJobRecommendation.findMany({ where: { workspaceId: WS, jobId: { in: jobIds }, status: { in: ['proposed', 'deferred', 'confirmed'] } }, select: { candidateId: true, jobId: true, status: true } }),
    db.application.findMany({ where: { workspaceId: WS, jobId: { in: jobIds } }, select: { candidateId: true, jobId: true } }),
  ]);
  const ids = [...new Set([...evaluations, ...recs, ...applications].map((r) => r.candidateId))];
  const versions = await db.resumeVersion.findMany({ where: { workspaceId: WS, candidateId: { in: ids } }, select: { candidateId: true, isLatest: true, version: true, uploadedAt: true, material: { select: { sourceType: true } } } });
  const info = new Map();
  for (const v of versions) {
    const prev = info.get(v.candidateId);
    const today = (prev?.today ?? false) || v.uploadedAt >= startOfToday;
    const better = !prev || (v.isLatest && !prev.isLatest) || (v.isLatest === prev.isLatest && v.version > prev.version);
    info.set(v.candidateId, better ? { source: v.material?.sourceType || 'manual_upload', version: v.version, isLatest: v.isLatest, today } : { ...prev, today });
  }
  return computeJobFunnels(jobIds, evaluations, recs, applications, info);
}

test('funnels in SQL equal the in-memory count (#414)', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `screening_funnels_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { aggregateJobFunnels, computeJobFunnels } = require('../dist/jobs/job-funnels');
  const db = new PrismaService();
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').split(';').filter((s) => s.trim());
      for (const statement of statements) await db.$executeRawUnsafe(statement);
    }

    // A fixed pseudo-random sequence, so a failure reproduces.
    let seed = 414;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const startOfToday = new Date('2026-10-17T00:00:00Z');
    const jobs = [];
    for (let j = 0; j < 8; j++) {
      jobs.push(await db.job.create({ data: { workspaceId: WS, title: `Job ${j}`, team: 'T', location: 'L', employmentType: 'Full-time', seniority: 'Mid', status: 'open' } }));
    }
    const sources = ['manual_upload', 'email_import', 'bulk_upload', ''];
    for (let c = 0; c < 60; c++) {
      const cand = await db.candidate.create({ data: { workspaceId: WS, displayName: `C${c}`, ownerId: 'hr-1' } });
      const versions = Math.floor(rand() * 4); // 0..3 résumé versions; some candidates have none
      const latestIndex = rand() < 0.2 ? -1 : versions - 1; // sometimes no version is marked latest
      for (let v = 0; v < versions; v++) {
        const material = await db.material.create({ data: { workspaceId: WS, name: `cv-${c}-${v}`, mime: 'text/plain', size: 1, hash: randomUUID(), text: 'x', segments: [], sourceType: pick(sources) } });
        await db.resumeVersion.create({ data: {
          workspaceId: WS, candidateId: cand.id, materialId: material.id, version: v + 1, parseStatus: 'succeeded', isLatest: v === latestIndex,
          uploadedAt: rand() < 0.3 ? new Date(startOfToday.getTime() + 3_600_000) : new Date(startOfToday.getTime() - 86_400_000 * (1 + v)),
        } });
      }
      for (const job of jobs.slice(0, 6)) { // the last two jobs stay empty
        const roll = rand();
        if (roll < 0.45) continue;
        let evaluationId = null;
        for (let e = 0; e < (rand() < 0.3 ? 2 : 1); e++) {
          const ev = await db.preLinkMatchEvaluation.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, criteriaVersion: 1, status: 'completed', coverage: 0.5, rationale: 'r', gaps: [], evidence: [] } });
          evaluationId = ev.id;
        }
        if (rand() < 0.6) {
          await db.candidateJobRecommendation.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, prelinkEvaluationId: evaluationId, confidence: 0.5, rationale: 'r', gaps: [], status: pick(['proposed', 'deferred', 'confirmed', 'rejected', 'expired']) } });
        }
        if (rand() < 0.3) {
          await db.application.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, linkedBy: 'hr-1', linkReason: 'r', cycleId: randomUUID() } });
        }
      }
    }
    // Rows in another workspace never count.
    await db.application.create({ data: { workspaceId: 'ws-other', candidateId: (await db.candidate.findFirst()).id, jobId: jobs[0].id, linkedBy: 'x', linkReason: 'r', cycleId: 'other' } });

    const jobIds = jobs.map((j) => j.id);
    const sql = await aggregateJobFunnels(db, WS, jobIds, startOfToday);
    const memory = await inMemory(db, computeJobFunnels, jobIds, startOfToday);
    for (const id of jobIds) assert.deepEqual(sql.get(id), memory.get(id), `job ${jobs.findIndex((j) => j.id === id)}`);
    const totals = [...sql.values()].reduce((acc, f) => ({ resumes: acc.resumes + f.resumes, linked: acc.linked + f.linked, pending: acc.pending + f.pending, today: acc.today + f.today }), { resumes: 0, linked: 0, pending: 0, today: 0 });
    assert.ok(totals.resumes > 50 && totals.linked > 5 && totals.pending > 5 && totals.today > 5, `the fixture exercises every figure: ${JSON.stringify(totals)}`);
    assert.deepEqual(sql.get(jobIds[7]), { resumes: 0, matched: 0, linked: 0, pending: 0, today: 0, sources: [] });
    assert.deepEqual(await aggregateJobFunnels(db, WS, [], startOfToday), new Map());
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
