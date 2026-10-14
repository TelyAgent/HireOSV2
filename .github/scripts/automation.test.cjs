/* eslint-disable @typescript-eslint/no-require-imports -- node:test runs this CommonJS file directly. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadProjects, selectProjects } = require('./projects.cjs');
const { readReport } = require('./report.cjs');
const { render, renderQa, MARKER, QA_MARKER } = require('./publish-review.cjs');

const ROOT = path.join(__dirname, '../..');
const SHA = 'a'.repeat(40);
const context = { issue: 7, pr: 9, commit: SHA };

function writeReport(report) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'review-')), 'review.json');
  fs.writeFileSync(file, JSON.stringify(report));
  return file;
}

const passing = { result: 'pass', issue: 7, pr: 9, commit: SHA, security: 'pass', summary: 'ok', findings: [] };

test('registry points at real projects with matching npm scripts', () => {
  for (const p of loadProjects()) {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, p.dir, 'package.json'), 'utf8'));
    for (const check of p.checks) assert.ok(pkg.scripts?.[check], `${p.name} lacks npm script ${check}`);
    assert.equal(fs.existsSync(path.join(ROOT, p.dir, 'prisma')), p.prisma, `${p.name} prisma flag`);
  }
});

test('selects only projects touched by the diff', () => {
  const projects = loadProjects();
  const picked = selectProjects(projects, ['hireos-jd/hireos-jd-front/src/a.tsx', 'docs/x.md']);
  assert.deepEqual(picked.map(p => p.name), ['jd-front']);
});

test('docs-only diff selects nothing; unknown diff and CI config select everything', () => {
  const projects = loadProjects();
  assert.equal(selectProjects(projects, ['README.md', 'PORTS.md']).length, 0);
  assert.equal(selectProjects(projects, null).length, projects.length);
  assert.equal(selectProjects(projects, ['.github/ci/projects.json']).length, projects.length);
});

test('directory prefix does not match sibling names', () => {
  const projects = [{ name: 'a', dir: 'hireos-jd/hireos-jd-front', checks: [], known_failing: [] }];
  assert.equal(selectProjects(projects, ['hireos-jd/hireos-jd-front-old/x.ts']).length, 0);
});

test('known_failing must be a declared check', () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'reg-')), 'p.json');
  fs.writeFileSync(file, JSON.stringify({ projects: [{ name: 'x', dir: 'x', checks: ['build'], known_failing: ['lint'] }] }));
  assert.throws(() => loadProjects(file), /not in checks/);
});

test('accepts a consistent review report', () => {
  assert.equal(readReport('review', writeReport(passing), context).result, 'pass');
});

test('rejects contradictory pass and mismatched identity', () => {
  const blocking = { ...passing, findings: [{ blocking: true, path: 'a.ts', line: 1, description: 'd', evidence: 'e' }] };
  assert.throws(() => readReport('review', writeReport(blocking), context), /Contradictory/);
  assert.throws(() => readReport('review', writeReport({ ...passing, security: 'fail' }), context), /Contradictory/);
  assert.throws(() => readReport('review', writeReport({ ...passing, pr: 10 }), context), /Mismatched pr/);
});

test('rejects unknown fields from the model', () => {
  assert.throws(() => readReport('review', writeReport({ ...passing, extra: 1 }), context), /Unknown/);
});

test('publisher marks missing report as blocked, never pass', () => {
  const body = render(null, 'https://run');
  assert.ok(body.startsWith(MARKER));
  assert.match(body, /\[AI-BLOCKED\]/);
  assert.match(render(passing, 'https://run'), /\[AI-EVIDENCE\] Claude Review: \*\*pass\*\*/);
});

const qaContext = { ...context, issue_body: '### Acceptance Criteria\n\n- AC-1: works\n- AC-2: fails safely\n\n### References\n\nNone' };
const qaPass = {
  result: 'pass', issue: 7, pr: 9, commit: SHA,
  acceptance_criteria: [{ id: 'AC-1', result: 'pass', evidence: 'npm test exit 0' }, { id: 'AC-2', result: 'pass', evidence: 'qa-a.test.cjs' }],
  tests_added: ['test/qa-a.test.cjs'], tests_executed: ['npm --prefix x test (exit 0)'], regressions: [], bugs: [],
};
const writeQa = report => { const f = writeReport(report).replace(/review\.json$/, 'qa.json'); fs.writeFileSync(f, JSON.stringify(report)); return f; };

test('accepts a QA report covering every AC exactly once', () => {
  assert.equal(readReport('qa', writeQa(qaPass), qaContext).result, 'pass');
});

test('rejects QA reports with missing ACs, missing evidence or a contradictory pass', () => {
  assert.throws(() => readReport('qa', writeQa({ ...qaPass, acceptance_criteria: qaPass.acceptance_criteria.slice(0, 1) }), qaContext), /every Acceptance Criterion/);
  assert.throws(() => readReport('qa', writeQa({ ...qaPass, acceptance_criteria: [qaPass.acceptance_criteria[0], { id: 'AC-2', result: 'pass', evidence: ' ' }] }), qaContext), /Missing AC evidence/);
  assert.throws(() => readReport('qa', writeQa({ ...qaPass, tests_executed: [] }), qaContext), /Contradictory QA pass/);
  const bug = { severity: 'S2', title: 't', reproduction: 'r', evidence: 'e' };
  assert.throws(() => readReport('qa', writeQa({ ...qaPass, bugs: [bug] }), qaContext), /Contradictory QA pass/);
  assert.equal(readReport('qa', writeQa({ ...qaPass, result: 'fail', bugs: [bug] }), qaContext).result, 'fail');
});

