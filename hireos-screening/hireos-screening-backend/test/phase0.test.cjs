const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { HealthService } = require('../dist/health/health.service');
const { WorkspaceGuard } = require('../dist/auth/workspace.guard');
const { splitText, normalizeTextForDedupe } = require('../dist/intake/materials.service');
const { normalizeName, displayNameFromFileName, errorDetails } = require('../dist/intake/imports.service');
const { ProfileParserService } = require('../dist/profiles/profile-parser.service');
const { SecurityScanService } = require('../dist/intake/security-scan.service');

test('phase 0 health payload is stable', () => {
  const payload = new HealthService().getHealth();
  assert.equal(payload.status, 'ok');
  assert.equal(payload.service, 'hireos-resume-screening-backend');
  assert.equal(payload.phase, 'phase-7');
  assert.match(payload.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

function guardContext(request) {
  return { switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ once: () => undefined }) }) };
}

/** The identity without the per-request disconnect signal (#386), for comparing values. */
function withoutSignal({ signal, ...identity }) {
  assert.ok(signal instanceof AbortSignal);
  return identity;
}

test('workspace guard rejects production, missing development auth and session mode without a session', async () => {
  for (const env of [
    { NODE_ENV: 'production', DEV_AUTH_ENABLED: 'true' },
    { NODE_ENV: 'development', DEV_AUTH_ENABLED: 'false' },
    { NODE_ENV: 'development', DEV_AUTH_ENABLED: 'true', AUTH_MODE: 'session' },
  ]) {
    await assert.rejects(
      new WorkspaceGuard(new ConfigService(env)).canActivate(guardContext({ headers: {}, method: 'GET' })),
      (error) => error.getStatus() === 401 && error.response.code === 'AUTH_REQUIRED',
    );
  }
});

test('workspace guard injects an explicit local development identity in dev mode', async () => {
  const request = { headers: {}, method: 'GET' };
  assert.equal(await new WorkspaceGuard(new ConfigService({ NODE_ENV: 'development', DEV_AUTH_ENABLED: 'true' })).canActivate(guardContext(request)), true);
  assert.deepEqual(withoutSignal(request.identity), {
    workspaceId: 'local-screening-workspace',
    actorId: 'local-screening-user',
    roles: ['admin', 'hr', 'interviewer'],
    kind: 'dev',
  });
});

test('workspace guard trusts other backends only with the shared service token', async () => {
  const guard = new WorkspaceGuard(new ConfigService({ AUTH_MODE: 'session', SERVICE_TOKEN: 'svc-secret' }));
  const request = { method: 'POST', headers: { 'x-hireos-service-token': 'svc-secret', 'x-workspace-id': 'ws-1', 'x-actor-id': 'user-1' } };
  assert.equal(await guard.canActivate(guardContext(request)), true);
  assert.deepEqual(withoutSignal(request.identity), { workspaceId: 'ws-1', actorId: 'user-1', roles: [], kind: 'service' });
  await assert.rejects(
    guard.canActivate(guardContext({ method: 'GET', headers: { 'x-hireos-service-token': 'wrong', 'x-workspace-id': 'ws-1' } })),
    (error) => error.getStatus() === 401 && error.response.code === 'INVALID_SERVICE_TOKEN',
  );
});

