// #388 -- handing a case to Interview ends within its deadline, every failure answers INTERVIEW_HANDOFF_FAILED,
// and retrying never makes a second interview task.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { CaseLifecycleService } = require('../dist/cases/case-lifecycle.service');

async function setup() {
  const tasks = new Map();
  const state = { mode: 'ok', failLocal: false };
  const interview = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const p = JSON.parse(body);
      const key = `${p.coreJobId}|${p.coreCandidateId}`;
      if (!tasks.has(key)) tasks.set(key, `task-${tasks.size + 1}`);
      if (state.mode === 'hang') return;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ taskId: tasks.get(key) }));
    });
  });
  await new Promise((r) => interview.listen(0, '127.0.0.1', r));
  const kase = { id: 'c1', workspaceId: 'w', status: 'released', statusBeforeHold: null, closeReason: null, closedAt: null, handedOffAt: null, interviewTaskId: null, job: { coreJobId: 'J', title: 'T' }, candidate: { coreCandidateId: 'C', name: 'N' } };
  const task = { status: 'open' };
  const db = {
    case: {
      findFirst: async () => ({ ...kase }),
      findUniqueOrThrow: async () => ({ ...kase }),
      updateMany: async ({ where, data }) => {
        if (state.failLocal) throw new Error('local write failed');
        if (kase.status !== where.status) return { count: 0 };
        Object.assign(kase, data);
        return { count: 1 };
      },
    },
    task: { updateMany: async () => { task.status = 'completed'; return { count: 1 }; } },
  };
  db.$transaction = async (fn) => fn(db);
  const config = { get: (k, d) => ({ INTERVIEW_BASE_URL: `http://127.0.0.1:${interview.address().port}`, INTERVIEW_HANDOFF_TIMEOUT_MS: '200' })[k] ?? d };
  const svc = new CaseLifecycleService(db, config);
  svc.logger.warn = () => undefined;
  svc.logger.error = () => undefined;
  const handoff = () => svc.handoffToInterview({ workspaceId: 'w', actorId: 'hr' }, 'c1');
  return { handoff, state, kase, task, tasks, close: () => { interview.closeAllConnections(); interview.close(); } };
}
const isHandoffFailed = (e) => e.getStatus() === 502 && e.getResponse().code === 'INTERVIEW_HANDOFF_FAILED';

test('AC-1: Interview not answering ends at the deadline with INTERVIEW_HANDOFF_FAILED; the case stays released', async () => {
  const s = await setup();
  try {
    s.state.mode = 'hang';
    const t0 = Date.now();
    await assert.rejects(s.handoff(), isHandoffFailed);
    assert.ok(Date.now() - t0 < 1000);
    assert.equal(s.kase.status, 'released');
  } finally {
    s.close();
  }
});

test('AC-2: the local write failing after Interview succeeded answers INTERVIEW_HANDOFF_FAILED; a retry hands off with the same task', async () => {
  const s = await setup();
  try {
    s.state.failLocal = true;
    await assert.rejects(s.handoff(), isHandoffFailed);
    assert.equal(s.kase.status, 'released');
    s.state.failLocal = false;
    const out = await s.handoff();
    assert.equal(out.status, 'handed_off');
    assert.equal(s.kase.interviewTaskId, 'task-1');
    assert.equal(s.tasks.size, 1);
    assert.equal(s.task.status, 'completed');
  } finally {
    s.close();
  }
});

test('AC-3: a normal handoff still works, and a case no longer released is refused', async () => {
  const s = await setup();
  try {
    assert.equal((await s.handoff()).status, 'handed_off');
    await assert.rejects(s.handoff(), (e) => e.getResponse().code === 'NOT_RELEASED');
  } finally {
    s.close();
  }
});
