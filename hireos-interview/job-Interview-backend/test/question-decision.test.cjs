const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readdir, readFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { RoundsService } = require('../dist/intake/rounds.service');
const { TasksService } = require('../dist/intake/tasks.service');

test('#335/#296 persisted question skips and human decision audit', async t => {
  const schema = `skip_decision_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      for (const statement of (await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8')).split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    }
    const workspaceId = 'test-workspace'; const identity = { workspaceId, actorId: 'interviewer-a' };
    const job = await db.job.create({ data: { workspaceId, createdBy: identity.actorId, title: 'Synthetic role', jdText: 'APIs' } });
    const candidate = await db.candidate.create({ data: { workspaceId, name: 'Synthetic candidate' } });
    const task = await db.interviewTask.create({ data: { workspaceId, createdBy: identity.actorId, jobId: job.id, candidateId: candidate.id, debriefConfirmedAt: new Date() } });
    const rubric = await db.rubricVersion.create({ data: { workspaceId, jobId: job.id, versionNumber: 1, status: 'confirmed' } });
    const cards = []; const questions = [];
    for (const requiredLevel of [3, 4]) {
      const card = await db.capabilityCard.create({ data: { workspaceId, rubricVersionId: rubric.id, requirement: `API level ${requiredLevel}`, requiredLevel, responsibilityType: 'lead', cardPriority: 'P0', competencyTags: 'API', expectedEvidence: 'Example', levelAnchors: {}, weight: 50, sourceRefs: [] } });
      cards.push(card);
      questions.push(await db.interviewQuestion.create({ data: { workspaceId, rubricVersionId: rubric.id, cardId: card.id, situationPrompt: `Situation ${requiredLevel}`, taskPrompt: 'Task?', actionPrompt: 'Action?', resultPrompt: 'Result?' } }));
    }
    const roundData = { workspaceId, taskId: task.id, name: 'Round', format: 'Video', duration: 30, competencies: 'API', questions: 2, mandatory: 1, notes: '', scheduledAt: new Date(), briefSnapshotRubricVersion: 1 };
    const round = await db.interviewRound.create({ data: { ...roundData, sequence: 1 } });
    const otherRound = await db.interviewRound.create({ data: { ...roundData, sequence: 2 } });
    const rounds = new RoundsService(db); const tasks = new TasksService(db);
    await t.test('#260 fill-only scheduling is atomic, workspace scoped and preserves confirmed plan content', async () => {
      await db.interviewTask.update({ where: { id: task.id }, data: { planConfirmedAt: new Date() } });
      const reviewer = await db.interviewer.create({ data: { workspaceId, name: 'Reviewer A' } });
      const reviewerB = await db.interviewer.create({ data: { workspaceId, name: 'Reviewer B' } });
      const foreign = await db.interviewer.create({ data: { workspaceId: 'other', name: 'Foreign' } });
      const scheduled = await db.interviewRound.create({ data: { ...roundData, sequence: 3, scheduledAt: null } });
      const input = { version: 1, scheduledAt: '2026-11-01T10:00:00.000Z', timezone: 'UTC', meetingLink: '' };
      await assert.rejects(rounds.schedule(identity, scheduled.id, input), e => e.getResponse().code === 'INTERVIEWER_REQUIRED');
      await assert.rejects(rounds.schedule(identity, scheduled.id, { ...input, interviewerId: foreign.id }), e => e.getResponse().code === 'INTERVIEWER_NOT_FOUND');
      await assert.rejects(rounds.schedule({ workspaceId: 'other' }, scheduled.id, { ...input, interviewerId: foreign.id }), e => e.getStatus() === 404);
      const outcomes = await Promise.allSettled([reviewer, reviewerB].map(person => rounds.schedule(identity, scheduled.id, { ...input, interviewerId: person.id })));
      assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
      const saved = await db.interviewRound.findUnique({ where: { id: scheduled.id } });
      assert.equal(saved.version, 2); assert.ok(saved.interviewerId);
      for (const field of ['name', 'format', 'duration', 'competencies', 'questions', 'mandatory', 'notes']) assert.equal(saved[field], scheduled[field]);
      const different = saved.interviewerId === reviewer.id ? reviewerB.id : reviewer.id;
      await assert.rejects(rounds.schedule(identity, scheduled.id, { ...input, version: 2, interviewerId: different }), e => e.getResponse().code === 'INTERVIEWER_ALREADY_ASSIGNED');
      await db.interviewRound.update({ where: { id: scheduled.id }, data: { interviewerId: null, completedAt: new Date() } });
      await assert.rejects(rounds.schedule(identity, scheduled.id, { ...input, version: 2, interviewerId: reviewer.id }), e => e.getResponse().code === 'ROUND_COMPLETED');
      assert.equal((await db.interviewRound.findUnique({ where: { id: scheduled.id } })).interviewerId, null);
    });
    await t.test('#287 recommendation requires a reason, persists independently, and clearing removes both', async () => {
      for (const reason of [undefined, '', '  ', 'x'.repeat(4001)]) {
        await assert.rejects(rounds.setRecommendation(identity, round.id, { recommendation: 'advance', reason }));
      }
      assert.equal((await db.interviewRound.findUnique({ where: { id: round.id } })).recommendation, null);
      await assert.rejects(rounds.setRecommendation({ workspaceId: 'other' }, round.id, { recommendation: 'advance', reason: 'Evidence' }), e => e.getStatus() === 404);
      const saved = await rounds.setRecommendation(identity, round.id, { recommendation: 'advance', reason: '  Evidence supports advancing  ' });
      assert.equal(saved.recommendationReason, 'Evidence supports advancing');
      const reloaded = await new RoundsService(db).listForTask(workspaceId, task.id);
      assert.equal(reloaded.find(r => r.id === round.id).recommendationReason, saved.recommendationReason);
      assert.equal(reloaded.find(r => r.id === otherRound.id).recommendationReason, null);
      const revised = await rounds.setRecommendation(identity, round.id, { recommendation: 'advance', reason: 'Additional evidence' });
      assert.equal(revised.recommendation, 'advance'); assert.equal(revised.recommendationReason, 'Additional evidence');
      const cleared = await rounds.setRecommendation(identity, round.id, { recommendation: null });
      assert.equal(cleared.recommendation, null); assert.equal(cleared.recommendationReason, null);
    });
    await t.test('middle and last question persist once with first actor/time; reload is isolated by round', async () => {
      const first = await rounds.skipQuestion(identity, round.id, questions[0].id);
      const retries = await Promise.all(Array.from({ length: 3 }, () => rounds.skipQuestion({ ...identity, actorId: 'other-actor' }, round.id, questions[0].id)));
      for (const retry of retries) { assert.equal(retry.id, first.id); assert.equal(retry.actorId, identity.actorId); assert.equal(retry.skippedAt.toISOString(), first.skippedAt.toISOString()); }
      await rounds.skipQuestion(identity, round.id, questions[1].id);
      const read = await new RoundsService(db).skippedQuestions(workspaceId, round.id);
      assert.equal(read.length, 2); assert.equal(read[1].snapshot.situationPrompt, questions[1].situationPrompt);
      assert.deepEqual(await rounds.skippedQuestions(workspaceId, otherRound.id), []);
      assert.equal(await db.cardScore.count(), 0, 'skip never writes a score');
    });
    await t.test('wrong workspace/question and completed/unscheduled rounds cannot gain skip records', async () => {
      await assert.rejects(rounds.skipQuestion({ ...identity, workspaceId: 'other' }, round.id, questions[0].id), e => e.getStatus() === 404);
      await assert.rejects(rounds.skippedQuestions('other', round.id), e => e.getStatus() === 404);
      await assert.rejects(rounds.skipQuestion(identity, otherRound.id, 'foreign-question'), e => e.getStatus() === 404);
      await db.interviewRound.update({ where: { id: otherRound.id }, data: { scheduledAt: null } });
      await assert.rejects(rounds.skipQuestion(identity, otherRound.id, questions[0].id), e => e.getStatus() === 409);
      await db.interviewRound.update({ where: { id: otherRound.id }, data: { scheduledAt: new Date(), completedAt: new Date(), status: 'completed' } });
      await assert.rejects(rounds.skipQuestion(identity, otherRound.id, questions[0].id), e => e.getStatus() === 409);
      assert.deepEqual(await rounds.skippedQuestions(workspaceId, otherRound.id), []);
    });
    await t.test('legacy decision has no invented audit; new reasons/version/actor survive reload and duplicate requests', async () => {
      const legacy = await tasks.decision(workspaceId, task.id);
      assert.equal(legacy.decisionBy, null); assert.equal(legacy.decisionVersion, null);
      const saved = await tasks.setDecision(identity, task.id, { decision: 'hold', reason: ' Need one more example ', version: 0 });
      assert.equal(saved.decisionReason, 'Need one more example'); assert.equal(saved.decisionBy, identity.actorId); assert.equal(saved.decisionVersion, 1);
      const replay = await tasks.setDecision(identity, task.id, { decision: 'hold', reason: 'Need one more example', version: 0 });
      assert.equal(replay.decisionVersion, 1); assert.equal(await db.revision.count({ where: { taskId: task.id } }), 1);
      const read = await new TasksService(db).decision(workspaceId, task.id);
      assert.equal(read.decisionReason, saved.decisionReason); assert.equal(read.decisionAt.toISOString(), saved.decisionAt.toISOString());
    });
    await t.test('stale and invalid writes fail; concurrent decisions do not overwrite each other', async () => {
      await assert.rejects(tasks.setDecision(identity, task.id, { decision: 'recommend_offer', reason: 'x', version: 0 }), e => e.getStatus() === 409);
      await assert.rejects(tasks.setDecision(identity, task.id, { decision: 'hold', reason: 'x'.repeat(4001) }));
      await assert.rejects(tasks.setDecision({ ...identity, workspaceId: 'other' }, task.id, { decision: 'hold' }), e => e.getStatus() === 404);
      const results = await Promise.allSettled(['Reason A', 'Reason B'].map(reason => tasks.setDecision(identity, task.id, { decision: 'hold', reason, version: 1 })));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal((await tasks.decision(workspaceId, task.id)).decisionVersion, 2);
      assert.equal(await db.revision.count({ where: { taskId: task.id } }), 2);
    });
    await t.test('audit write failure rolls back decision fields and both versions', async () => {
      const before = await db.interviewTask.findUnique({ where: { id: task.id } });
      const failingDb = new Proxy(db, { get(target, name) {
        if (name === '$transaction') return fn => db.$transaction(tx => fn(new Proxy(tx, { get(targetTx, key) {
          if (key === 'revision') return { create: async () => { throw new Error('audit unavailable'); } };
          return Reflect.get(targetTx, key);
        } })));
        return Reflect.get(target, name);
      } });
      await assert.rejects(new TasksService(failingDb).setDecision(identity, task.id, { decision: 'do_not_proceed', reason: 'Would fail', version: 2 }), /audit unavailable/);
      const after = await db.interviewTask.findUnique({ where: { id: task.id } });
      assert.deepEqual(after, before);
      assert.equal(await db.revision.count({ where: { taskId: task.id } }), 2);
    });
    await t.test('decision generation includes different required levels and snapshot citations do not follow later edits', async () => {
      for (const card of cards) await db.cardScore.create({ data: { workspaceId, roundId: round.id, cardId: card.id, score: 3, note: 'Original score note' } });
      await db.interviewRound.updateMany({ where: { taskId: task.id }, data: { status: 'completed' } });
      const generation = await tasks.generateDecisionDraft(identity, task.id);
      const source = await db.parseJob.findUnique({ where: { id: generation.id } });
      assert.match(source.input.segments[0].text, /要求等级：L3\n达标状态：达标/);
      assert.match(source.input.segments[1].text, /要求等级：L4\n达标状态：未达标/);
      await db.parseJob.update({ where: { id: source.id }, data: { status: 'needs_review', result: { conclusion: 'One requirement is below its bar.', suggestedDecision: 'request_more_evidence', citations: [{ segmentId: cards[1].id, quote: '人工评分：3' }, { segmentId: 'foreign', quote: 'invented' }] } } });
      await db.cardScore.updateMany({ where: { workspaceId }, data: { score: 5, note: 'Later note' } });
      const view = await tasks.decision(workspaceId, task.id);
      assert.match(view.citations[0].snapshot, /Original score note/); assert.doesNotMatch(view.citations[0].snapshot, /Later note/);
      assert.equal(view.citations[1].snapshot, null);
      await assert.rejects(tasks.decision('other', task.id), e => e.getStatus() === 404);
      assert.equal(view.decision, 'hold', 'AI materialization never changes the human decision');
    });
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
});