test('workspace guard resolves the hireos_sid cookie through the identity service and checks Origin', async () => {
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const { token } = JSON.parse(init.body);
    return new Response(JSON.stringify(token === 'good' ? { active: true, userId: 'u-1', workspaceId: 'ws-1', roles: ['hr'], email: 'a@b.c', displayName: 'A' } : { active: false }), { status: 200 });
  };
  try {
    const guard = new WorkspaceGuard(new ConfigService({
      AUTH_MODE: 'session',
      IDENTITY_INTERNAL_URL: 'http://identity/api',
      IDENTITY_INTERNAL_TOKEN: 'internal',
      ALLOWED_ORIGINS: 'https://hireos.example',
    }));
    const request = { method: 'POST', headers: { cookie: 'x=1; hireos_sid=good', origin: 'https://hireos.example' } };
    assert.equal(await guard.canActivate(guardContext(request)), true);
    assert.equal(request.identity.actorId, 'u-1');
    assert.equal(request.identity.kind, 'user');
    assert.equal(calls[0].url, 'http://identity/api/internal/sessions/introspect');
    assert.equal(calls[0].init.headers['x-internal-token'], 'internal');
    // Not cached: every request asks the identity service, so a sign-out applies to the very next call.
    await guard.canActivate(guardContext({ method: 'GET', headers: { cookie: 'hireos_sid=good' } }));
    assert.equal(calls.length, 2);
    await assert.rejects(
      guard.canActivate(guardContext({ method: 'POST', headers: { cookie: 'hireos_sid=good', origin: 'https://evil.example' } })),
      (error) => error.getStatus() === 403,
    );
    await assert.rejects(guard.canActivate(guardContext({ method: 'GET', headers: { cookie: 'hireos_sid=bad' } })), (error) => error.getStatus() === 401);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('phase 1 text and filename normalization preserve source boundaries', () => {
  assert.deepEqual(splitText('Alex Morgan\n\nBuilt APIs.'), [
    { id: '', text: 'Alex Morgan' },
    { id: '', text: 'Built APIs.' },
  ]);
  assert.equal(normalizeName('Alex_Morgan_resume_v2.pdf'), 'alex morgan');
  assert.equal(displayNameFromFileName('alex_morgan_resume_v2.pdf'), 'Alex Morgan');
});

test('local profile parser extracts evidence-backed contact and skills', () => {
  const parser = new ProfileParserService();
  const profile = parser.parse('mat-1', [
    { id: 's1', text: 'Grace Hopper\n\n' +
      'grace.hopper@example.com\n+1 212-555-0199\n' +
      'Location: Arlington, Virginia\nSkills: TypeScript, React, AWS' },
  ], 'Fallback Name');
  assert.equal(profile.displayName, 'Grace Hopper');
  assert.equal(profile.email, 'grace.hopper@example.com');
  assert.equal(profile.location.value, 'Arlington, Virginia');
  assert.deepEqual(profile.skills.map((skill) => skill.name), ['TypeScript', 'React', 'AWS']);
  assert.equal(profile.skills[0].evidence.sourceMaterialId, 'mat-1');
});

test('errorDetails marks file-level user errors as non-retryable and other failures as retryable', () => {
  const badRequestLike = (code) => ({ response: { code, message: 'bad' } });

  assert.equal(errorDetails(badRequestLike('EMPTY_FILE')).retryable, false);
  assert.equal(errorDetails(badRequestLike('FILE_TOO_LARGE')).retryable, false);
  assert.equal(errorDetails(badRequestLike('UNSUPPORTED_FILE_TYPE')).retryable, false);

  // Unclassified failures (DB hiccup, downstream service timeout, etc.) must stay
  // retryable, otherwise a transient outage would permanently strand an import item.
  assert.equal(errorDetails(new Error('ECONNRESET')).retryable, true);
  assert.equal(errorDetails({}).retryable, true);
});

test('security scan quarantines disguised executables and active-content documents', () => {
  const scanner = new SecurityScanService();

  const exe = Buffer.concat([Buffer.from([0x4d, 0x5a]), Buffer.from('fake pe body')]);
  assert.deepEqual(scanner.scan(exe, 'text/plain', 'resume.txt'), {
    status: 'quarantined',
    reason: 'EXECUTABLE_SIGNATURE_DETECTED',
  });

  const pdfWithJs = Buffer.from('%PDF-1.4\n<< /OpenAction << /S /JavaScript /JS (app.alert(1)) >> >>');
  assert.deepEqual(scanner.scan(pdfWithJs, 'application/pdf', 'resume.pdf'), {
    status: 'quarantined',
    reason: 'PDF_ACTIVE_CONTENT_DETECTED',
  });

  const docxWithMacro = Buffer.from('PK\x03\x04...word/vbaProject.bin...');
  assert.deepEqual(
    scanner.scan(docxWithMacro, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'resume.docx'),
    { status: 'quarantined', reason: 'OFFICE_MACRO_DETECTED' },
  );

  const cleanText = Buffer.from('Jane Doe\nSkills: TypeScript');
  assert.deepEqual(scanner.scan(cleanText, 'text/plain', 'resume.txt'), { status: 'passed' });
});

test('normalizeTextForDedupe collapses formatting so the same content hashes identically', () => {
  const fromPdf = 'Jane Doe\n\nEmail: jane@example.com\n\nSkills: TypeScript, React';
  const fromDocx = 'Jane   Doe\nEmail:  jane@example.com\nSkills:   TypeScript,   React  ';
  assert.equal(normalizeTextForDedupe(fromPdf), normalizeTextForDedupe(fromDocx));

  const different = 'John Smith\nEmail: john@example.com\nSkills: Go, Kubernetes';
  assert.notEqual(normalizeTextForDedupe(fromPdf), normalizeTextForDedupe(different));

  // CJK text must survive normalization, not get stripped to nothing.
  assert.equal(normalizeTextForDedupe('张三\n技能：TypeScript'), '张三 技能 typescript');
});
