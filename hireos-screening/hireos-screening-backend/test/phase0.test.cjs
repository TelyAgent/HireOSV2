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

test('workspace guard rejects production and missing development auth', () => {
  const context = {
    switchToHttp() {
      return { getRequest: () => ({}) };
    },
  };

  assert.throws(
    () => new WorkspaceGuard(new ConfigService({ NODE_ENV: 'production', DEV_AUTH_ENABLED: 'true' })).canActivate(context),
    (error) => error.getStatus() === 401 && error.response.code === 'AUTH_REQUIRED',
  );
  assert.throws(
    () => new WorkspaceGuard(new ConfigService({ NODE_ENV: 'development', DEV_AUTH_ENABLED: 'false' })).canActivate(context),
    (error) => error.getStatus() === 401 && error.response.code === 'AUTH_REQUIRED',
  );
});

test('workspace guard injects an explicit local development identity', () => {
  const request = {};
  const context = {
    switchToHttp() {
      return { getRequest: () => request };
    },
  };

  assert.equal(
    new WorkspaceGuard(new ConfigService({ NODE_ENV: 'development', DEV_AUTH_ENABLED: 'true' })).canActivate(context),
    true,
  );
  assert.deepEqual(request.identity, {
    workspaceId: 'local-screening-workspace',
    actorId: 'local-screening-user',
    roles: ['recruiter', 'hiring_manager', 'admin'],
  });
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
