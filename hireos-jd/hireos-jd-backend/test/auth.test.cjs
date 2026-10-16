// Issue #16 — server-side sign-in enforcement for the JD backend (AC-1, AC-7).
// Code, rate-limit and session-lifetime rules (AC-3, AC-5, AC-6) live in the shared identity service
// and are covered by hireos-identity-backend/test/auth.integration.test.cjs.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { WorkspaceGuard } = require('../dist/auth/workspace.guard');

const SESSION_MODE = {
  AUTH_MODE: 'session',
  NODE_ENV: 'production',
  IDENTITY_INTERNAL_URL: 'http://identity.test/api',
  IDENTITY_INTERNAL_TOKEN: 'internal-secret',
  SERVICE_TOKEN: 'service-secret',
  ALLOWED_ORIGINS: 'https://hireos.example',
};

const context = (request) => ({ switchToHttp: () => ({ getRequest: () => request }) });
const request = (headers = {}, method = 'GET') => ({ headers, method });

/** Stub of the identity service's session introspection: `sessions` maps cookie token → active flag. */
function stubIdentity(sessions) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const { token } = JSON.parse(init.body);
    const active = sessions.get(token) === true;
    return new Response(
      JSON.stringify(active ? { active: true, userId: 'user-1', workspaceId: 'ws-1', roles: ['hr'], email: 'hr@example.com', displayName: 'HR' } : { active: false }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };
  return calls;
}

test('AC-1: with sign-in on, a JD API request without a session is refused with 401', async () => {
  const realFetch = globalThis.fetch;
  try {
    stubIdentity(new Map());
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    for (const headers of [{}, { cookie: 'other=1' }, { cookie: 'hireos_sid=unknown' }]) {
      await assert.rejects(guard.canActivate(context(request(headers))), (error) => error.getStatus() === 401 && error.response.code === 'AUTH_REQUIRED');
    }
    // The fixed development identity is never handed out in session mode, even if DEV_AUTH_ENABLED is set.
    const devToo = new WorkspaceGuard(new ConfigService({ ...SESSION_MODE, NODE_ENV: 'development', DEV_AUTH_ENABLED: 'true' }));
    await assert.rejects(devToo.canActivate(context(request())), (error) => error.getStatus() === 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('AC-1: a signed-in session passes and the request carries that user', async () => {
  const realFetch = globalThis.fetch;
  try {
    const calls = stubIdentity(new Map([['good', true]]));
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    const req = request({ cookie: 'hireos_sid=good' });
    assert.equal(await guard.canActivate(context(req)), true);
    assert.equal(req.identity.actorId, 'user-1');
    assert.equal(req.identity.workspaceId, 'ws-1');
    assert.equal(calls[0].url, 'http://identity.test/api/internal/sessions/introspect');
    assert.equal(calls[0].init.headers['x-internal-token'], 'internal-secret');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('AC-7 / AC-8: once the session is revoked (sign-out, member removed) the very next request is refused', async () => {
  const realFetch = globalThis.fetch;
  try {
    const sessions = new Map([['live', true]]);
    const calls = stubIdentity(sessions);
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    assert.equal(await guard.canActivate(context(request({ cookie: 'hireos_sid=live' }))), true);
    sessions.set('live', false); // identity revoked it
    await assert.rejects(guard.canActivate(context(request({ cookie: 'hireos_sid=live' }))), (error) => error.getStatus() === 401);
    assert.equal(calls.length, 2, 'no cached identity — each request is checked');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Identity service down in session mode fails closed (503), never falls back to an anonymous identity', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED');
    };
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    await assert.rejects(guard.canActivate(context(request({ cookie: 'hireos_sid=any' }))), (error) => error.getStatus() === 503);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Identity outages expose a request id while logs retain the failure category', async () => {
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('identity failed', { status: 502 });
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    await assert.rejects(
      guard.canActivate(context(request({ cookie: 'hireos_sid=any', 'x-request-id': 'req-32' }))),
      (error) => error.getStatus() === 503 && error.response.code === 'IDENTITY_UNAVAILABLE' && error.response.requestId === 'req-32',
    );
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Identity timeout is classified separately from a network failure', async () => {
  const realFetch = globalThis.fetch;
  try {
    const timeout = new Error('request timed out');
    timeout.name = 'TimeoutError';
    globalThis.fetch = async () => { throw timeout; };
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    await assert.rejects(guard.canActivate(context(request({ cookie: 'hireos_sid=any' }))), (error) => error.getStatus() === 503 && typeof error.response.requestId === 'string');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Cross-site state-changing requests with a valid cookie are refused', async () => {
  const realFetch = globalThis.fetch;
  try {
    stubIdentity(new Map([['good', true]]));
    const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
    await assert.rejects(
      guard.canActivate(context(request({ cookie: 'hireos_sid=good', origin: 'https://evil.example' }, 'POST'))),
      (error) => error.getStatus() === 403,
    );
    assert.equal(await guard.canActivate(context(request({ cookie: 'hireos_sid=good', origin: 'https://hireos.example' }, 'POST'))), true);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('Other HireOS backends authenticate with the service token only', async () => {
  const guard = new WorkspaceGuard(new ConfigService(SESSION_MODE));
  const req = request({ 'x-hireos-service-token': 'service-secret', 'x-workspace-id': 'ws-1', 'x-actor-id': 'user-9' }, 'POST');
  assert.equal(await guard.canActivate(context(req)), true);
  assert.deepEqual(req.identity, { workspaceId: 'ws-1', actorId: 'user-9', roles: [], kind: 'service' });
  await assert.rejects(
    guard.canActivate(context(request({ 'x-hireos-service-token': 'guess', 'x-workspace-id': 'ws-1' }))),
    (error) => error.getStatus() === 401,
  );
});
