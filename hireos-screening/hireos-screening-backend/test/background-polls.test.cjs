// #116 -- a background poll that hits a database or network error logs it and carries on: nothing escapes as an
// unhandled rejection (which would end the whole Screening process), and the next round picks the work up.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { InterviewHandoffDispatcherService } = require('../dist/decisions/interview-handoff-dispatcher.service');

const config = { get: (_k, d) => d };
function dispatcher(db) {
  const service = new InterviewHandoffDispatcherService(db, config);
  const logged = [];
  service.logger.error = (m) => logged.push(m);
  service.logger.warn = (m) => logged.push(m);
  return { service, logged };
}
const event = (id) => ({ id, workspaceId: 'ws-1', eventType: 'candidate.advanced_to_interview', payload: { id }, attempt: 0 });
// The dispatcher reads each destination's queue on its own (#384); these events all go to Interview.
const forQueue = (where, events) => (where.eventType === 'candidate.advanced_to_interview' ? events : []);

test('#116 AC-1: in a separate process, every poll\'s timer callback survives a database that is down', () => {
  const out = execFileSync(process.execPath, [path.join(__dirname, 'fixtures/f116/poll-crash.cjs'), path.join(__dirname, '../dist')], { encoding: 'utf8' });
  assert.match(out, /^ok 4/, 'four polls registered, the process exited normally');
});

test('#116 AC-1/AC-2: a failed round is logged without event data, then the next round dispatches what is pending', async () => {
  let up = false;
  const updates = [];
  const db = { screeningOutboxEvent: {
    findMany: async ({ where }) => { if (!up) throw new Error("Can't reach database server"); return forQueue(where, [event('e-1')]); },
    // Claims (status sending, #385) succeed and aren't recorded; settled outcomes are.
    updateMany: async ({ where, data }) => { if (data.status !== 'sending') updates.push([where.id, data.status]); return { count: 1 }; },
  } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  try {
    const { service, logged } = dispatcher(db);
    await service.tick();
    assert.match(logged[0], /handoff poll failed: Error: Can't reach database server/);
    assert.equal(service.running, false, 'the running flag is released');
    up = true;
    await service.tick();
    assert.deepEqual(updates, [['e-1', 'dispatched']]);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('#116 AC-1/AC-3: one event whose failure can\'t be recorded doesn\'t stop the others; attempts and give-up are unchanged', async () => {
  const updates = [];
  const db = { screeningOutboxEvent: {
    findMany: async ({ where }) => forQueue(where, [event('e-1'), { ...event('e-2'), attempt: 9 }, event('e-3')]),
    updateMany: async ({ where, data }) => {
      if (where.id === 'e-1') throw new Error('write failed');
      if (data.status !== 'sending') updates.push([where.id, data.status, data.attempt]);
      return { count: 1 };
    },
  } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => ({ ok: JSON.parse(init.body).id === 'e-3', status: JSON.parse(init.body).id === 'e-3' ? 200 : 503 });
  try {
    const { service, logged } = dispatcher(db);
    await service.tick();
    assert.ok(logged.some((m) => /Handoff event e-1 .* could not be dispatched or its failure recorded: Error: write failed/.test(m)));
    assert.deepEqual(updates, [['e-2', 'failed', 10], ['e-3', 'dispatched', undefined]], 'the tenth failed attempt gives up, as before');
  } finally {
    globalThis.fetch = realFetch;
  }
});
