// #65 #66 -- Quick Start drafts only from three real answers and a job title the user confirms.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { TITLE_UNCONFIRMED, parseAssessment, tooThinToAssess, followUp } = require('../dist/copilot/quick-start');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };

/** In-memory stand-in for the Prisma calls Quick Start, setFields and confirmDraft make. */
function memoryDb() {
  const conv = { id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], stateRevision: 1, createdAt: new Date(), updatedAt: new Date() };
  const messages = [];
  const keys = new Map();
  const runs = [];
  const db = {
    conv, messages, runs,
    copilotConversation: {
      findFirst: async () => conv,
      update: async ({ data }) => {
        for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v;
        conv.stateRevision += 1;
        return conv;
      },
    },
    copilotMessage: {
      findFirst: async () => messages[messages.length - 1] ?? null,
      findMany: async ({ where } = {}) =>
        messages.filter((m) => (!where?.role || m.role === where.role) && (!where?.idempotencyKey || where.idempotencyKey.in.includes(m.idempotencyKey))),
      create: async ({ data }) => { const m = { id: randomUUID(), createdAt: new Date(), attachments: null, ...data }; messages.push(m); return m; },
    },
    idempotencyKey: {
      findUnique: async ({ where }) => keys.get(where.workspaceId_operation_key.key) ?? null,
      findMany: async ({ where }) => [...keys.values()].filter((k) => k.operation === where.operation),
      create: async ({ data }) => { keys.set(data.key, { ...data, createdAt: new Date() }); return data; },
    },
    aiRun: { create: async ({ data }) => { runs.push(data); return data; } },
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

/** Fake model: the assessment, then the full draft the autotake skill would write. */
function fakeLlm(assessment) {
  const calls = [];
  return {
    calls,
    completeJson: async (system, turns) => {
      calls.push({ system, input: turns.map((t) => t.content).join('\n') });
      if (system.includes('快速开始')) return JSON.stringify(assessment);
      return JSON.stringify({
        reply: '已生成', phase: 'ready_to_confirm', missingFields: [],
        fields: { title: 'Growth Lead', roleSummary: 'Owns growth in Vietnam.', responsibilities: ['Build a local growth process', 'Run experiments'], mustHave: ['Performance marketing', 'SQL'] },
      });
    },
  };
}
function service(assessment) {
  const db = memoryDb();
  const llm = fakeLlm(assessment);
  const core = { createJob: async () => { throw new Error('a job must not be created'); } };
  return { svc: new CopilotService(db, llm, { jdAutotakeSystemPrompt: 'autotake' }, core, {}), db, llm };
}
const meta = () => ({ idempotencyKey: randomUUID() });

test('#65 AC-1: two answers only → asks just the hard-skills question, no draft', async () => {
  const { svc, db } = service({ answered: [true, true, false], title: 'Vietnam Growth Manager', titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: 'We have nobody owning growth in Vietnam\nBuild a repeatable local growth process' }, meta());
  assert.equal(res.phase, 'intake');
  const reply = res.messages[res.messages.length - 1].text;
  assert.match(reply, /What hard skills must the candidate have\?/);
  assert.doesNotMatch(reply, /What difficulty|What problem/);
  assert.deepEqual(db.conv.fields, {}, 'no draft fields written');
});

test('#65 AC-2: a lone "a" asks for all three answers without calling the model; no draft', async () => {
  const { svc, llm, db } = service({ answered: [true, true, true], title: 'Ops', titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: 'a' }, meta());
  assert.equal(res.phase, 'intake');
  assert.equal(llm.calls.length, 0, 'too thin to even assess');
  assert.match(res.messages[res.messages.length - 1].text, /Please answer these 3 questions/);
  assert.deepEqual(db.conv.fields, {});
});

test('#66 AC-3: vague answers with no reasonable title → asks for the job title, no draft', async () => {
  const { svc, db } = service({ answered: [true, true, true], title: null, titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: 'Things are messy\nTidy them up\nPatience, curiosity, kindness' }, meta());
  assert.equal(res.phase, 'intake');
  assert.match(res.messages[res.messages.length - 1].text, /What’s the job title/);
  assert.deepEqual(db.conv.fields, {});
});

test('#65 AC-3 / #66 AC-1/AC-2: three answers → a draft with the AI title marked unconfirmed; create is refused until confirmed', async () => {
  const { svc, db, llm } = service({ answered: [true, true, true], title: 'Vietnam Growth Manager', titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: 'No one owns growth in Vietnam\nBuild a repeatable local growth process\nPerformance marketing, SQL' }, meta());
  assert.equal(res.phase, 'ready_to_confirm');
  assert.equal(res.fields.title, 'Vietnam Growth Manager', 'the assessed title, not whatever the drafter picked');
  assert.deepEqual(res.missingFields, [TITLE_UNCONFIRMED]);
  assert.match(llm.calls[1].input, /AI 根据回答建议，待用户确认/);

  await assert.rejects(svc.confirmDraft(identity, 'c1', meta()), (e) => e.getResponse().code === 'TITLE_UNCONFIRMED');

  // Confirming (or editing) the title saves the fields as the user's own and clears the mark.
  await svc.setFields(identity, 'c1', { fields: { ...db.conv.fields, title: 'Growth Manager, Vietnam' }, label: 'Confirm job title' }, meta());
  assert.deepEqual(db.conv.missingFields, []);
  assert.equal(db.conv.fields.title, 'Growth Manager, Vietnam');
});

test('#66: a title the user wrote themselves needs no confirmation', async () => {
  const { svc } = service({ answered: [true, true, true], title: 'Data Analyst', titleFromUser: true });
  const res = await svc.quickStart(identity, 'c1', { answers: 'Data Analyst\nReports are late\nOwn weekly reporting\nSQL' }, meta());
  assert.deepEqual(res.missingFields, []);
});

test('assessment parsing and the follow-up text are defensive', () => {
  assert.equal(tooThinToAssess('a'), true);
  assert.equal(tooThinToAssess('?? 1 2'), true);
  assert.equal(tooThinToAssess('SQL'), false);
  assert.deepEqual(parseAssessment('not json'), { answered: [false, false, false], title: null, titleFromUser: false });
  assert.deepEqual(parseAssessment('{"answered":[true,"yes",true],"title":"  ","titleFromUser":true}'), { answered: [true, false, true], title: null, titleFromUser: false });
  assert.match(followUp({ answered: [true, false, true], title: 'x', titleFromUser: false }, '我们缺人'), /希望候选人解决什么问题/);
  assert.equal(followUp({ answered: [true, true, true], title: 'x', titleFromUser: false }, 'ok'), null);
});

test('#65 review: the answers so far come from the conversation, so a reopened panel only sends the new one', async () => {
  const llm = fakeLlm({ answered: [true, true, false], title: 'Vietnam Growth Manager', titleFromUser: false });
  const db = memoryDb();
  const svc = new CopilotService(db, llm, { jdAutotakeSystemPrompt: 'autotake' }, {}, {});
  await svc.quickStart(identity, 'c1', { answers: 'We have nobody owning growth in Vietnam\nBuild a repeatable local growth process' }, meta());
  // The panel was closed and reopened: the browser lost everything, it sends only the new answer.
  llm.calls.length = 0;
  const assessments = [];
  llm.completeJson = async (system, turns) => {
    const input = turns.map((t) => t.content).join('\n');
    llm.calls.push({ system, input });
    if (system.includes('快速开始')) { assessments.push(input); return JSON.stringify({ answered: [true, true, true], title: 'Vietnam Growth Manager', titleFromUser: false }); }
    return JSON.stringify({ reply: 'ok', phase: 'ready_to_confirm', missingFields: [], fields: { roleSummary: 's', responsibilities: ['a', 'b'], mustHave: ['c', 'd'] } });
  };
  const res = await svc.quickStart(identity, 'c1', { answers: 'Performance marketing, SQL' }, meta());
  assert.equal(res.phase, 'ready_to_confirm');
  assert.match(assessments[0], /nobody owning growth in Vietnam[\s\S]*Performance marketing, SQL/);
  // A Quick Start after that draft starts fresh: the finished run's answers are not carried over.
  llm.calls.length = 0;
  assessments.length = 0;
  await svc.quickStart(identity, 'c1', { answers: 'a fresh start' }, meta());
  assert.doesNotMatch(assessments[0], /Vietnam/);
});

test('#65 review: a follow-up on a conversation with a complete draft keeps "intake" and the pending title mark', async () => {
  const { svc, db } = service({ answered: [true, true, true], title: 'X', titleFromUser: false });
  Object.assign(db.conv, {
    phase: 'ready_to_confirm',
    fields: { title: 'Vietnam Growth Manager', roleSummary: 's', responsibilities: ['a', 'b'], mustHave: ['c', 'd'] },
    missingFields: [TITLE_UNCONFIRMED],
  });
  const res = await svc.quickStart(identity, 'c1', { answers: 'a' }, meta());
  assert.equal(res.phase, 'intake');
  assert.deepEqual(res.missingFields.filter((f) => f === TITLE_UNCONFIRMED), [TITLE_UNCONFIRMED]);
  await assert.rejects(svc.confirmDraft(identity, 'c1', meta()), (e) => e.getResponse().code === 'CONVERSATION_NOT_READY');
});
