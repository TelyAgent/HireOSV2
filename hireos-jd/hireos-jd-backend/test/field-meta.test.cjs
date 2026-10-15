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
      // A snapshot, like a real query: later writes don't change a row already read.
      findFirst: async () => ({ ...conv }),
      update: async ({ data }) => {
        for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v;
        conv.stateRevision += 1;
        return conv;
      },
      updateMany: async ({ where, data }) => {
        if (where.stateRevision !== conv.stateRevision) return { count: 0 };
        for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v;
        conv.stateRevision += 1;
        return { count: 1 };
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

  const confirmed = await svc.confirmFields(identity, 'c1', { fields: ['responsibilities', 'title'], revisions: { responsibilities: 1, title: 1 } });
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
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['businessProblem'], revisions: { businessProblem: 0 } }), (e) => e.response?.code === 'FIELD_NOT_IN_DRAFT');
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['notAField'], revisions: { notAField: 0 } }));
});

test('#68 review: a refine that rewrites a confirmed field makes it a pending AI suggestion at the next revision', async () => {
  const { svc } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  await svc.confirmFields(identity, 'c1', { fields: ['mustHave', 'responsibilities'], revisions: { mustHave: 1, responsibilities: 1 } });

  svc.llm.completeJson = async () => JSON.stringify({ reply: '已修改', phase: 'ready_to_confirm', missingFields: [], fields: { ...DRAFT, mustHave: ['Performance marketing', 'SQL', 'Excel'] } });
  const refined = await svc.refineDraft(identity, 'c1', { note: '加一条 Excel' }, meta());
  assert.deepEqual(refined.fieldMeta.mustHave, { source: 'ai', revision: 2, status: 'pending' });
  assert.deepEqual(refined.fieldMeta.responsibilities, { source: 'ai', revision: 1, status: 'confirmed' }, 'untouched fields keep their status');
});

test('#68 review: Quick Start answers are marked, so a reopened conversation is still known as Quick Start', async () => {
  const { svc, db } = service({ titleFromUser: false });
  const res = await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  const answers = res.messages.find((m) => m.role === 'user');
  assert.deepEqual(answers.attachments, [{ kind: 'quick_start' }]);
  assert.equal(db.conv.fieldMeta.title.status, 'pending');
});

test('#68 review: a field changed since the user looked at it is not confirmed', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  // Another tab refined the draft: mustHave is now at revision 2.
  db.conv.fieldMeta = { ...db.conv.fieldMeta, mustHave: { source: 'ai', revision: 2, status: 'pending' } };

  await assert.rejects(
    svc.confirmFields(identity, 'c1', { fields: ['mustHave', 'title'], revisions: { mustHave: 1, title: 1 } }),
    (e) => e.response?.code === 'DRAFT_CHANGED' && e.response.fields.includes('mustHave'),
  );
  assert.equal(db.conv.fieldMeta.mustHave.status, 'pending');
  assert.equal(db.conv.fieldMeta.title.status, 'pending');
  assert.ok(db.conv.missingFields.includes('title_unconfirmed'), 'the title check Create waits for is not lifted');
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['title'] }), 'the reviewed revision is required');
});

test('#68 review: a change that lands between the check and the write makes the confirmation fail, not overwrite', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  const load = db.copilotConversation.findFirst;
  db.copilotConversation.findFirst = async () => {
    const row = { ...(await load()) };
    db.conv.stateRevision += 1; // another turn commits right after this read
    db.copilotConversation.findFirst = load;
    return row;
  };
  await assert.rejects(svc.confirmFields(identity, 'c1', { fields: ['title'], revisions: { title: 1 } }), (e) => e.response?.code === 'DRAFT_CHANGED');
  assert.equal(db.conv.fieldMeta.title.status, 'pending');
});

test('#68 review: two overlapping refines can\'t both write the next revision; the later one is refused', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  const refineTo = (mustHave) => async () => JSON.stringify({ reply: '已修改', phase: 'ready_to_confirm', missingFields: [], fields: { ...DRAFT, mustHave } });

  // Both refines read the draft at the same state; the first commits while the second waits for the model.
  let releaseSecond;
  const secondModel = new Promise((resolve) => (releaseSecond = resolve));
  svc.llm.completeJson = async (_system, turns) => {
    const input = turns.map((t) => t.content).join('\n');
    if (input.includes('加 Python')) {
      await secondModel;
      return refineTo(['SQL', 'Python'])();
    }
    return refineTo(['SQL', 'Excel'])();
  };
  const second = svc.refineDraft(identity, 'c1', { note: '加 Python' }, meta());
  const firstResult = await svc.refineDraft(identity, 'c1', { note: '加 Excel' }, meta());
  releaseSecond();

  await assert.rejects(second, (e) => e.response?.code === 'DRAFT_CHANGED');
  assert.deepEqual(firstResult.fieldMeta.mustHave, { source: 'ai', revision: 2, status: 'pending' });
  assert.deepEqual(db.conv.fields.mustHave, ['SQL', 'Excel'], 'the refused refine wrote nothing');
  // A page that saw "SQL, Excel" at v2 confirms exactly that.
  const confirmed = await svc.confirmFields(identity, 'c1', { fields: ['mustHave'], revisions: { mustHave: 2 } });
  assert.equal(confirmed.fieldMeta.mustHave.status, 'confirmed');
});

test('#68 review: a user edit made while a turn waits for the model is not overwritten by that turn', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  let releaseModel;
  const model = new Promise((resolve) => (releaseModel = resolve));
  svc.llm.completeJson = async () => { await model; return JSON.stringify({ reply: '已补全', phase: 'ready_to_confirm', missingFields: [], fields: { businessProblem: 'No one owns growth.' } }); };
  const turn = svc.autoComplete(identity, 'c1', {}, meta());
  // Meanwhile the user changes the location and saves.
  await svc.setFields(identity, 'c1', { fields: { ...db.conv.fields, location: 'London' }, label: 'Edit location' }, meta());
  releaseModel();

  await assert.rejects(turn, (e) => e.response?.code === 'DRAFT_CHANGED');
  assert.equal(db.conv.fields.location, 'London');
  assert.deepEqual(db.conv.fieldMeta.location, { source: 'user', revision: 1, status: 'confirmed' });
});

test('#68 review: a save computed from an older draft doesn\'t undo a confirmation or reuse a revision', async () => {
  const { svc, db } = service({ titleFromUser: false });
  await svc.quickStart(identity, 'c1', { answers: ANSWERS }, meta());
  const stale = { ...db.conv }; // what a slow save read before the confirmation landed
  await svc.confirmFields(identity, 'c1', { fields: ['mustHave'], revisions: { mustHave: 1 } });

  const load = db.copilotConversation.findFirst;
  db.copilotConversation.findFirst = async () => { db.copilotConversation.findFirst = load; return { ...stale }; };
  await assert.rejects(
    svc.setFields(identity, 'c1', { fields: { ...stale.fields, roleSummary: 'Owns growth and the team.' }, label: 'Edit summary' }, meta()),
    (e) => e.response?.code === 'DRAFT_CHANGED',
  );
  assert.equal(db.conv.fieldMeta.mustHave.status, 'confirmed', 'the confirmation stands');
  assert.equal(db.conv.fields.roleSummary, DRAFT.roleSummary);
});
