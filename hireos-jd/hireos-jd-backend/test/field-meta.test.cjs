// #68 -- each field of a Quick Start draft records its source, revision and confirmation status, and these
// change correctly when the user confirms or edits a field, or AI rewrites it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { recordChanges, confirmFields } = require('../dist/copilot/field-meta');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const meta = () => ({ idempotencyKey: randomUUID() });
const ANSWERS = 'We have nobody owning growth in Vietnam\nBuild a repeatable local growth process\nPerformance marketing, SQL';
const DRAFT = { title: 'Growth Lead', roleSummary: 'Owns growth in Vietnam.', responsibilities: ['Build a local growth process', 'Run experiments'], mustHave: ['Performance marketing', 'SQL'] };

function memoryDb() {
  const conv = { id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], fieldMeta: {}, stateRevision: 1, createdAt: new Date(), updatedAt: new Date() };
  const messages = [];
  const keys = new Map();
  const db = {
    conv,
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
      findMany: async ({ where } = {}) => messages.filter((m) => (!where?.role || m.role === where.role) && (!where?.idempotencyKey || where.idempotencyKey.in.includes(m.idempotencyKey))),
      create: async ({ data }) => { const m = { id: randomUUID(), createdAt: new Date(), attachments: null, ...data }; messages.push(m); return m; },
    },
    idempotencyKey: {
      findUnique: async ({ where }) => keys.get(where.workspaceId_operation_key.key) ?? null,
      findMany: async ({ where }) => [...keys.values()].filter((k) => k.operation === where.operation),
      create: async ({ data }) => { keys.set(data.key, { ...data, createdAt: new Date() }); return data; },
    },
    aiRun: { create: async ({ data }) => data },
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

function service({ titleFromUser }) {
  const db = memoryDb();
  const llm = {
    completeJson: async (system) =>
      system.includes('快速开始')
        ? JSON.stringify({ answered: [true, true, true], title: titleFromUser ? 'Vietnam Growth Manager' : 'Growth Lead', titleFromUser })
        : JSON.stringify({ reply: '已生成', phase: 'ready_to_confirm', missingFields: [], fields: DRAFT }),
  };
  return { db, svc: new CopilotService(db, llm, { jdAutotakeSystemPrompt: 'autotake' }, {}, {}) };
}

test('#68 AC-1: a Quick Start draft marks each field AI-suggested and pending, revision 1; the API returns it', async () => {
  const { svc } = service({ titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  assert.equal(res.phase, 'ready_to_confirm');
  for (const field of ['title', 'roleSummary', 'responsibilities', 'mustHave']) {
    assert.deepEqual(res.fieldMeta[field], { source: 'ai', revision: 1, status: 'pending' }, field);
  }
});

test('#68 AC-1: a job title the user gave themselves is their answer, already confirmed', async () => {
  const { svc } = service({ titleFromUser: true });
  const res = await svc.quickStart(identity, 'c1', { answers: `${ANSWERS}\nVietnam Growth Manager` }, meta());
  assert.deepEqual(res.fieldMeta.title, { source: 'user', revision: 1, status: 'confirmed' });
  assert.equal(res.fieldMeta.responsibilities.source, 'ai');
});

test('#68 AC-2: confirming keeps value and revision; editing makes the field the user’s at the next revision', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());

  const confirmed = await svc.confirmFields(identity, 'c1', { fields: ['responsibilities', 'title'] });
  assert.deepEqual(confirmed.fieldMeta.responsibilities, { source: 'ai', revision: 1, status: 'confirmed' });
  assert.deepEqual(confirmed.fieldMeta.title, { source: 'ai', revision: 1, status: 'confirmed' });
  assert.deepEqual(confirmed.missingFields, [], 'confirming the title lifts the title check Create waits for');
  assert.equal(confirmed.fieldMeta.mustHave.status, 'pending', 'other suggestions stay pending');

  // The user edits the summary (the panel saves all fields; only the changed one becomes theirs).
  const edited = await svc.setFields(identity, 'c1', { fields: { ...db.conv.fields, roleSummary: 'Owns growth and the team in Vietnam.' }, label: 'Edit summary' }, meta());
  assert.deepEqual(edited.fieldMeta.roleSummary, { source: 'user', revision: 2, status: 'confirmed' });
  assert.equal(edited.fieldMeta.mustHave.status, 'pending', 'an unchanged AI suggestion is not confirmed by saving');
});

test('#68 AC-2: AI rewriting a confirmed field makes it a pending suggestion again, at the next revision', () => {
  let m = recordChanges({}, {}, { mustHave: ['SQL'] }, () => 'ai');
  m = confirmFields(m, ['mustHave']);
  m = recordChanges(m, { mustHave: ['SQL'] }, { mustHave: ['SQL', 'Excel'] }, () => 'ai');
  assert.deepEqual(m.mustHave, { source: 'ai', revision: 2, status: 'pending' });
  m = recordChanges(m, { mustHave: ['SQL', 'Excel'] }, { mustHave: ['SQL', 'Excel'] }, () => 'ai');
  assert.equal(m.mustHave.revision, 2, 'the same value again is not a new revision');
});

test('#68: confirming a field the draft does not have is refused', async () => {
  const { svc } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['businessProblem'] }), (e) => e.response?.code === 'FIELD_NOT_IN_DRAFT');
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['notAField'] }));
});
