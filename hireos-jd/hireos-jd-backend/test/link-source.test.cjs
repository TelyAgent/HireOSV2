// #64 AC-2 -- a job created from an imported link keeps that link as its source, and Create makes one Draft.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CopilotService } = require('../dist/copilot/copilot.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const LINK = 'https://campus-talent.alibaba.com/campus/position/199907740040?deptCodes=';

/** The conversation as `importSource` leaves it: the link message stored, a draft ready to confirm. */
function memoryDb() {
  const conv = {
    id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'ready_to_confirm', missingFields: [], stateRevision: 3,
    fields: { title: 'AI应用算法工程师', location: '北京 / 广州 / 杭州 / 上海', headcount: 1, roleSummary: '将大模型能力做成可上线的产品能力。', responsibilities: ['需求与问题定义', '数据飞轮与治理'], mustHave: ['熟悉 RAG、Agent'] },
    createdAt: new Date(), updatedAt: new Date(),
  };
  const messages = [
    { id: 'm1', conversationId: 'c1', sequence: 1, role: 'user', text: LINK, attachments: [{ kind: 'link', url: LINK }] },
    { id: 'm2', conversationId: 'c1', sequence: 2, role: 'assistant', text: '已根据链接生成草稿。', attachments: null },
  ];
  const db = {
    conv,
    copilotConversation: {
      findFirst: async () => conv,
      update: async ({ data }) => Object.assign(conv, data),
    },
    copilotMessage: {
      findMany: async ({ where } = {}) => messages.filter((m) => !where?.role || m.role === where.role),
    },
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

function stores() {
  const jobs = [];
  const drafts = [];
  return {
    jobs,
    drafts,
    core: { createJob: async (_i, body) => { const job = { id: `job-${jobs.length + 1}`, ...body }; jobs.push(job); return job; } },
    draftStore: { create: async (_i, jobId, content) => { drafts.push({ jobId, ...content }); return { jobId, status: 'draft', ...content }; } },
  };
}

test('#64 AC-2: Create from a link makes one Draft whose sources include the link', async () => {
  const db = memoryDb();
  const { jobs, drafts, core, draftStore } = stores();
  const svc = new CopilotService(db, {}, { jdAutotakeSystemPrompt: 'autotake' }, core, draftStore);

  const result = await svc.confirmDraft(identity, 'c1', { idempotencyKey: randomUUID() });

  assert.equal(jobs.length, 1);
  assert.equal(drafts.length, 1);
  assert.equal(result.draft.status, 'draft');
  assert.deepEqual(drafts[0].sourceRefs, [{ kind: 'copilot_conversation', id: 'c1' }, { kind: 'link', url: LINK }]);
  assert.equal(jobs[0].title, 'AI应用算法工程师');
});

test('#64 AC-2: confirming again returns the same job instead of a second Draft', async () => {
  const db = memoryDb();
  const { jobs, drafts, core, draftStore } = stores();
  const svc = new CopilotService(db, {}, { jdAutotakeSystemPrompt: 'autotake' }, core, draftStore);

  const first = await svc.confirmDraft(identity, 'c1', { idempotencyKey: randomUUID() });
  const second = await svc.confirmDraft(identity, 'c1', { idempotencyKey: randomUUID() });

  assert.equal(second.jobId, first.jobId);
  assert.equal(jobs.length, 1);
  assert.equal(drafts.length, 1);
});

test('#64: a conversation without imported links keeps only the conversation as its source', async () => {
  const db = memoryDb();
  db.copilotMessage.findMany = async () => [{ role: 'user', text: 'pasted JD text', attachments: null }];
  const { drafts, core, draftStore } = stores();
  await new CopilotService(db, {}, { jdAutotakeSystemPrompt: 'autotake' }, core, draftStore).confirmDraft(identity, 'c1', { idempotencyKey: randomUUID() });
  assert.deepEqual(drafts[0].sourceRefs, [{ kind: 'copilot_conversation', id: 'c1' }]);
});

test('#64 AC-1: a posting open in several cities keeps all of them when the model returns a list', () => {
  const { llmTurnResultSchema } = require('../dist/copilot/types');
  const turn = (location) => ({ reply: 'ok', phase: 'ready_to_confirm', missingFields: [], fields: { title: 'AI应用算法工程师', location } });
  assert.equal(llmTurnResultSchema.parse(turn(['北京', '广州', '杭州', '上海'])).fields.location, '北京 / 广州 / 杭州 / 上海');
  assert.equal(llmTurnResultSchema.parse(turn('上海')).fields.location, '上海');
  assert.equal('location' in llmTurnResultSchema.parse(turn([])).fields, false);
});
