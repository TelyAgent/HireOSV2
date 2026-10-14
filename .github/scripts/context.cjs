/* eslint-disable @typescript-eslint/no-require-imports -- actions/github-script loads this CommonJS module. */
const fs = require('node:fs');
const { closingIssueNumbers, assertIssueReady } = require('./issue-contract.cjs');

// Runs in actions/github-script with a read-only GitHub token.
module.exports = async ({ github, context }) => {
  const pr = context.payload.pull_request;
  if (!pr || pr.head.repo.full_name !== context.repo.owner + '/' + context.repo.repo) {
    throw new Error('AI checks require a same-repository PR; port reviewed fork changes to a supervised branch.');
  }
  const numbers = closingIssueNumbers(pr.body);
  if (numbers.length !== 1) throw new Error('Use exactly one primary Linked Issue: Closes #<number>.');
  const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: numbers[0] });
  assertIssueReady(issue);
  const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: issue.number, per_page: 100 });
  const prComments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: pr.number, per_page: 100 });
  const reviewComments = await github.paginate(github.rest.pulls.listReviewComments, { ...context.repo, pull_number: pr.number, per_page: 100 });
  const data = { issue: issue.number, pr: pr.number, commit: pr.head.sha, base: pr.base.sha,
    issue_body: issue.body, issue_comments: comments, pr_body: pr.body,
    pr_comments: prComments, review_comments: reviewComments };
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/context.json', JSON.stringify(data, null, 2));
};
