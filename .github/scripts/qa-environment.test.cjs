/* eslint-disable @typescript-eslint/no-require-imports -- Node regression tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { touchedProjects, allowedChange, guard } = require('./qa-environment.cjs');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const projects = [{ name: 'api', dir: 'services/api', checks: [], known_failing: [] }];
test('QA selects merged PR paths rather than mutable base/head diff', () => {
  assert.deepEqual(touchedProjects({ phase: 'qa', changed_files: [{ filename: 'services/api/src/a.js' }] }, projects), projects);
  assert.deepEqual(touchedProjects({ phase: 'qa', changed_files: [{ filename: 'docs/a.md' }] }, projects), []);
  assert.throws(() => touchedProjects({ phase: 'review' }, projects), /merged changed_files/);
  assert.equal(allowedChange('services/api/test/qa.test.cjs', projects), true);
  assert.equal(allowedChange('services/api/src/a.js', projects), false);
});
test('QA guard preserves untracked tests and rejects staged product edits', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-guard-')), previous = process.cwd();
  try {
    process.chdir(folder);
    const git = (...args) => execFileSync('git', args, { stdio: 'pipe' });
    git('init'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid');
    fs.mkdirSync('services/api/src', { recursive: true }); fs.writeFileSync('services/api/src/a.js', 'old');
    git('add', '.'); git('commit', '-m', 'fixture');
    fs.mkdirSync('evidence'); fs.writeFileSync('evidence/projects.json', JSON.stringify(projects));
    fs.mkdirSync('services/api/test'); fs.writeFileSync('services/api/test/qa.test.cjs', 'temporary');
    guard(); assert.match(fs.readFileSync('evidence/qa-tests.patch', 'utf8'), /temporary/);
    fs.writeFileSync('services/api/src/a.js', 'changed'); git('add', 'services/api/src/a.js');
    assert.throws(() => guard(), /modified product files/);
  } finally { process.chdir(previous); fs.rmSync(folder, { recursive: true, force: true }); }
});
test('QA preparation installs each selected project and preserves failed installer output', () => {
  const { prepare } = require('./qa-environment.cjs');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-install-')), previous = process.cwd();
  try {
    process.chdir(folder); fs.mkdirSync('.github/ci', { recursive: true });
    fs.writeFileSync('.github/ci/projects.json', JSON.stringify({ projects: [{ ...projects[0], prisma: true }] }));
    const calls = [], context = { phase: 'qa', changed_files: [{ filename: 'services/api/src/a.js' }] };
    prepare(context, { runner: (tool, args, options) => { calls.push({ tool, args, cwd: options.cwd }); return 'installed'; } });
    assert.deepEqual(calls, [{ tool: 'npm', args: ['ci', '--no-audit', '--no-fund'], cwd: 'services/api' },
      { tool: 'npx', args: ['prisma', 'generate'], cwd: 'services/api' }]);
    assert.equal(JSON.parse(fs.readFileSync('evidence/projects.json'))[0].name, 'api');
    assert.throws(() => prepare(context, { runner: () => { throw Object.assign(new Error('failed'), { stderr: 'installer failed' }); } }), /failed/);
    assert.match(fs.readFileSync('evidence/install-api.log', 'utf8'), /installer failed/);
  } finally { process.chdir(previous); fs.rmSync(folder, { recursive: true, force: true }); }
});
