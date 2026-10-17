// #384 -- a slow handoff receiver holds up only its own events; every delivery has a deadline; failed events
// back off before their next attempt and stop after 10.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { InterviewHandoffDispatcherService, retryDelayMs } = require('../dist/decisions/interview-handoff-dispatcher.service');

/** Enough of Prisma's where for the dispatcher's queries: equality, notIn, lt/lte, null and OR. */
function matches(row, where) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((sub) => matches(row, sub));
    if (cond === null) return row[key] == null;
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('notIn' in cond) return !cond.notIn.includes(row[key]);
      if ('lt' in cond) return row[key] != null && row[key] < cond.lt;
      if ('lte' in cond) return row[key] != null && row[key] <= cond.lte;
    }
    return row[key] === cond;
  });
}
function memoryDb(events) {
  return { events, screeningOutboxEvent: {
    findMany: async ({ where, take }) => events.filter((e) => matches(e, where)).sort((a, b) => a.createdAt - b.createdAt).slice(0, take),
    updateMany: async ({ where, data }) => {
      const hit = events.filter((e) => matches(e, where));
      for (const e of hit) Object.assign(e, data);
      return { count: hit.length };
    },
  } };
}
const event = (id, eventType, extra = {}) => ({ id, workspaceId: 'w', eventType, payload: { id }, status: 'pending', attempt: 0, createdAt: new Date(), nextAttemptAt: null, leaseToken: null, leaseUntil: null, ...extra });
const config = (env = {}) => ({ get: (key, fallback) => env[key] ?? fallback });

function stubFetch(handler) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  return () => { globalThis.fetch = original; };
}

test('AC-1: a slow interview receiver does not delay the written handoff', async () => {
  const delivered = {};
  const t0 = Date.now();
  const restore = stubFetch(async (url, init) => {
    if (url.includes('/screening-handoff') && !url.includes('/intake/')) {
      await new Promise((resolve, reject) => { const timer = setTimeout(resolve, 3000); init.signal.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason); }); });
    }
    delivered[JSON.parse(init.body).id] = Date.now() - t0;
    return new Response('{}');
  });
  try {
    const db = memoryDb([event('slow', 'candidate.advanced_to_interview'), event('fast', 'candidate.assessment_requested')]);
    await new InterviewHandoffDispatcherService(db, config({ HANDOFF_DISPATCH_TIMEOUT_MS: '300' })).tick();
    assert.ok(delivered.fast < 200, `written delivered at ${delivered.fast} ms`);
    assert.equal(db.events.find((e) => e.id === 'fast').status, 'dispatched');
    const slow = db.events.find((e) => e.id === 'slow');
    assert.deepEqual([slow.status, slow.attempt, delivered.slow], ['pending', 1, undefined], 'the slow delivery was cut off at its deadline');
    assert.ok(Date.now() - t0 < 1000);
  } finally {
    restore();
  }
});

test('AC-2: a failed event waits out its backoff, and the tenth failure marks it failed', async () => {
  let calls = 0;
  const restore = stubFetch(async () => { calls++; return new Response('nope', { status: 503 }); });
  try {
    const db = memoryDb([event('e1', 'candidate.assessment_requested')]);
    const dispatcher = new InterviewHandoffDispatcherService(db, config());
    await dispatcher.tick();
    const e = db.events[0];
    assert.deepEqual([e.attempt, e.status, e.lastError], [1, 'pending', 'HTTP 503']);
    assert.ok(e.nextAttemptAt > new Date());
    await dispatcher.tick();
    assert.equal(calls, 1, 'not retried before its next attempt time');
    for (let i = 2; i <= 10; i++) {
      e.nextAttemptAt = new Date(0);
      await dispatcher.tick();
    }
    assert.deepEqual([e.attempt, e.status, calls], [10, 'failed', 10]);
  } finally {
    restore();
  }
  assert.deepEqual([1, 2, 3, 8, 20].map(retryDelayMs), [5_000, 10_000, 20_000, 600_000, 600_000]);
});

test('AC-3: an event nothing subscribes to is marked dispatched without a request', async () => {
  let calls = 0;
  const restore = stubFetch(async () => { calls++; return new Response('{}'); });
  try {
    const db = memoryDb([event('x', 'candidate.something_else')]);
    await new InterviewHandoffDispatcherService(db, config()).tick();
    assert.deepEqual([db.events[0].status, calls], ['dispatched', 0]);
  } finally {
    restore();
  }
});
