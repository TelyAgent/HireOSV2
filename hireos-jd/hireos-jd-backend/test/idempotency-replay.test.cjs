// #142 -- a Copilot request's idempotency row holds a reference, not the conversation; replays return the
// conversation as it is now; rows are kept 24 hours and an expired key is a new request.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { CopilotIdempotencyRetention, IDEMPOTENCY_TTL_MS } = require('../dist/copilot/idempotency-replay');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };

function memoryDb() {
  const conv = { id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], fieldMeta: {}, stateRevision: 1, createdAt: new Date(), updatedAt: new Date() };
  const messages = [];
  const keys = [];
  const db = {
    conv, messages, keys,
    copilotConversation: {
      findFirst: async () => conv,
      updateMany: async ({ where, data }) => {
        if (where.stateRevision !== conv.stateRevision) return { count: 0 };
        for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v;
        conv.stateRevision += 1;
        return { count: 1 };
      },
    },
    copilotMessage: {
      findFirst: async () => messages[messages.length - 1] ?? null,
      findMany: async () => [...messages],
      create: async ({ data }) => { const m = { id: randomUUID(), createdAt: new Date(), attachments: null, ...data }; messages.push(m); return m; },
    },
    idempotencyKey: {
      findUnique: async ({ where: { workspaceId_operation_key: w } }) => keys.find((k) => k.operation === w.operation && k.key === w.key) ?? null,
      create: async ({ data }) => {
        if (keys.some((k) => k.operation === data.operation && k.key === data.key)) throw Object.assign(new Error('unique'), { code: 'P2002' });
        const row = { id: randomUUID(), createdAt: new Date(), ...data };
        keys.push(row);
        return row;
      },
      deleteMany: async ({ where }) => {
        const hit = (k) => (where.id ? k.id === where.id
          : k.operation.startsWith(where.operation.startsWith) && !k.operation.startsWith(where.NOT.operation.startsWith) && k.createdAt < where.createdAt.lt);
        const before = keys.length;
        for (let i = keys.length - 1; i >= 0; i--) if (hit(keys[i])) keys.splice(i, 1);
        return { count: before - keys.length };
      },
    },
    aiRun: { create: async ({ data }) => data },
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

function setup() {
  const db = memoryDb();
  let n = 0;
  const llm = { completeJson: async () => { n += 1; return JSON.stringify({ reply: `回答 ${n}`, phase: 'intake', fields: { title: '后端工程师' }, missingFields: ['roleSummary'] }); } };
  const svc = new CopilotService(db, llm, { jdIntakeSystemPrompt: 'intake' }, {}, {});
  return { db, svc, calls: () => n };
}

test('AC-1: each turn stores a fixed-size reference, however long the conversation', async () => {
  const { db, svc } = setup();
  for (let i = 0; i < 30; i++) await svc.sendMessage(identity, 'c1', { text: `问题 ${i} ${'字'.repeat(300)}` }, { idempotencyKey: randomUUID() });
  const sizes = db.keys.map((k) => JSON.stringify(k.responseBody).length);
  assert.equal(db.messages.length, 60);
  assert.deepEqual(db.keys[29].responseBody, { replay: 'conversation', id: 'c1', phase: 'intake' });
  assert.equal(Math.max(...sizes), Math.min(...sizes));
});

test('AC-2: replaying a key returns the conversation as it is now, without another model call', async () => {
  const { db, svc, calls } = setup();
  const key = randomUUID();
  const first = await svc.sendMessage(identity, 'c1', { text: '第一句' }, { idempotencyKey: key });
  await svc.sendMessage(identity, 'c1', { text: '第二句' }, { idempotencyKey: randomUUID() });
  const replayed = await svc.sendMessage(identity, 'c1', { text: '第一句' }, { idempotencyKey: key });
  assert.equal(calls(), 2);
  assert.equal(first.messages.length, 2);
  assert.equal(replayed.messages.length, 4);
  assert.equal(replayed.stateRevision, db.conv.stateRevision);
  await assert.rejects(svc.sendMessage(identity, 'c1', { text: '别的内容' }, { idempotencyKey: key }), (e) => e.response.code === 'IDEMPOTENCY_CONFLICT');
});

test('AC-2: a row stored before #142 (a full snapshot) still replays as it was', async () => {
  const { db, svc } = setup();
  const key = randomUUID();
  db.keys.push({ id: 'old', workspaceId: 'ws-1', operation: 'copilot.message:c1', key, requestHash: require('../dist/records').requestHash({ text: '旧' }), responseBody: { id: 'c1', phase: 'intake', messages: ['snapshot'] }, createdAt: new Date() });
  assert.deepEqual((await svc.sendMessage(identity, 'c1', { text: '旧' }, { idempotencyKey: key })).messages, ['snapshot']);
});

test('AC-2: a key older than 24 hours is a new request', async () => {
  const { db, svc, calls } = setup();
  const key = randomUUID();
  await svc.sendMessage(identity, 'c1', { text: '第一句' }, { idempotencyKey: key });
  db.keys[0].createdAt = new Date(Date.now() - IDEMPOTENCY_TTL_MS - 1000);
  const again = await svc.sendMessage(identity, 'c1', { text: '第一句' }, { idempotencyKey: key });
  assert.equal(calls(), 2);
  assert.equal(again.messages.length, 4);
  assert.equal(db.keys.length, 1);
});

test('AC-2: the hourly clean-up removes Copilot rows past 24 hours, keeping Quick Start runs and other operations', async () => {
  const db = memoryDb();
  const old = new Date(Date.now() - IDEMPOTENCY_TTL_MS - 1000);
  const row = (operation, createdAt) => ({ id: randomUUID(), operation, key: randomUUID(), createdAt });
  db.keys.push(row('copilot.message:c1', old), row('copilot.refine:c1', old), row('copilot.message:c1', new Date()), row('copilot.quick-start:c1', old), row('draft.update', old));
  assert.equal(await new CopilotIdempotencyRetention(db).purge(), 2);
  assert.deepEqual(db.keys.map((k) => k.operation).sort(), ['copilot.message:c1', 'copilot.quick-start:c1', 'draft.update']);
});
