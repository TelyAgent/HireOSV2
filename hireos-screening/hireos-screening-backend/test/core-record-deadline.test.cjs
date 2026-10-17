// #386 -- calls to Core Record stop when the caller has gone away (reads) and always have a deadline.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');
const { ConfigService } = require('@nestjs/config');
const { CoreRecordClient } = require('../dist/core-record/core-record.client');
const { WorkspaceGuard } = require('../dist/auth/workspace.guard');

/** A Core Record stand-in that answers after `delayMs`, noting when each connection closed. */
async function slowCore(delayMs) {
  const seen = [];
  const server = http.createServer((req, res) => {
    const entry = { method: req.method, start: Date.now(), closedAt: null };
    seen.push(entry);
    req.socket.on('close', () => { entry.closedAt = Date.now(); });
    req.resume();
    setTimeout(() => { if (!res.destroyed) res.setHeader('content-type', 'application/json').end(JSON.stringify({ id: 'job-1' })); }, delayMs);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const client = new CoreRecordClient(new ConfigService({ CORE_RECORD_MODE: 'remote', CORE_RECORD_BASE_URL: `http://127.0.0.1:${server.address().port}/api/v1` }));
  return { client, seen, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }) };
}
const identityWith = (signal) => ({ workspaceId: 'w', actorId: 'a', roles: [], signal });

test('AC-1: a read stops when the caller goes away — the connection closes long before Core Record answers', async () => {
  const core = await slowCore(3000);
  try {
    const caller = new AbortController();
    const t0 = Date.now();
    setTimeout(() => caller.abort(new Error('CALLER_DISCONNECTED')), 100);
    await assert.rejects(core.client.getJob(identityWith(caller.signal), 'job-1'));
    await new Promise((r) => setTimeout(r, 50));
    assert.ok(core.seen[0].closedAt && core.seen[0].closedAt - t0 < 1000, 'connection to Core Record closed');
  } finally {
    await core.close();
  }
});

test('AC-1: a write is not cut off by the caller going away; it completes', async () => {
  const core = await slowCore(300);
  try {
    const caller = new AbortController();
    setTimeout(() => caller.abort(), 50);
    const result = await core.client['request']('/jobs', identityWith(caller.signal), { method: 'POST', body: { title: 'X' }, idempotencyKey: 'key-1' });
    assert.equal(result.id, 'job-1');
  } finally {
    await core.close();
  }
});

test('AC-2: past its deadline a call fails with CORE_RECORD_TIMEOUT instead of waiting minutes', async () => {
  const core = await slowCore(5000);
  process.env.CORE_RECORD_TIMEOUT_MS = '200';
  try {
    const t0 = Date.now();
    await assert.rejects(core.client.getJob(identityWith(undefined), 'job-1'), (e) => e.getResponse().code === 'CORE_RECORD_TIMEOUT');
    assert.ok(Date.now() - t0 < 1000);
  } finally {
    delete process.env.CORE_RECORD_TIMEOUT_MS;
    await core.close();
  }
});

test('AC-3: a 404 is still null and a normal answer still comes back', async () => {
  const server = http.createServer((req, res) => { res.statusCode = req.url.endsWith('/missing') ? 404 : 200; res.setHeader('content-type', 'application/json').end(req.url.endsWith('/missing') ? '{}' : JSON.stringify({ id: 'job-1' })); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const client = new CoreRecordClient(new ConfigService({ CORE_RECORD_MODE: 'remote', CORE_RECORD_BASE_URL: `http://127.0.0.1:${server.address().port}/api/v1` }));
    assert.equal(await client.getJob(identityWith(new AbortController().signal), 'missing'), null);
    assert.equal((await client.getJob(identityWith(undefined), 'job-1')).id, 'job-1');
  } finally {
    server.close();
  }
});

test('the guard aborts the identity signal only when the response closes unfinished', async () => {
  const guard = new WorkspaceGuard(new ConfigService({ DEV_AUTH_ENABLED: 'true' }));
  for (const [finished, aborted] of [[false, true], [true, false]]) {
    const request = { headers: {}, method: 'GET' };
    const response = Object.assign(new EventEmitter(), { writableEnded: finished });
    await guard.canActivate({ switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) });
    response.emit('close');
    assert.equal(request.identity.signal.aborted, aborted);
  }
});
