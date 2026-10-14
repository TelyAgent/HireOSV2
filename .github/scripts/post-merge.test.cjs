/* eslint-disable @typescript-eslint/no-require-imports -- Node test runner for CommonJS Actions scripts. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareTarget, mergedTarget } = require('./post-merge.cjs');
const { publicationTarget } = require('./quality-source.cjs');
const loadContext = require('./context.cjs');
const { readReport } = require('./report.cjs');
const isEvidencePR = require('./evidence-pr.cjs');
const ledger = require('./ledger.cjs');

const repo = { owner: 'owner', repo: 'repo' };
const head = 'a'.repeat(40), merged = 'b'.repeat(40), base = 'c'.repeat(40);
function productPR(overrides = {}) {
  return { number: 7, body: 'Closes #9', state: 'closed', merged: true, merge_commit_sha: merged,
    changed_files: 1, head: { ref: 'codex/product', sha: head, repo: { full_name: 'owner/repo' } },
    base: { ref: 'main', sha: base, repo: { full_name: 'owner/repo' } }, ...overrides };
}
const changes = [{ filename: 'src/feature.js', status: 'modified', patch: '@@ change @@' }];
function closedContext(pr = productPR()) {
  return { repo, eventName: 'pull_request', payload: { number: pr.number, action: 'closed',
    repository: { default_branch: 'main' }, pull_request: pr } };
}
function issueBody() {
  const fields = { Type: 'Feature', Problem: 'Missing behavior', 'User Outcome': 'Behavior works',
    Scope: 'One feature', 'Non-goals': 'None', 'Acceptance Criteria': 'AC-1: behavior works',
    References: 'Local fixture', Dependencies: 'None', Risk: 'low', Owner: '@supervisor',
    Estimate: '3', 'AI Ready': 'Yes', 'User Flows': 'Call the feature' };
  return Object.entries(fields).map(([name, value]) => '### ' + name + '\n\n' + value).join('\n\n');
}
function run(phase, overrides = {}) {
  return { name: phase === 'qa' ? 'Codex QA' : 'CI',
    path: '.github/workflows/' + (phase === 'qa' ? 'codex-qa' : 'ci') + '.yml',
    display_title: phase === 'qa' ? 'QA after merge · PR #7 · ' + merged : 'Review before merge · PR #7 · ' + head,
    event: 'pull_request',
    head_repository: { full_name: 'owner/repo' }, head_sha: head,
    pull_requests: phase === 'qa' ? [] : [{ number: 7 }], id: phase === 'qa' ? 102 : 101,
    html_url: 'https://example.invalid/run/' + phase, conclusion: 'success', ...overrides };
}
function report(phase, overrides = {}) {
  const identity = { issue: 9, pr: 7, commit: phase === 'qa' ? merged : head, result: 'pass' };
  return phase === 'qa' ? { ...identity, acceptance_criteria: [{ id: 'AC-1', result: 'pass', evidence: 'evidence/test.log' }],
    tests_added: [], tests_executed: ['node test: exit 0; evidence/test.log'], bugs: [], regressions: [], ...overrides }
    : { ...identity, security: 'pass', summary: 'Checked changed code and authorization.', findings: [], ...overrides };
}
function temp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'post-merge-test-')); }
async function prepare(pr, context = closedContext(pr), files = changes) {
  const outputs = {};
  await prepareTarget({ context, core: { setOutput: (key, value) => { outputs[key] = value; } },
    github: { rest: { pulls: { get: async () => ({ data: pr }), listFiles: {} } }, paginate: async () => files } });
  return outputs;
}

test('merge, squash and rebase targets use the final merged SHA, never PR head or a newer branch tip', async () => {
  for (const [method, sha] of [['merge', merged], ['squash', 'd'.repeat(40)], ['rebase', 'e'.repeat(40)]]) {
    const pr = productPR({ merge_commit_sha: sha });
    const context = closedContext(pr);
    context.payload.repository.pushed_tip = 'f'.repeat(40);
    assert.deepEqual(await prepare(pr, context), { eligible: 'true', commit: sha }, method);
    assert.deepEqual(mergedTarget(pr, { repo, defaultBranch: 'main' }), { pr: 7, commit: sha });
  }
});
test('updates, unmerged closes, forks and non-default-branch merges are excluded', async () => {
  for (const pr of [productPR({ merged: false }), productPR({ state: 'open' }),
    productPR({ base: { ...productPR().base, ref: 'release' } }),
    productPR({ head: { ...productPR().head, repo: { full_name: 'fork/repo' } } })]) {
    assert.equal((await prepare(pr)).eligible, 'false');
  }
  for (const action of ['opened', 'synchronize', 'edited']) {
    const context = closedContext(); context.payload.action = action;
    assert.equal((await prepare(productPR(), context)).eligible, 'false');
  }
  const context = closedContext(); context.eventName = 'push';
  assert.equal((await prepare(productPR(), context)).eligible, 'false');
});
test('closed-event merge SHA and PR number must match the API before QA can run', async () => {
  const context = closedContext(); context.payload.pull_request = productPR({ merge_commit_sha: 'd'.repeat(40) });
  await assert.rejects(prepare(productPR(), context), /does not match/);
  await assert.rejects(prepare(productPR({ number: 8 }), closedContext()), /does not match/);
  await assert.rejects(prepare(productPR({ merge_commit_sha: null })), /Invalid merged PR identity/);
});
test('merged evidence PRs are skipped and forged reserved branches fail closed', async () => {
  const pr = productPR({ head: { ...productPR().head, ref: 'quality-ledger/pr-42' },
    user: { login: 'github-actions[bot]', type: 'Bot' }, changed_files: 2 });
  const files = [{ filename: 'docs/quality/reports/PR-42.md', status: 'added' },
    { filename: 'docs/quality/reports/PR-42-review.md', status: 'added' }];
  assert.equal((await prepare(pr, closedContext(pr), files)).eligible, 'false');
  await assert.rejects(prepare({ ...pr, user: { login: 'human', type: 'User' } }, closedContext(pr), files), /provenance/);
});
test('evidence classification accepts both phase records only for the matching source PR', async () => {
  const pr = productPR({ head: { ...productPR().head, ref: 'quality-ledger/pr-42' },
    user: { login: 'github-actions[bot]', type: 'Bot' }, changed_files: 3 });
  const files = ['', '-review', '-qa'].map(suffix => ({ filename: 'docs/quality/reports/PR-42' + suffix + '.md', status: 'added' }));
  const github = { rest: { pulls: { listFiles: {} } }, paginate: async () => files };
  assert.equal(await isEvidencePR({ github, repo, pr }), true);
  files[2].filename = 'docs/quality/reports/PR-43-qa.md';
  await assert.rejects(isEvidencePR({ github, repo, pr }), /file scope/);
});

test('QA context contains the merged identity and complete PR changes across squash/rebase', async () => {
  const folder = temp(), previous = process.cwd();
  const endpoints = { files: {}, comments: {}, inline: {} };
  const github = { rest: { pulls: { get: async () => ({ data: productPR() }), listFiles: endpoints.files,
    listReviewComments: endpoints.inline }, issues: { get: async () => ({ data: { number: 9, body: issueBody() } }),
    listComments: endpoints.comments } }, paginate: async endpoint => endpoint === endpoints.files ? changes : [] };
  try {
    process.chdir(folder);
    await loadContext({ github, context: closedContext(), phase: 'qa', commit: merged });
    const actual = JSON.parse(fs.readFileSync('evidence/context.json'));
    assert.equal(actual.commit, merged);
    assert.equal(actual.head, head);
    assert.equal(actual.phase, 'qa');
    assert.deepEqual(actual.changed_files, changes);
    fs.writeFileSync('qa.json', JSON.stringify(report('qa')));
    assert.equal(readReport('qa', 'qa.json', actual).result, 'pass');
    fs.writeFileSync('qa.json', JSON.stringify(report('qa', { commit: head })));
    assert.throws(() => readReport('qa', 'qa.json', actual), /Mismatched commit/);
    assert.throws(() => readReport('review', 'qa.json', actual), /Mismatched report phase/);
  } finally { process.chdir(previous); fs.rmSync(folder, { recursive: true, force: true }); }
});
test('QA context rejects PR-head identity, incomplete changes and pre-merge events', async () => {
  const github = { rest: { pulls: { get: async () => ({ data: productPR() }), listFiles: {} } }, paginate: async () => [] };
  await assert.rejects(loadContext({ github, context: closedContext(), phase: 'qa', commit: head }), /Mismatched QA merge commit/);
  await assert.rejects(loadContext({ github, context: closedContext(), phase: 'qa', commit: merged }), /Incomplete merged PR changes/);
  const context = closedContext(); context.payload.action = 'synchronize';
  await assert.rejects(loadContext({ github, context, phase: 'qa', commit: merged }), /merged PR event/);
});

test('post-merge publication resolves empty PR arrays using fixed GitHub run metadata and verifies merge identity', async () => {
  const github = { rest: { pulls: { get: async () => ({ data: productPR() }) } } };
  const target = await publicationTarget({ github, repo, run: run('qa'), defaultBranch: 'main' });
  assert.equal(target.phase, 'qa');
  assert.equal(target.commit, merged);
  assert.equal(target.pr.number, 7);
  // A deleted/reused source branch must not invalidate a fixed merged commit.
  github.rest.pulls.get = async () => ({ data: productPR({ head: { ...productPR().head, sha: 'f'.repeat(40) } }) });
  assert.equal((await publicationTarget({ github, repo, run: run('qa'), defaultBranch: 'main' })).commit, merged);
});
test('publication rejects forged phase/path/title, conflicting PRs and legacy QA runs', async () => {
  const github = { rest: { pulls: { get: async () => ({ data: productPR() }) } } };
  for (const overrides of [{ name: 'CI' }, { path: '.github/workflows/untrusted.yml' },
    { display_title: 'Old reusable QA' }, { pull_requests: [{ number: 99 }] }, { event: 'push' },
    { head_repository: { full_name: 'fork/repo' } }]) {
    await assert.rejects(publicationTarget({ github, repo, run: run('qa', overrides), defaultBranch: 'main' }));
  }
  assert.equal(await publicationTarget({ github, repo,
    run: run('qa', { display_title: 'QA after merge · PR #7 · ' + head }), defaultBranch: 'main' }), null);
});
test('a delayed Review publication still binds its head when GitHub omits the now-merged PR association', async () => {
  const github = { rest: { pulls: { get: async () => ({ data: productPR() }) } } };
  const metadata = run('review', { pull_requests: [] });
  const target = await publicationTarget({ github, repo, run: metadata, defaultBranch: 'main' });
  assert.equal(target.phase, 'review');
  assert.equal(target.commit, head);
  await assert.rejects(publicationTarget({ github, repo, run: { ...metadata,
    display_title: 'Review before merge · PR #7 · ' + merged }, defaultBranch: 'main' }), /Conflicting Review/);
  await assert.rejects(publicationTarget({ github, repo, run: { ...metadata,
    pull_requests: [{ number: 99 }] }, defaultBranch: 'main' }), /Conflicting Review/);
  await assert.rejects(publicationTarget({ github, repo, run: { ...metadata,
    display_title: 'Legacy CI without PR association' }, defaultBranch: 'main' }), /Expected one source PR/);
});
test('post-merge publication excludes unmerged closes and other target branches', async () => {
  for (const pr of [productPR({ merged: false }), productPR({ base: { ...productPR().base, ref: 'release' } })]) {
    const github = { rest: { pulls: { get: async () => ({ data: pr }) } } };
    assert.equal(await publicationTarget({ github, repo, run: run('qa'), defaultBranch: 'main' }), null);
  }
});

function publisher(folder) {
  const endpoints = { issues: {}, comments: {}, files: {} };
  const capture = { comments: [], bugs: [], trees: [], pulls: [], notices: [], files: new Map() };
  let tip = 'initial', tree = 'tree-initial', revision = 0;
  const github = { paginate: async endpoint => endpoint === endpoints.comments ? capture.comments
    : endpoint === endpoints.issues ? capture.bugs : changes,
    rest: {
      pulls: { get: async () => ({ data: productPR() }), listFiles: endpoints.files,
        list: async () => ({ data: capture.pulls }), create: async input => { capture.pulls.push(input); } },
      issues: { get: async () => ({ data: { number: 9, body: issueBody() } }),
        listComments: endpoints.comments, listForRepo: endpoints.issues,
        create: async input => { const bug = { ...input, number: 90, state: 'open' }; capture.bugs.push(bug); return { data: bug }; },
        createComment: async input => { capture.comments.push({ ...input, id: capture.comments.length + 1,
          user: { login: 'github-actions[bot]' } }); },
        updateComment: async input => { capture.comments.find(c => c.id === input.comment_id).body = input.body; } },
      git: {
        getRef: async ({ ref }) => ({ data: { object: { sha: ref === 'heads/main' ? 'initial' : tip } } }),
        getCommit: async ({ commit_sha }) => { assert.equal(commit_sha, tip); return { data: { tree: { sha: tree } } }; },
        createTree: async input => {
          assert.equal(input.base_tree, tree);
          capture.trees.push(input);
          for (const file of input.tree) capture.files.set(file.path, file.content);
          tree = 'tree-' + (++revision);
          return { data: { sha: tree } };
        },
        createCommit: async input => { assert.deepEqual(input.parents, [tip]); return { data: { sha: 'commit-' + revision } }; },
        updateRef: async input => { assert.equal(input.force, false); tip = input.sha; }
      }
    } };
  return { capture, github, async publish(phase, value = report(phase), metadata = run(phase)) {
    for (const kind of ['qa', 'review']) {
      const file = path.join(folder, kind + '.json');
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    if (value) fs.writeFileSync(path.join(folder, phase + '.json'), JSON.stringify(value));
    const before = process.env.RUNNER_TEMP; process.env.RUNNER_TEMP = folder;
    try {
      await ledger({ github, context: { repo, payload: { repository: { default_branch: 'main' }, workflow_run: metadata } },
        core: { notice: text => capture.notices.push(text), summary: { addRaw: text => { capture.summary = text; }, write: async () => {} } } });
    } finally {
      if (before === undefined) delete process.env.RUNNER_TEMP; else process.env.RUNNER_TEMP = before;
    }
  } };
}
test('pre-merge Review publishes independently and deferred QA is not blocked', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    await fixture.publish('review');
    assert.doesNotMatch(fixture.capture.summary, /\[AI-BLOCKED\]/);
    assert.match(fixture.capture.summary, /QA is deferred until after merge/);
    assert.match(fixture.capture.summary, new RegExp(head));
    assert.equal(fixture.capture.bugs.length, 0);
    assert.equal(fixture.capture.files.has('docs/quality/reports/PR-7-review.md'), true);
    assert.equal(fixture.capture.files.has('docs/quality/reports/PR-7-qa.md'), false);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('phase documents and comments preserve different commits in either publication order and on reruns', async () => {
  for (const order of [['review', 'qa'], ['qa', 'review']]) {
    const folder = temp();
    try {
      const fixture = publisher(folder);
      for (const phase of order) await fixture.publish(phase);
      const before = fixture.capture.files.get('docs/quality/reports/PR-7-review.md');
      await fixture.publish('qa', report('qa', { result: 'fail', acceptance_criteria: [{ id: 'AC-1', result: 'fail', evidence: 'Environment unavailable' }] }));
      assert.equal(fixture.capture.files.get('docs/quality/reports/PR-7-review.md'), before);
      assert.match(before, new RegExp(head));
      assert.match(fixture.capture.files.get('docs/quality/reports/PR-7-qa.md'), new RegExp(merged));
      assert.match(fixture.capture.files.get('docs/quality/reports/PR-7-qa.md'), /QA: \*\*fail\*\*/);
      assert.equal(fixture.capture.comments.length, 2);
      assert.equal(fixture.capture.pulls.length, 1);
    } finally { fs.rmSync(folder, { recursive: true, force: true }); }
  }
});
test('a later phase or retry changes the mandatory index even after the earlier ledger PR merged', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    await fixture.publish('review');
    const previous = new Map(fixture.capture.files);
    await fixture.publish('qa');
    const current = fixture.capture.files;
    assert.notEqual(current.get('docs/quality/reports/PR-7.md'), previous.get('docs/quality/reports/PR-7.md'));
    const files = [...current].filter(([name, value]) => previous.get(name) !== value)
      .map(([filename]) => ({ filename, status: previous.has(filename) ? 'modified' : 'added' }));
    const evidence = productPR({ user: { login: 'github-actions[bot]', type: 'Bot' },
      head: { ...productPR().head, ref: 'quality-ledger/pr-7' }, changed_files: files.length });
    assert.equal(await isEvidencePR({ repo, pr: evidence,
      github: { rest: { pulls: { listFiles: {} } }, paginate: async () => files } }), true);
    const firstAttempt = current.get('docs/quality/reports/PR-7.md');
    await fixture.publish('qa', report('qa'), run('qa', { run_attempt: 2 }));
    assert.notEqual(current.get('docs/quality/reports/PR-7.md'), firstAttempt);
    assert.match(current.get('docs/quality/reports/PR-7.md'), /attempt 2/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('missing reports block only their own phase; valid failing QA is published without inventing a product Bug', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    await fixture.publish('review', null);
    assert.match(fixture.capture.summary, /The review stage did not produce/);
    await fixture.publish('qa', null);
    assert.match(fixture.capture.summary, /The qa stage did not produce/);
    await fixture.publish('qa', report('qa', { result: 'fail', tests_executed: [], acceptance_criteria: [
      { id: 'AC-1', result: 'fail', evidence: 'Missing dependency; environment blocked' }] }));
    assert.match(fixture.capture.summary, /QA: \*\*fail\*\*/);
    assert.equal(fixture.capture.bugs.length, 0);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('publisher rejects PR-head QA and forged report numbers before writing comments or files', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    for (const overrides of [{ commit: head }, { pr: 99 }, { issue: 99 }]) {
      await assert.rejects(fixture.publish('qa', report('qa', overrides)), /Mismatched/);
      assert.equal(fixture.capture.comments.length, 0);
      assert.equal(fixture.capture.files.size, 0);
    }
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('post-merge Bug environment and mirror record the merge SHA, not the source head', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    await fixture.publish('qa', report('qa', { result: 'fail',
      bugs: [{ severity: 'S3', title: 'Reproducible failure', reproduction: 'Call feature with input', evidence: 'evidence/test.log' }] }));
    assert.equal(fixture.capture.bugs.length, 1);
    assert.match(fixture.capture.bugs[0].body, new RegExp('Commit: ' + merged));
    assert.doesNotMatch(fixture.capture.bugs[0].body, new RegExp(head));
    assert.match(fixture.capture.files.get('docs/quality/bugs/BUG-90.md'), new RegExp(merged));
    await fixture.publish('qa', report('qa', { result: 'fail',
      bugs: [{ severity: 'S3', title: 'Reproducible failure', reproduction: 'Call feature with input', evidence: 'evidence/test.log' }] }));
    assert.equal(fixture.capture.bugs.length, 1);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('post-merge evidence runs stop publication before parsing Issue linkage or reports', async () => {
  const folder = temp();
  try {
    const fixture = publisher(folder);
    const pr = productPR({ body: 'No closing reference', head: { ...productPR().head, ref: 'quality-ledger/pr-42' },
      user: { login: 'github-actions[bot]', type: 'Bot' }, changed_files: 1 });
    fixture.github.rest.pulls.get = async () => ({ data: pr });
    fixture.github.paginate = async () => [{ filename: 'docs/quality/reports/PR-42.md', status: 'added' }];
    await fixture.publish('qa');
    assert.equal(fixture.capture.files.size, 0);
    assert.equal(fixture.capture.comments.length, 0);
    assert.match(fixture.capture.notices[0], /no recursive publication/);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
test('workflow wiring keeps Review in CI and QA in merged-close workflow with bounded artifacts', () => {
  const workflow = name => fs.readFileSync(path.join(__dirname, '../workflows', name + '.yml'), 'utf8');
  const ci = workflow('ci'), qa = workflow('codex-qa'), publisher = workflow('quality-ledger');
  assert.doesNotMatch(ci, /uses: \.\/\.github\/workflows\/codex-qa\.yml/);
  assert.match(ci, /needs: \[checks, classify\]/);
  assert.match(ci, /needs: \[checks, classify, review\]/);
  assert.match(qa, /types: \[closed\]/);
  assert.match(qa, /if: github\.event\.pull_request\.merged == true/);
  assert.match(qa, /ref: \$\{\{ needs\.target\.outputs\.commit \}\}/);
  assert.match(qa, /QA after merge · PR #/);
  assert.doesNotMatch(qa, /workflow_call|contents: write|issues: write|pull-requests: write/);
  assert.match(publisher, /workflows: \[CI, Codex QA\]/);
  assert.match(publisher, /ref: \$\{\{ github\.event\.repository\.default_branch \}\}/);
  assert.match(publisher, /artifact\.size_in_bytes > 20000000/);
  assert.match(publisher, /file_size > 500000/);
  assert.match(publisher, /name not in z\.namelist\(\)/);
});
