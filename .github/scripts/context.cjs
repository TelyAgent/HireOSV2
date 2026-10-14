/* eslint-disable @typescript-eslint/no-require-imports -- Actions context collector. */
const fs = require('node:fs');
const { closingIssueNumbers, assertIssueReady } = require('./issue-contract.cjs');
const { mergedTarget } = require('./post-merge.cjs');
module.exports = async ({ github, context, phase = 'review', commit }) => {
  if (!['review', 'qa'].includes(phase)) throw new Error('Invalid context phase');
  let pr = context.payload.pull_request;
  const fullName = `${context.repo.owner}/${context.repo.repo}`;
  if (phase === 'qa') {
    if (context.eventName !== 'pull_request' || context.payload.action !== 'closed' || !pr?.merged) {
      throw new Error('QA requires a merged PR event');
    }
    ({ data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: context.payload.number }));
    const target = mergedTarget(pr, { repo: context.repo, defaultBranch: context.payload.repository.default_branch });
    if (!target || commit !== target.commit || context.payload.pull_request.merge_commit_sha !== commit || pr.number !== context.payload.number) {
      throw new Error('Mismatched QA merge commit');
    }
  } else commit = pr?.head.sha;
  if (!pr || pr.head.repo.full_name !== fullName) throw new Error('AI checks require a same-repository PR');
  if (!/^[a-f0-9]{40}$/.test(commit || '')) throw new Error('Invalid context commit');
  let changedFiles;
  if (phase === 'qa') {
    changedFiles = await github.paginate(github.rest.pulls.listFiles, { ...context.repo, pull_number: pr.number, per_page: 100 });
    if (!Number.isInteger(pr.changed_files) || pr.changed_files < 1 || pr.changed_files >= 3000 ||
        changedFiles.length !== pr.changed_files || new Set(changedFiles.map(f => f.filename)).size !== changedFiles.length) {
      throw new Error('Incomplete merged PR changes');
    }
  }
  const numbers = closingIssueNumbers(pr.body);
  if (numbers.length !== 1) throw new Error('Use exactly one primary Linked Issue: Closes #<number>.');
  const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: numbers[0] });
  assertIssueReady(issue);
  const [comments, prComments, reviewComments] = await Promise.all([
    github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: issue.number, per_page: 100 }),
    github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: pr.number, per_page: 100 }),
    github.paginate(github.rest.pulls.listReviewComments, { ...context.repo, pull_number: pr.number, per_page: 100 }),
  ]);
  const data = { phase, issue: issue.number, pr: pr.number, commit, head: pr.head.sha, base: pr.base.sha,
    issue_body: issue.body, issue_comments: comments, pr_body: pr.body,
    pr_comments: prComments, review_comments: reviewComments, ...(changedFiles ? { changed_files: changedFiles } : {}) };
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/context.json', JSON.stringify(data, null, 2));
};