test('QA comment lists every AC and marks a missing report as blocked', () => {
  const body = renderQa({ ...qaPass, acceptance_criteria: [...qaPass.acceptance_criteria.slice(0, 1), { id: 'AC-2', result: 'fail', evidence: 'a|b\nc' }] }, 'https://run');
  assert.ok(body.startsWith(QA_MARKER));
  assert.match(body, /\| AC-1 \| ✅ pass \|/); assert.match(body, /\| AC-2 \| ❌ fail \| a\\\|b<br>c \|/);
  assert.match(renderQa(null, 'https://run'), /\[AI-BLOCKED\] Claude QA/);
});

// Batch QA (#39): Issue → merged PR → the same context.json the PR-time QA used.
const { buildIssueContext } = require('./batch-context.cjs');
const { closingIssueNumbers, assertIssueReady } = require('./issue-contract.cjs');

const READY_BODY = ['Type', 'Subsystem', 'Problem', 'User Outcome', 'Scope', 'Non-goals', 'Acceptance Criteria',
  'References', 'Dependencies', 'Risk', 'Owner', 'AI Ready']
  .map(f => `### ${f}\n\n${f === 'AI Ready' ? 'Yes' : f === 'Acceptance Criteria' ? '- AC-1: works' : 'x'}`).join('\n\n');

function fakeGithub({ issueBody = READY_BODY, prs = [] } = {}) {
  const rest = {
    issues: { get: async ({ issue_number }) => ({ data: { number: issue_number, body: issueBody } }), listComments: async () => {} },
    pulls: { list: async () => {}, listReviewComments: async () => {} },
    repos: { getCommit: async ({ ref }) => ({ data: { sha: ref, parents: [{ sha: 'p'.repeat(40) }] } }) },
  };
  return {
    rest,
    paginate: async (fn, params) => (fn === rest.pulls.list ? prs : fn === rest.issues.listComments ? [{ id: params.issue_number }] : []),
  };
}
const repo = { owner: 'o', repo: 'r' };
const pr = (number, body, merged_at, sha = String(number).repeat(40).slice(0, 40)) => ({ number, body, merged_at, merge_commit_sha: sha });

test('closing-keyword parsing matches the PR contract', () => {
  assert.deepEqual(closingIssueNumbers('Closes #34\nRefs #16'), [34]);
  assert.deepEqual(closingIssueNumbers('Fixes #3 and resolves #3'), [3]);
  assert.deepEqual(closingIssueNumbers('Refs #34'), []);
});

test('batch QA finds the merged PR that closed the Issue and uses its merge commit', async () => {
  const github = fakeGithub({
    prs: [
      pr(36, 'Closes #18', '2026-10-14T03:00:00Z'),
      pr(40, 'Closes #340', '2026-10-14T05:00:00Z'), // #340, not #34
      pr(37, 'Closes #34', null), // closed without merging
      pr(38, 'Closes #34\nRefs #16', '2026-10-14T04:00:00Z', 'b'.repeat(40)),
    ],
  });
  const ctx = await buildIssueContext({ github, repo, issueNumber: 34 });
  assert.equal(ctx.issue, 34);
  assert.equal(ctx.pr, 38);
  assert.equal(ctx.commit, 'b'.repeat(40));
  assert.equal(ctx.base, 'p'.repeat(40));
  assert.equal(ctx.issue_body, READY_BODY);
  assert.deepEqual(ctx.issue_comments, [{ id: 34 }]);
  assert.deepEqual(ctx.pr_comments, [{ id: 38 }]);
  // The context must satisfy the same identity checks the QA report is validated against.
  assert.equal(readReport('qa', writeQa({ ...qaPass, issue: 34, pr: 38, commit: 'b'.repeat(40), acceptance_criteria: [qaPass.acceptance_criteria[0]] }), ctx).result, 'pass');
});

test('batch QA refuses an Issue with no merged PR or that breaks the contract, with a readable reason', async () => {
  await assert.rejects(buildIssueContext({ github: fakeGithub({ prs: [pr(37, 'Closes #34', null)] }), repo, issueNumber: 34 }), /no merged PR/);
  await assert.rejects(buildIssueContext({ github: fakeGithub({ issueBody: READY_BODY.replace('### AI Ready\n\nYes', '### AI Ready\n\nNo') }), repo, issueNumber: 34 }), /AI Ready must be Yes/);
  await assert.rejects(buildIssueContext({ github: fakeGithub({ issueBody: READY_BODY.replace('- AC-1: works', '- works') }), repo, issueNumber: 34 }), /AC-1 style/);
  await assert.rejects(buildIssueContext({ github: fakeGithub(), repo, issueNumber: 0 }), /Invalid Issue number/);
  assert.throws(() => assertIssueReady({ pull_request: {}, body: READY_BODY }), /points to a PR/);
});

test('QA no longer gates PRs: ci.yml has no qa job and the merge gate does not wait for it', () => {
  const ci = fs.readFileSync(path.join(ROOT, '.github/workflows/ci.yml'), 'utf8');
  assert.doesNotMatch(ci, /^ {2}qa:/m);
  assert.doesNotMatch(ci, /claude-qa\.yml/);
  assert.match(ci, /needs: \[detect, checks, contract, review\]/);
  const batch = fs.readFileSync(path.join(ROOT, '.github/workflows/qa-batch.yml'), 'utf8');
  assert.match(batch, /workflow_dispatch/);
  assert.match(batch, /fail-fast: false/);
});
