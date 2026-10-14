/* eslint-disable @typescript-eslint/no-require-imports -- actions/github-script loads this CommonJS module. */
const fs = require('node:fs');
const { closingIssueNumbers, assertIssueReady } = require('./issue-contract.cjs');

// Batch QA (#39): QA runs after merge, per Issue, against the merge commit of the PR that closed it.
// Builds the same evidence/context.json the PR-time QA used, so qa.md and report.cjs need no changes.

/** The most recently merged PR whose body names exactly this Issue as its primary `Closes #n`. */
async function findMergedPr(github, repo, issueNumber) {
  const prs = await github.paginate(github.rest.pulls.list, { ...repo, state: 'closed', per_page: 100 });
  const merged = prs
    .filter(pr => pr.merged_at && pr.merge_commit_sha)
    .filter(pr => {
      const numbers = closingIssueNumbers(pr.body);
      return numbers.length === 1 && numbers[0] === issueNumber;
    })
    .sort((a, b) => Date.parse(b.merged_at) - Date.parse(a.merged_at));
  if (!merged.length) throw new Error(`Issue #${issueNumber} has no merged PR whose body says "Closes #${issueNumber}".`);
  return merged[0];
}

async function buildIssueContext({ github, repo, issueNumber }) {
  if (!Number.isSafeInteger(issueNumber) || issueNumber < 1) throw new Error(`Invalid Issue number: ${issueNumber}`);
  const { data: issue } = await github.rest.issues.get({ ...repo, issue_number: issueNumber });
  assertIssueReady(issue);
  const pr = await findMergedPr(github, repo, issueNumber);
  // Squash/rebase merges leave one commit on main; its first parent is main just before the PR landed.
  const { data: commit } = await github.rest.repos.getCommit({ ...repo, ref: pr.merge_commit_sha });
  const base = commit.parents[0]?.sha;
  if (!base) throw new Error(`Merge commit ${pr.merge_commit_sha} of PR #${pr.number} has no parent.`);
  const [comments, prComments, reviewComments] = await Promise.all([
    github.paginate(github.rest.issues.listComments, { ...repo, issue_number: issue.number, per_page: 100 }),
    github.paginate(github.rest.issues.listComments, { ...repo, issue_number: pr.number, per_page: 100 }),
    github.paginate(github.rest.pulls.listReviewComments, { ...repo, pull_number: pr.number, per_page: 100 }),
  ]);
  return {
    issue: issue.number, pr: pr.number, commit: pr.merge_commit_sha, base,
    issue_body: issue.body, issue_comments: comments, pr_body: pr.body,
    pr_comments: prComments, review_comments: reviewComments,
  };
}

// github-script entry point: writes evidence/context.json and exposes commit/base to later steps.
module.exports = async ({ github, context, core, issueNumber }) => {
  const data = await buildIssueContext({ github, repo: context.repo, issueNumber: Number(issueNumber) });
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/context.json', JSON.stringify(data, null, 2));
  core.setOutput('commit', data.commit);
  core.setOutput('base', data.base);
  core.setOutput('pr', String(data.pr));
  core.info(`Issue #${data.issue} → PR #${data.pr}, merge commit ${data.commit} (base ${data.base})`);
};
module.exports.buildIssueContext = buildIssueContext;
module.exports.findMergedPr = findMergedPr;
