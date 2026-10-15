// #96 -- jobs published before JD versions existed get one v1 "migration baseline", once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fixture = require('./fixtures/baseline-blocks.json');
const { draftToBlocks } = require('../dist/drafts/baseline-blocks');
const { VersionsService, MIGRATION_ACTOR } = require('../dist/drafts/versions.service');
const { run } = require('../dist/scripts/backfill-jd-baseline');

const WS = 'ws-1';
const identity = { workspaceId: WS, actorId: MIGRATION_ACTOR, roles: [], kind: 'service' };
const SAVED_BLOCKS = [{ id: 'b1', kind: 'h2', text: 'Ops Lead', level: 'public' }, { id: 'b2', kind: 'p', text: 'Runs ops.', level: 'public' }];
const DRAFT = { ...fixture.draft, revision: 2 };

/** In-memory stand-in for the Prisma calls the migration makes. */
function memoryDb() {
  const state = { documents: [], versions: [], drafts: [], codes: [] };
  const match = (where) => (row) => Object.entries(where).every(([k, v]) => row[k] === v);
  const db = {
    state,
    jobDocumentVersion: {
      findFirst: async ({ where }) => state.versions.find(match(where)) ?? null,
      findMany: async ({ where }) => state.versions.filter(match(where)),
      create: async ({ data }) => {
        if (state.versions.some((v) => v.workspaceId === data.workspaceId && v.jobId === data.jobId && v.versionNo === data.versionNo)) {
          const { Prisma } = require('@prisma/client');
          throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' });
        }
        const row = { id: randomUUID(), publishedAt: new Date(), ...data };
        state.versions.push(row);
        return row;
      },
      delete: async ({ where }) => { state.versions = state.versions.filter((v) => v.id !== where.id); },
    },
    jobDocument: {
      findUnique: async ({ where }) => state.documents.find(match(where.workspaceId_jobId_audience)) ?? null,
      findMany: async () => state.documents.map(({ workspaceId, jobId }) => ({ workspaceId, jobId })),
      create: async ({ data }) => { state.documents.push({ meta: null, ...data }); return data; },
      deleteMany: async ({ where }) => { state.documents = state.documents.filter((d) => !match(where)(d)); },
    },
    jobDraft: {
      findFirst: async ({ where }) => state.drafts.filter(match(where)).sort((a, b) => b.revision - a.revision)[0] ?? null,
      findMany: async () => state.drafts.map(({ workspaceId, jobId }) => ({ workspaceId, jobId })),
    },
    jdCode: {
      findUnique: async ({ where }) => state.codes.find(match(where.workspaceId_jobId)) ?? null,
      findFirst: async () => state.codes[state.codes.length - 1] ?? null,
      create: async ({ data }) => { state.codes.push(data); return data; },
    },
  };
  db.locks = [];
  db.$executeRaw = async (strings, ...values) => { db.locks.push(values[0]); await db.onLock?.(); return 1; };
  db.$transaction = async (fn) => fn(db);
  return db;
}

function setup(jobs) {
  const db = memoryDb();
  const core = { getJob: async (_identity, jobId) => jobs[jobId] };
  return { db, versions: new VersionsService(db, core) };
}

test('#96 AC-1: a published job with a saved document and no version gets exactly one v1; running again adds nothing', async () => {
  const { db, versions } = setup({ 'job-a': { id: 'job-a', title: 'Ops Lead', status: 'open' } });
  db.state.documents.push({ workspaceId: WS, jobId: 'job-a', audience: 'internal', blocks: SAVED_BLOCKS, revision: 3, updatedBy: 'hr-1', meta: { values: { level: 'Senior' }, shown: ['level'] } });

  assert.deepEqual(await versions.backfillBaseline(identity, 'job-a', { apply: true }), { jobId: 'job-a', result: 'created', source: 'saved_document' });
  assert.deepEqual(await versions.backfillBaseline(identity, 'job-a', { apply: true }), { jobId: 'job-a', result: 'has_versions' });

  assert.equal(db.state.versions.length, 1);
  const v1 = db.state.versions[0];
  assert.equal(v1.versionNo, 1);
  assert.match(v1.code, /^JD-\d{4}-0001@v1$/);
  assert.deepEqual(v1.blocks, SAVED_BLOCKS, 'v1 is the saved document as it is at migration time');
  assert.deepEqual(v1.meta.values, { level: 'Senior' });
  assert.equal(db.state.documents.length, 1, 'the saved document is left as it is');
});

test('#96 AC-2: without a saved document, v1 is the document the draft shows, saved too; marked as a baseline, nothing invented', async () => {
  const { db, versions } = setup({ [fixture.jobId]: { id: fixture.jobId, title: fixture.title, status: 'open' } });
  db.state.drafts.push({ workspaceId: WS, jobId: fixture.jobId, ...DRAFT });

  const outcome = await versions.backfillBaseline(identity, fixture.jobId, { apply: true });
  assert.deepEqual(outcome, { jobId: fixture.jobId, result: 'created', source: 'draft' });
  const v1 = db.state.versions[0];
  assert.deepEqual(v1.blocks, fixture.blocks, 'the same blocks the editor builds from this draft');
  assert.deepEqual(db.state.documents[0].blocks, fixture.blocks, 'the editor now opens exactly v1');
  assert.equal(v1.meta.baseline.kind, 'migration_baseline');
  assert.equal(v1.meta.baseline.source, 'draft');
  assert.equal(v1.meta.baseline.originalPublishedAt, null);
  assert.equal(v1.meta.baseline.originalApproval, null);
  assert.equal(v1.publishedBy, MIGRATION_ACTOR, 'no approver or publisher is made up');
  assert.match(v1.note, /迁移基线.*未知/);
  assert.deepEqual(draftToBlocks(fixture.title, fixture.draft, fixture.jobId), fixture.blocks);
});

