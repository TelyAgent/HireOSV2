/* eslint-disable @typescript-eslint/no-require-imports -- Node tests for Issue submission and Actions. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs, submitIssue } = require('./issue-submit.cjs');
const checkFormat = require('./issue-format.cjs');

function body(overrides = {}) {
  const fields = { Type: 'Bug', Problem: 'Broken behavior', 'User Outcome': 'Restore behavior', Scope: 'One fix',
    'Non-goals': 'Other changes', 'Acceptance Criteria': '- AC-1: reject bad input', References: 'None; local defect',
    Dependencies: 'None', Risk: 'low', Owner: '@supervisor', Estimate: 'TBD', 'AI Ready': 'No',
    Reproduction: 'Open the view', 'Expected / Actual': 'Expected usable; actual broken',
    Environment: 'Node fixture', Severity: 'S3', ...overrides };
  return Object.entries(fields).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `### ${key}\n\n${value}\n`).join('\n');
}
function file(text, run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issue-submit-test-'));
  const filename = path.join(dir, 'body.md');
  fs.writeFileSync(filename, text);
  try { return run(filename); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const options = filename => parseArgs(['create', '--repo', 'owner/repo', '--title', 'Fix behavior', '--body-file', filename]);

test('invalid final bodies never invoke gh for create or edit', () => {
  const invalid = [body({ Estimate: 'TBD — not estimated' }), body({ Estimate: undefined }),
    body().replace('### Problem', '## Problem'), body() + '\n### Risk\n\nlow\n', body({ Risk: 'urgent' }),
    body({ 'Acceptance Criteria': '- AC-1: one\n- AC-1: two' }), body({ 'Acceptance Criteria': '- AC-1:' })];
  for (const value of invalid) file(value, filename => {
    for (const action of ['create', 'edit']) {
      const opts = action === 'create' ? options(filename) : parseArgs(['edit', '--issue', '5', '--body-file', filename]);
      let calls = 0;
      assert.throws(() => submitIssue(opts, () => { calls++; }));
      assert.equal(calls, 0);
    }
  });
});

test('create sends exact captured Unicode/Markdown body and no shell command text', () => {
  const text = body({ Scope: '`$(touch unwanted)`; `backticks`\n越南语 → tiếng Việt' });
  file(text, filename => {
    const calls = [];
    const issue = submitIssue(options(filename), (args, input) => {
      calls.push({ args, input });
      return JSON.stringify({ html_url: 'https://github.com/owner/repo/issues/5' });
    });
    assert.equal(issue.html_url, 'https://github.com/owner/repo/issues/5');
    assert.deepEqual(calls[0].args, ['api', '--method', 'POST', 'repos/owner/repo/issues', '--input', '-']);
    assert.deepEqual(JSON.parse(calls[0].input), { title: 'Fix behavior', body: text });
  });
});

test('file mutation after validation cannot change create or edit payload', () => {
  for (const action of ['create', 'edit']) file(body(), filename => {
    const original = fs.readFileSync(filename, 'utf8');
    const opts = action === 'create' ? parseArgs(['create', '--title', 'Fix', '--body-file', filename]) :
      parseArgs(['edit', '--issue', '5', '--body-file', filename]);
    let payload;
    submitIssue(opts, (args, input) => {
      fs.writeFileSync(filename, 'invalid replacement');
      if (args[0] === 'repo') return 'owner/repo\n';
      if (!input) return JSON.stringify({ number: 5, body: 'saved body' });
      payload = JSON.parse(input);
      return JSON.stringify({ html_url: 'https://github.com/owner/repo/issues/5' });
    });
    assert.equal(payload.body, original);
    if (action === 'edit') assert.deepEqual(Object.keys(payload), ['body']);
  });
});

test('edit refuses PRs, mismatched Issue identity and failed reads without writing', () => {
  for (const value of [{ number: 5, pull_request: {} }, { number: 6 }, new Error('read unavailable')]) {
    file(body(), filename => {
      let writes = 0;
      assert.throws(() => submitIssue(parseArgs(['edit', '--repo', 'owner/repo', '--issue', '5', '--body-file', filename]),
        (_args, input) => { if (input) writes++; if (value instanceof Error) throw value; return JSON.stringify(value); }));
      assert.equal(writes, 0);
    });
  }
});

test('write errors propagate without retrying or reporting success', () => file(body(), filename => {
  let calls = 0;
  assert.throws(() => submitIssue(options(filename), () => { calls++; throw new Error('write rejected'); }), /write rejected/);
  assert.equal(calls, 1);
}));

test('CLI rejects unknown/duplicate options, missing arguments and privileged modes', () => {
  for (const args of [[], ['delete'], ['create', '--body-file', 'x'],
    ['create', '--title', 'ok', '--body-file', 'x', '--mode', 'ledger-bug'],
    ['edit', '--issue', '0', '--body-file', 'x'], ['edit', '--issue', '9007199254740993', '--body-file', 'x'],
    ['edit', '--issue', '5', '--title', 'rename', '--body-file', 'x'],
    ['create', '--title', 'ok', '--body-file', 'x', '--body-file', 'y']]) assert.throws(() => parseArgs(args));
  file(body({ Owner: 'Pending human triage; source Issue #12 owner to assign.' }), filename => {
    assert.throws(() => submitIssue(options(filename), () => assert.fail('must not contact gh')), /Owner/);
  });
  const result = spawnSync(process.execPath, [path.join(__dirname, 'issue-submit.cjs'), 'create', '--mode', 'ledger-bug'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
});

function fixture(issue, overrides = {}) {
  const summary = { heading: '', raw: '', addHeading(text) { this.heading = text; return this; },
    addRaw(text) { this.raw += text; return this; }, async write() {} };
  const failures = [];
  const context = { eventName: 'issues', repo: { owner: 'owner', repo: 'repo' },
    payload: { action: 'opened', issue: { number: 5 }, repository: { default_branch: 'main' } } };
  const github = { rest: { issues: { get: async () => ({ data: { number: 5, body: body(), ...issue } }) }, ...overrides } };
  return { github, context, core: { summary, setFailed: message => failures.push(message) }, summary, failures };
}

test('opened/edited check fetches current body and reports pass/fail without writes', async () => {
  for (const action of ['opened', 'edited']) {
    const f = fixture(); f.context.payload.action = action; f.context.payload.issue.body = 'stale invalid event body';
    assert.equal((await checkFormat(f)).valid, true);
    assert.equal(f.failures.length, 0);
    const bad = fixture({ body: body({ Estimate: 'TBD with explanation' }) }); bad.context.payload.action = action;
    assert.equal((await checkFormat(bad)).valid, false);
    assert.equal(bad.failures.length, 1);
    assert.match(bad.summary.raw, /Estimate must be one of/);
  }
});

test('Issue content remains data; unsafe heading diagnostics are escaped', async () => {
  const f = fixture({ body: body() + '\n### <img src=x onerror=alert(1)>\n\nvalue\n' });
  assert.equal((await checkFormat(f)).valid, false);
  assert.doesNotMatch(f.summary.raw, /<img/);
  assert.match(f.summary.raw, /&lt;img/);
});

test('wrong events, PR identity and Issue read failures fail closed', async () => {
  for (const update of [f => { f.context.eventName = 'pull_request'; },
    f => { f.context.payload.action = 'closed'; }, f => { f.context.payload.issue.number = -1; }]) {
    const f = fixture(); update(f); await assert.rejects(checkFormat(f));
  }
  await assert.rejects(checkFormat(fixture({ pull_request: {} })), /not PR/);
  const f = fixture(); f.github.rest.issues.get = async () => { throw new Error('read denied'); };
  await assert.rejects(checkFormat(f), /read denied/);
});

function ledgerFixture() {
  const sha = 'a'.repeat(40), pr = 12;
  const run = { name: 'Codex QA', path: '.github/workflows/codex-qa.yml', event: 'pull_request',
    head_repository: { full_name: 'owner/repo' }, display_title: `QA after merge · PR #${pr} · ${sha}`, pull_requests: [] };
  const issue = { body: '<!-- codex-qa-bug:0123456789abcdef0123 -->\n' + body({
    Owner: 'Pending human triage; source Issue #12 owner to assign.',
    References: 'https://github.com/owner/repo/actions/runs/123\nSource PR: #12', Environment: `Commit: ${sha}` }),
    user: { login: 'github-actions[bot]', type: 'Bot' }, labels: [{ name: 'needs-triage' }] };
  const f = fixture(issue, { actions: { getWorkflowRun: async () => ({ data: run }) }, pulls: { get: async () => ({ data: {
    number: pr, state: 'closed', merged: true, merge_commit_sha: sha,
    head: { repo: { full_name: 'owner/repo' } }, base: { ref: 'main', repo: { full_name: 'owner/repo' } },
  } }) } });
  return { f, issue, run };
}

test('only bot Ledger bugs with verified QA workflow and merged SHA receive exception', async () => {
  const { f } = ledgerFixture(); assert.equal((await checkFormat(f)).valid, true);
  for (const change of [({ issue }) => { issue.user.login = 'human'; },
    ({ run }) => { run.path = '.github/workflows/forged.yml'; },
    ({ issue }) => { issue.labels = []; },
    ({ issue }) => { issue.body = issue.body.replace('Source PR: #12', 'Source PR: #13'); },
    ({ issue }) => { issue.body = issue.body.replace('### Estimate\n\nTBD', '### Estimate\n\n3'); }]) {
    const item = ledgerFixture(); change(item);
    assert.equal((await checkFormat(item.f)).valid, false);
  }
});

test('failed Ledger provenance read cannot grant exception', async () => {
  const { f } = ledgerFixture(); f.github.rest.actions.getWorkflowRun = async () => { throw new Error('artifact metadata denied'); };
  assert.equal((await checkFormat(f)).valid, false);
  assert.match(f.summary.raw, /Could not verify Ledger provenance/);
});

test('workflow uses trusted default branch and read-only Issue events; CI includes new tests', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../workflows/issue-format.yml'), 'utf8');
  assert.match(workflow, /issues:\s*\n\s*types: \[opened, edited\]/);
  assert.match(workflow, /ref: \$\{\{ github.event.repository.default_branch \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /: write|github.event.issue.body|pull_request_target/);
  assert.match(workflow, /require\('\.\/.github\/scripts\/issue-format.cjs'\)/);
  const ci = fs.readFileSync(path.join(__dirname, '../workflows/ci.yml'), 'utf8');
  assert.match(ci, /node --test .*issue-submit.test.cjs/);
});
