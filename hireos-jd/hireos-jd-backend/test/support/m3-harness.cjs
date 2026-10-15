// #79 #80 -- runs the upload flow (extract, then auto-complete when the frontend would) on an in-memory
// conversation. Tests replay recorded model output through it; `record-m3.cjs` runs it against the real model.
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { CopilotService } = require('../../dist/copilot/copilot.service');
const { PromptRegistry } = require('../../dist/copilot/prompt-registry');

const FIXTURES = path.join(__dirname, '..', 'fixtures', 'm3');
const MIME = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdf: 'application/pdf', txt: 'text/plain' };
const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };

function memoryDb() {
  const conv = { id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], stateRevision: 1, createdAt: new Date(), updatedAt: new Date() };
  const messages = [];
  const keys = new Map();
  const db = {
    conv,
    messages,
    copilotConversation: {
      findFirst: async () => conv,
      update: async ({ data }) => {
        for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v;
        conv.stateRevision += 1;
        return conv;
      },
      updateMany: async ({ where, data }) => {
        if (where.stateRevision !== undefined && where.stateRevision !== conv.stateRevision) return { count: 0 };
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

/** Wraps an LLM: records each call, or replays recorded answers in order. */
function recordingLlm(inner, replay) {
  const calls = [];
  return {
    calls,
    completeJson: async (system, turns) => {
      const skill = system.includes('JD File Extract') ? 'file_extract' : system.includes('JD Autotake') ? 'autotake' : 'other';
      const raw = replay ? replay[calls.length]?.raw : await inner.completeJson(system, turns);
      if (raw === undefined) throw new Error(`no recorded answer for call ${calls.length}`);
      calls.push({ skill, turns, raw });
      return raw;
    },
  };
}

/** Upload `file` (optionally under another name) and auto-complete like the panel does. */
async function runUpload(llm, file, uploadName = file) {
  const db = memoryDb();
  const svc = new CopilotService(db, llm, new PromptRegistry(), {}, {});
  const buffer = fs.readFileSync(path.join(FIXTURES, file));
  const ext = file.split('.').pop();
  let result = await svc.processAttachment(identity, 'c1', { buffer, mimetype: MIME[ext], originalname: uploadName, size: buffer.length }, { idempotencyKey: randomUUID() });
  if (result.phase !== 'ready_to_confirm' && result.fields.title) {
    result = await svc.autoComplete(identity, 'c1', {}, { idempotencyKey: randomUUID() });
  }
  return { fields: result.fields, phase: result.phase, reply: result.messages[result.messages.length - 1]?.text ?? '' };
}

module.exports = { FIXTURES, runUpload, recordingLlm };