test('#96 AC-3: jobs that already have versions, and jobs that are not published, are left untouched', async () => {
  const { NotFoundException } = require('@nestjs/common');
  const { db, versions } = setup({
    'job-v': { id: 'job-v', title: 'Has v2', status: 'open' },
    'job-d': { id: 'job-d', title: 'Still a draft', status: 'draft' },
  });
  db.state.versions.push({ id: 'x', workspaceId: WS, jobId: 'job-v', versionNo: 2, blocks: SAVED_BLOCKS, publishedBy: 'hr-1' });
  db.state.drafts.push({ workspaceId: WS, jobId: 'job-v', ...DRAFT }, { workspaceId: WS, jobId: 'job-d', ...DRAFT });

  assert.equal((await versions.backfillBaseline(identity, 'job-v', { apply: true })).result, 'has_versions');
  assert.equal((await versions.backfillBaseline(identity, 'job-d', { apply: true })).result, 'not_published');
  // A job deleted in Core whose draft rows remain here is reported, not an error.
  db.state.drafts.push({ workspaceId: WS, jobId: 'job-gone', ...DRAFT });
  versions.core.getJob = async (_i, jobId) => { if (jobId === 'job-gone') throw new NotFoundException(); return { id: jobId, status: 'open' }; };
  assert.equal((await versions.backfillBaseline(identity, 'job-gone', { apply: true })).result, 'job_not_found');
  assert.deepEqual(db.state.versions.map((v) => [v.jobId, v.versionNo]), [['job-v', 2]]);
  assert.equal(db.state.documents.length, 0);
});

test('#96: the script dry-runs by default, then applies, then rolls back only baseline v1s still alone', async () => {
  const { db, versions } = setup({
    'job-a': { id: 'job-a', title: 'Ops Lead', status: 'open' },
    'job-b': { id: 'job-b', title: 'Growth Lead', status: 'open' },
    'job-c': { id: 'job-c', title: 'Draft only', status: 'draft' },
  });
  db.state.documents.push({ workspaceId: WS, jobId: 'job-a', audience: 'internal', blocks: SAVED_BLOCKS, revision: 3, updatedBy: 'hr-1', meta: null });
  db.state.drafts.push({ workspaceId: WS, jobId: 'job-b', ...DRAFT }, { workspaceId: WS, jobId: 'job-c', ...DRAFT });

  const dry = await run(db, versions, 'dry-run');
  assert.deepEqual(dry.summary, { would_create: 2, not_published: 1 });
  assert.equal(db.state.versions.length, 0, 'a dry run writes nothing');

  assert.deepEqual((await run(db, versions, 'apply')).summary, { created: 2, not_published: 1 });
  assert.deepEqual((await run(db, versions, 'apply')).summary, { has_versions: 2, not_published: 1 });

  // job-a was published again after the migration: its baseline stays, it is history now.
  db.state.versions.push({ id: 'v2', workspaceId: WS, jobId: 'job-a', versionNo: 2, blocks: SAVED_BLOCKS, publishedBy: 'hr-1' });
  const rollback = await run(db, versions, 'rollback');
  assert.deepEqual(Object.fromEntries(rollback.results.map((r) => [r.jobId, r.result])), { 'job-a': 'kept', 'job-b': 'removed', 'job-c': 'none' });
  assert.deepEqual(db.state.versions.map((v) => [v.jobId, v.versionNo]).sort(), [['job-a', 1], ['job-a', 2]]);
  assert.deepEqual(db.state.documents.map((d) => d.jobId), ['job-a'], 'the document saved from job-b’s draft is removed with its v1');
});

test('#96 review: a Publish that lands before rollback gets the lock keeps the baseline', async () => {
  const { db, versions } = setup({ 'job-a': { id: 'job-a', title: 'Ops Lead', status: 'open' } });
  db.state.documents.push({ workspaceId: WS, jobId: 'job-a', audience: 'internal', blocks: SAVED_BLOCKS, revision: 3, updatedBy: 'hr-1', meta: null });
  await versions.backfillBaseline(identity, 'job-a', { apply: true });

  // v2 is published while rollback waits for the job's version lock.
  db.onLock = () => {
    db.onLock = null;
    db.state.versions.push({ id: 'v2', workspaceId: WS, jobId: 'job-a', versionNo: 2, blocks: SAVED_BLOCKS, publishedBy: 'hr-1' });
  };
  assert.equal(await versions.rollbackBaseline(identity, 'job-a'), 'kept');
  assert.deepEqual(db.state.versions.map((v) => v.versionNo).sort(), [1, 2]);
  assert.ok(db.locks.every((key) => key === `jd-versions:${WS}:job-a`), 'publish, backfill and rollback share one lock per job');
});

test('#96 review: a Publish that lands before the backfill gets the lock means no baseline is added', async () => {
  const { db, versions } = setup({ 'job-a': { id: 'job-a', title: 'Ops Lead', status: 'open' } });
  db.state.documents.push({ workspaceId: WS, jobId: 'job-a', audience: 'internal', blocks: SAVED_BLOCKS, revision: 3, updatedBy: 'hr-1', meta: null });
  db.onLock = () => {
    db.onLock = null;
    db.state.versions.push({ id: 'v1', workspaceId: WS, jobId: 'job-a', versionNo: 1, blocks: SAVED_BLOCKS, publishedBy: 'hr-1' });
  };
  assert.equal((await versions.backfillBaseline(identity, 'job-a', { apply: true })).result, 'has_versions');
  assert.deepEqual(db.state.versions.map((v) => v.publishedBy), ['hr-1']);
});
