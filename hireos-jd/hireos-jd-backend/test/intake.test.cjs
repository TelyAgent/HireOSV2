const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');

test('intake: a JD becomes a Core job + structured draft only once AI has read it; the same JD is deduplicated', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const schema = `jd_intake_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const setupDb = new PrismaClient();
  await setupDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
    const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) await setupDb.$executeRawUnsafe(statement);
  }

  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { DraftsService } = require('../dist/drafts/drafts.service');
  const { IntakeService } = require('../dist/intake/intake.service');
  const { NotFoundException, ServiceUnavailableException } = require('@nestjs/common');
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user' };
  // Core Record stand-in: idempotent createJob by key, role versions kept in memory.
  const jobs = new Map(); const byKey = new Map(); const roles = new Map();
  const core = {
    async createJob(_identity, body, key) {
      if (byKey.has(key)) return jobs.get(byKey.get(key));
      const job = { id: randomUUID(), status: 'draft', openings: 1, version: 1, ...body };
      jobs.set(job.id, job); byKey.set(key, job.id); return job;
    },
    async getJob(_identity, id) { if (!jobs.has(id)) throw new NotFoundException({ code: 'NOT_FOUND' }); return jobs.get(id); },
    async createRoleVersion(_identity, jobId) { const role = { id: randomUUID(), jobId, versionNo: 1, status: 'draft' }; roles.set(role.id, role); return role; },
    async getRoleVersion(_identity, _jobId, id) { return roles.get(id); },
    async updateRoleVersion(_identity, _jobId, id) { return roles.get(id); },
  };
  // AI stand-in: `llmMode` picks what the next completion does.
  let llmMode = 'ok'; let llmCalls = 0;
  const llm = {
    async completeJson(_system, turns) {
      llmCalls++;
      if (llmMode === 'not-configured') throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED' });
      if (llmMode === 'broken') return '{ not json';
      if (llmMode === 'nothing') return JSON.stringify({ reply: '没有识别到岗位信息', phase: 'intake', fields: {}, missingFields: [] });
      if (llmMode === 'no-title') return JSON.stringify({ reply: '...', phase: 'intake', missingFields: ['title'], fields: { responsibilities: ['Do things'] } });
      assert.match(turns[0].content, /粘贴的 JD 文案/);
      return JSON.stringify({ reply: '已读取', phase: 'ready_to_confirm', missingFields: [], fields: {
        title: '全栈工程师', department: '招聘平台研发部', location: '上海', employmentType: '全职', headcount: 2,
        roleSummary: 'Owns the hiring platform end to end.',
        responsibilities: ['Build the web app', 'Run the APIs'], mustHave: ['5+ years full stack', 'TypeScript'], niceToHave: ['Kafka'],
      } });
    },
  };
  const db = new PrismaService(); await db.$connect();
  const drafts = new DraftsService(db, core);
  const intake = new IntakeService(db, core, drafts, llm, { jdFileExtractSystemPrompt: 'prompt' });
  const post = (body, key = randomUUID()) => intake.createJob(identity, body, { idempotencyKey: key, sourceService: 'interview' });
  // A label-style first line: the title must come from the model, not the first line.
  const jdText = '职位名称：全栈工程师\n招聘平台研发部 · 上海\n\n负责招聘平台的前后端开发。\n\n任职要求：5 年以上全栈经验。';
  try {
    let first;
    await t.test('creates the Core job from the fields AI extracted, with the structured draft', async () => {
      first = await post({ text: jdText });
      assert.equal(first.duplicate, false); assert.equal(first.title, '全栈工程师');
      const job = jobs.get(first.coreJobId);
      assert.deepEqual([job.title, job.team, job.location, job.employmentType, job.openings], ['全栈工程师', '招聘平台研发部', '上海', '全职', 2]);
      const draft = await drafts.current(identity, first.coreJobId);
      assert.equal(draft.revision, 1); assert.equal(draft.origin, 'external_import');
      assert.equal(draft.roleSummary, 'Owns the hiring platform end to end.');
      assert.deepEqual(draft.responsibilities, ['Build the web app', 'Run the APIs']);
      assert.deepEqual(draft.requirements.map((r) => [r.label, r.priority, r.hard]), [['5+ years full stack', 'must_have', true], ['TypeScript', 'must_have', true], ['Kafka', 'preferred', false]]);
      assert.deepEqual(draft.sourceRefs, [{ kind: 'subsystem_intake', service: 'interview' }]);
      assert.equal(draft.sourceText, jdText, 'the raw text is the authoritative JD until a person edits');
      assert.equal(await db.jobDocument.count({ where: { workspaceId: identity.workspaceId } }), 0, 'the JD editor builds its document from the structured draft');
      const run = await db.aiRun.findFirst({ where: { workspaceId: identity.workspaceId, capabilityCode: 'jd_intake_extract' } });
      assert.equal(run.status, 'Succeeded');
    });
    await t.test('a person editing the draft afterwards takes over from the raw text', async () => {
      await drafts.updateCurrent(identity, first.coreJobId, { roleSummary: 'Edited by HR' }, { idempotencyKey: randomUUID() });
      const draft = await drafts.current(identity, first.coreJobId);
      assert.equal(draft.roleSummary, 'Edited by HR'); assert.equal(draft.sourceText, null);
    });
    await t.test('the same JD (whitespace aside) resolves to the existing job without another AI call', async () => {
      const calls = llmCalls;
      const again = await post({ text: jdText.replace(/\n\n/g, '\n \n  ') + '  ' });
      assert.equal(again.coreJobId, first.coreJobId); assert.equal(again.duplicate, true);
      assert.equal(llmCalls, calls); assert.equal(jobs.size, 1);
    });
    await t.test('a job deleted in Core Record no longer counts as a duplicate', async () => {
      jobs.delete(first.coreJobId);
      const fresh = await post({ text: jdText });
      assert.notEqual(fresh.coreJobId, first.coreJobId); assert.equal(fresh.duplicate, false);
    });
    await t.test('nothing is created when AI is unavailable, returns bad output, or finds no job / no title', async () => {
      const before = jobs.size;
      llmMode = 'not-configured';
      await assert.rejects(post({ text: 'Role A\n\nDo A.' }), (e) => e.getStatus() === 503 && e.response.code === 'AI_NOT_CONFIGURED');
      llmMode = 'broken';
      await assert.rejects(post({ text: 'Role B\n\nDo B.' }), (e) => e.getStatus() === 503 && e.response.code === 'LLM_INVALID_OUTPUT');
      llmMode = 'nothing';
      await assert.rejects(post({ text: 'asdf qwer' }), (e) => e.getStatus() === 422 && e.response.code === 'JD_NOT_RECOGNIZED');
      llmMode = 'no-title';
      await assert.rejects(post({ text: 'Do things all day.' }), (e) => e.response.code === 'JD_NOT_RECOGNIZED');
      llmMode = 'ok';
      assert.equal(jobs.size, before, 'no Core job'); 
      assert.equal(await db.jdSource.count({ where: { workspaceId: identity.workspaceId, text: { in: ['Role A\n\nDo A.', 'Role B\n\nDo B.', 'asdf qwer', 'Do things all day.'] } } }), 0, 'no source either');
      const failed = await db.aiRun.count({ where: { workspaceId: identity.workspaceId, capabilityCode: 'jd_intake_extract', status: 'Failed' } });
      assert.equal(failed, 2);
    });
    await t.test('validation: empty text, unknown fields and a missing idempotency key are rejected', async () => {
      // ZodError -> 422 INVALID_SCHEMA through the global ZodExceptionFilter (see zod-exception.test.cjs).
      await assert.rejects(post({ text: '   ' }), (e) => e.name === 'ZodError');
      await assert.rejects(post({ text: 'x', extra: 1 }), (e) => e.name === 'ZodError');
      await assert.rejects(intake.createJob(identity, { text: 'Another role' }, {}), (e) => e.getStatus() === 400);
    });
    await t.test('#178: preview reads the JD without creating anything; create right after reuses that reading with the confirmed title and team', async () => {
      const text = `Platform role ${randomUUID()}\n负责招聘平台的前后端开发。`;
      llmMode = 'ok';
      const [jobsBefore, callsBefore] = [jobs.size, llmCalls];
      const preview = await intake.previewJob(identity, { text });
      assert.deepEqual(preview, { title: '全栈工程师', team: '招聘平台研发部', location: '上海', duplicateOf: null });
      assert.equal(jobs.size, jobsBefore, 'nothing is created by a preview');
      assert.equal(llmCalls, callsBefore + 1);
      const created = await post({ text, title: 'Senior Full-stack Engineer', team: 'Platform Engineering' });
      assert.equal(llmCalls, callsBefore + 1, 'creating right after the preview does not ask the model again');
      const job = jobs.get(created.coreJobId);
      assert.deepEqual([job.title, job.team, job.location], ['Senior Full-stack Engineer', 'Platform Engineering', '上海'], 'what the recruiter confirmed wins; the rest is the reading');
      const again = await intake.previewJob(identity, { text });
      assert.deepEqual(again.duplicateOf, { coreJobId: created.coreJobId, title: 'Senior Full-stack Engineer' }, 'the same JD points at the job it created');
    });
  } finally {
    await db.$disconnect();
    await setupDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await setupDb.$disconnect();
  }
});
