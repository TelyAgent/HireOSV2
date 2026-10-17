// #412 -- My Tasks a page at a time, against a real Postgres (a throwaway schema per run): pages never repeat or
// skip a task, ties on createdAt included, and the stats count every task, not just the loaded pages.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');

try {
  process.loadEnvFile('.env');
} catch {
  // no .env (CI) — DATABASE_URL is already in the environment
}

const WS = 'ws-pages';
const identity = { workspaceId: WS, actorId: 'hr-1', roles: ['hr'], kind: 'user' };

test('task pages and stats (#412)', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async (t) => {
  const schema = `written_pages_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  // The suite runs test files side by side against one Postgres: wait longer for a connection than the 10 s default.
  url.searchParams.set('connection_limit', '10');
  url.searchParams.set('pool_timeout', '60');
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { TasksService } = require('../dist/tasks/tasks.service');
  const db = new PrismaService();
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      const statements = sql.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n').split(';').filter((s) => s.trim());
      for (const statement of statements) await db.$executeRawUnsafe(statement);
    }
    const job = await db.job.create({ data: { workspaceId: WS, coreJobId: 'cj-1', title: 'PM' } });
    const sameInstant = new Date('2026-10-17T02:00:00Z');
    const caseStatuses = ['linked', 'invited', 'invited', 'submitted', 'handed_off'];
    const day = { from: '2026-10-16T16:00:00.000Z', to: '2026-10-17T16:00:00.000Z' };
    for (let i = 0; i < 23; i++) {
      const cand = await db.candidate.create({ data: { workspaceId: WS, coreCandidateId: `cc-${i}`, name: `C${i}` } });
      const kase = await db.case.create({ data: { workspaceId: WS, candidateId: cand.id, jobId: job.id, status: caseStatuses[i % 5] } });
      await db.task.create({ data: {
        workspaceId: WS, caseId: kase.id, title: `Task ${i}`,
        // Ten tasks share one createdAt, so the cursor has to break ties.
        createdAt: i < 10 ? sameInstant : new Date(sameInstant.getTime() + i * 1000),
        assignee: i % 2 ? 'hr-1' : 'hr-2',
        status: ['open', 'in_progress', 'waiting', 'completed'][i % 4],
        type: i % 3 ? 'invite_pending' : 'evaluation_review',
        dueAt: i % 4 === 1 ? new Date('2026-10-17T08:00:00Z') : i % 4 === 3 ? new Date('2026-10-18T08:00:00Z') : null,
      } });
    }
    // One task in another workspace that must never show up.
    const other = await db.candidate.create({ data: { workspaceId: 'ws-other', coreCandidateId: 'cc-x', name: 'X' } });
    const otherJob = await db.job.create({ data: { workspaceId: 'ws-other', coreJobId: 'cj-x', title: 'X' } });
    const otherCase = await db.case.create({ data: { workspaceId: 'ws-other', candidateId: other.id, jobId: otherJob.id } });
    await db.task.create({ data: { workspaceId: 'ws-other', caseId: otherCase.id, title: 'Other' } });

    const service = new TasksService(db, { listJobs: async () => [] });

    await t.test('AC-1: pages of 5 cover all 23 tasks once each, newest first, then end', async () => {
      const seen = [];
      let cursor;
      let pages = 0;
      do {
        const page = await service.list(identity, { limit: '5', ...(cursor ? { cursor } : {}) });
        assert.ok(page.items.length <= 5);
        seen.push(...page.items);
        cursor = page.nextCursor;
        pages++;
      } while (cursor);
      assert.equal(pages, 5);
      assert.equal(seen.length, 23);
      assert.equal(new Set(seen.map((x) => x.id)).size, 23);
      const keys = seen.map((x) => [x.createdAt, x.id]);
      const sorted = [...keys].sort((a, b) => (a[0] === b[0] ? (a[1] < b[1] ? 1 : -1) : a[0] < b[0] ? 1 : -1));
      assert.deepEqual(keys, sorted);
    });

    await t.test('AC-1: the default page is 50; a bad limit or cursor is 422 INVALID_SCHEMA', async () => {
      assert.equal((await service.list(identity)).items.length, 23);
      for (const query of [{ limit: '0' }, { limit: '201' }, { cursor: 'not-a-cursor' }, { page: '2' }]) {
        await assert.rejects(service.list(identity, query), (e) => e.getStatus() === 422 && e.getResponse().code === 'INVALID_SCHEMA', JSON.stringify(query));
      }
    });

    await t.test('AC-2: the stats equal counting every task', async () => {
      const all = (await service.list(identity, { limit: '200' })).items;
      const stats = await service.stats(identity, { assignee: 'hr-1', dueFrom: day.from, dueTo: day.to });
      assert.ok(stats.assignee.dueInRange > 0 && stats.assignee.reviewsAwaiting > 0, 'the fixture exercises every figure');
      const raw = await db.task.findMany({ where: { workspaceId: WS } });
      const mine = raw.filter((x) => x.assignee === 'hr-1');
      assert.equal(stats.total, 23);
      assert.deepEqual(stats.byCaseStatus, all.reduce((acc, x) => ({ ...acc, [x.caseStatus]: (acc[x.caseStatus] ?? 0) + 1 }), {}));
      assert.deepEqual(stats.assignee, {
        open: mine.filter((x) => ['open', 'in_progress', 'waiting'].includes(x.status)).length,
        inProgress: mine.filter((x) => x.status === 'in_progress').length,
        reviewsAwaiting: mine.filter((x) => ['evaluation_review', 'result_release'].includes(x.type) && x.status !== 'completed').length,
        dueInRange: mine.filter((x) => x.dueAt && x.dueAt >= new Date(day.from) && x.dueAt < new Date(day.to)).length,
      });
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
