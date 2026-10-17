const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
try { process.loadEnvFile('.env'); } catch {}

test('#365 immutable question versions', { skip: !process.env.DATABASE_URL && 'DATABASE_URL not set' }, async t => {
  const schema = `versions_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { QuestionsService } = require('../dist/questions/questions.service');
  const { PlanItemsService } = require('../dist/plan-items/plan-items.service');
  const { InvitationsService } = require('../dist/invitations/invitations.service');
  const { CaseLifecycleService } = require('../dist/cases/case-lifecycle.service');
  const db = new PrismaService();
  const other = new PrismaService();
  const who = { workspaceId: 'versions-ws', actorId: 'author', roles: ['hr'], kind: 'user' };
  const A = new QuestionsService(db);
  const B = new QuestionsService(other);
  const plans = new PlanItemsService(db);
  const input = { title: 'Versioned question', prompt: 'Original prompt', roles: ['Engineer'], competencies: [{ name: 'Design', fraction: 1 }] };
  const code = expected => e => e.getResponse?.().code === expected;
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      if (folder === '20261017210000_question_versions') {
        await db.$executeRawUnsafe(`INSERT INTO "Question" (id,"workspaceId",code,title,prompt,roles,competencies,version,status,"updatedAt") VALUES ('legacy','versions-ws','Q-0001','Legacy','Current surviving text','["Engineer"]','[{"name":"Design","fraction":1}]',7,'published',CURRENT_TIMESTAMP)`);
      }
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    }
    await t.test('migration preserves only surviving published version without invented audit', async () => {
      const versions = await A.versions(who, 'legacy');
      assert.equal(versions.length, 1);
      assert.equal(versions[0].version, 7);
      assert.equal(versions[0].content.prompt, 'Current surviving text');
      assert.equal(versions[0].historicalBaseline, true);
      assert.equal(versions[0].publishedBy, null);
      assert.equal(versions[0].publishedAt, null);
    });
    const candidate = await db.candidate.create({ data: { workspaceId: who.workspaceId, coreCandidateId: 'test-candidate', name: 'Test' } });
    const job = await db.job.create({ data: { workspaceId: who.workspaceId, coreJobId: 'test-job', title: 'Engineer' } });
    const kase = await db.case.create({ data: { workspaceId: who.workspaceId, candidateId: candidate.id, jobId: job.id } });
    const q = await A.create(who, { ...input, status: 'published' });
    const planInput = { kind: 'written', bankQuestionId: q.id, bankQuestionVersion: 1, questionCode: q.code, questionTitle: 'Forged title', questionPrompt: 'Forged prompt' };
    await t.test('creation cannot bypass draft; plan requires a published version', async () => {
      assert.equal(q.status, 'draft_review');
      assert.equal(q.version, 0);
      await assert.rejects(plans.create(who, kase.id, planInput), code('QUESTION_NOT_PUBLISHED'));
      await assert.rejects(plans.create(who, kase.id, { ...planInput, bankQuestionId: undefined }), code('QUESTION_VERSION_REQUIRED'));
      await assert.rejects(A.publish(who, q.id, undefined), code('QUESTION_REVISION_REQUIRED'));
    });
    await t.test('concurrent publish returns one version and one replay with actor/time', async () => {
      const results = await Promise.all([A.publish(who, q.id, 1), B.publish(who, q.id, 1)]);
      assert.deepEqual(results.map(r => r.replayed).sort(), [false, true]);
      assert.ok(results.every(r => r.question.version === 1));
      const versions = await A.versions(who, q.id);
      assert.equal(versions.length, 1);
      assert.equal(versions[0].publishedBy, who.actorId);
      assert.ok(versions[0].publishedAt instanceof Date);
    });
    const plan = await plans.create(who, kase.id, planInput);
    assert.equal(plan.questionTitle, input.title);
    assert.equal(plan.questionPrompt, input.prompt);
    assert.ok(plan.bankQuestionVersionId);
    const config = { get: (_key, fallback) => fallback };
    const mail = { senderAccount: async () => null, sendFromWorkspaceAccount: async () => ({ sent: true }) };
    const invites = new InvitationsService(db, mail, config, {}, new CaseLifecycleService(db, config));
    const invitation = await invites.create(who, kase.id, { questions: [{ questionId: plan.id, code: plan.questionCode, title: plan.questionTitle, prompt: plan.questionPrompt, competencies: plan.competencies }], mode: 'deadline_only', deadline: new Date(Date.now() + 86400000).toISOString(), disclosurePolicy: 'score_and_summary', recipientEmail: 'synthetic@example.test' });
    const frozenInvite = await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } });
    await t.test('concurrent edits reject stale writer; old plan and invitation survive republish', async () => {
      const results = await Promise.allSettled([A.update(who, q.id, { prompt: 'Revised A', expectedRevision: 1 }), B.update(who, q.id, { prompt: 'Revised B', expectedRevision: 1 })]);
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(results.find(r => r.status === 'rejected').reason.getResponse().code, 'QUESTION_VERSION_CONFLICT');
      const draft = await A.get(who, q.id);
      assert.equal(draft.revision, 2);
      assert.equal(draft.status, 'draft_review');
      await assert.rejects(A.publish(who, q.id, 1), code('QUESTION_VERSION_CONFLICT'));
      await A.publish(who, q.id, 2);
      const versions = await A.versions(who, q.id);
      assert.deepEqual(versions.map(v => v.version), [2, 1]);
      assert.equal(versions[1].content.prompt, input.prompt);
      assert.equal(versions[0].content.prompt, draft.prompt);
      assert.equal((await db.planItem.findUniqueOrThrow({ where: { id: plan.id } })).questionPrompt, input.prompt);
      assert.deepEqual((await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).questions, frozenInvite.questions);
      assert.deepEqual((await invites.getPublic(invitation.token)).questions, frozenInvite.questions);
      const nextCandidate = await db.candidate.create({ data: { workspaceId: who.workspaceId, coreCandidateId: 'next-candidate', name: 'Next' } });
      const newCase = await db.case.create({ data: { workspaceId: who.workspaceId, candidateId: nextCandidate.id, jobId: job.id } });
      await assert.rejects(plans.create(who, newCase.id, planInput), code('QUESTION_VERSION_CONFLICT'));
      const selected = await plans.create(who, newCase.id, { ...planInput, bankQuestionVersion: 2 });
      assert.equal(selected.questionPrompt, draft.prompt);
    });
    await t.test('favorite does not draft; invalid publication and foreign workspace fail closed', async () => {
      const favorite = await A.update(who, q.id, { favorite: true });
      assert.equal(favorite.status, 'published');
      assert.equal(favorite.revision, 2);
      const invalid = await A.create(who, { ...input, competencies: [{ name: 'Design', fraction: 0.5 }] });
      await assert.rejects(A.publish(who, invalid.id, 1), code('QUESTION_NOT_PUBLISHABLE'));
      assert.equal((await A.get(who, invalid.id)).version, 0);
      assert.equal((await A.versions(who, invalid.id)).length, 0);
      for (const operation of ['get', 'versions', 'publish', 'remove']) await assert.rejects(A[operation]({ ...who, workspaceId: 'foreign' }, q.id, 2), code('QUESTION_NOT_FOUND'));
    });
    await t.test('snapshot write failure rolls publication back completely', async () => {
      const draft = await A.create(who, input);
      const failing = new QuestionsService({ $transaction: fn => db.$transaction(tx => fn(new Proxy(tx, {
        get(target, key) { return key === 'questionVersion' ? { ...target.questionVersion, create: async () => { throw new Error('injected snapshot failure'); } } : target[key]; },
      }))) });
      await assert.rejects(failing.publish(who, draft.id, 1), /injected snapshot failure/);
      assert.equal((await A.get(who, draft.id)).status, 'draft_review');
      assert.equal((await A.get(who, draft.id)).version, 0);
      assert.equal((await A.versions(who, draft.id)).length, 0);
      assert.equal((await A.publish(who, draft.id, 1)).question.version, 1);
    });
    await t.test('#368 deprecates once, refuses new plans, preserves invitation, requires a new draft/version', async () => {
      const results = await Promise.all([A.deprecate(who, q.id, 2), B.deprecate({ ...who, actorId: 'other-author' }, q.id, 2)]);
      assert.deepEqual(results.map(r => r.replayed).sort(), [false, true]);
      const event = results.find(r => !r.replayed).event;
      assert.ok(event.createdAt instanceof Date);
      assert.equal(event.version, 2);
      assert.deepEqual((await A.deprecations(who, q.id)).map(e => e.id), [event.id]);
      const nextCandidate = await db.candidate.create({ data: { workspaceId: who.workspaceId, coreCandidateId: 'deprecation-candidate', name: 'Next' } });
      const nextCase = await db.case.create({ data: { workspaceId: who.workspaceId, candidateId: nextCandidate.id, jobId: job.id } });
      await assert.rejects(plans.create(who, nextCase.id, { ...planInput, bankQuestionVersion: 2 }), code('QUESTION_NOT_PUBLISHED'));
      await assert.rejects(A.publish(who, q.id, 2), code('QUESTION_NOT_DRAFT'));
      assert.deepEqual((await invites.getPublic(invitation.token)).questions, frozenInvite.questions);
      for (const method of ['deprecate', 'deprecations']) await assert.rejects(A[method]({ ...who, workspaceId: 'foreign' }, q.id, 2), code('QUESTION_NOT_FOUND'));
      await A.update(who, q.id, { prompt: 'Revised after deprecation', expectedRevision: 2 });
      await assert.rejects(A.deprecate(who, q.id, 2), code('QUESTION_VERSION_CONFLICT'));
      await assert.rejects(A.deprecate(who, q.id, 3), code('QUESTION_NOT_PUBLISHED'));
      await A.publish(who, q.id, 3);
      assert.equal((await plans.create(who, nextCase.id, { ...planInput, bankQuestionVersion: 3 })).questionPrompt, 'Revised after deprecation');
      assert.deepEqual(await db.questionDeprecation.findUniqueOrThrow({ where: { id: event.id } }), event);
      assert.deepEqual((await invites.getPublic(invitation.token)).questions, frozenInvite.questions);
    });
    await t.test('#368 audit failure rolls deprecation back; missing revision is rejected', async () => {
      const draft = await A.create(who, input);
      await A.publish(who, draft.id, 1);
      await assert.rejects(A.deprecate(who, draft.id, undefined), code('QUESTION_REVISION_REQUIRED'));
      const failing = new QuestionsService({ $transaction: fn => db.$transaction(tx => fn(new Proxy(tx, {
        get(target, key) { return key === 'questionDeprecation' ? { ...target.questionDeprecation, create: async () => { throw new Error('injected audit failure'); } } : target[key]; },
      }))) });
      await assert.rejects(failing.deprecate(who, draft.id, 1), /injected audit failure/);
      assert.equal((await A.get(who, draft.id)).status, 'published');
      assert.equal((await A.deprecations(who, draft.id)).length, 0);
    });
    await t.test('soft deletion retains immutable versions and invitation contents', async () => {
      await A.remove(who, q.id);
      await assert.rejects(A.get(who, q.id), code('QUESTION_NOT_FOUND'));
      assert.equal(await db.questionVersion.count({ where: { questionId: q.id } }), 3);
      assert.deepEqual((await db.invitation.findUniqueOrThrow({ where: { id: invitation.id } })).questions, frozenInvite.questions);
    });
  } finally {
    await other.$disconnect();
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
