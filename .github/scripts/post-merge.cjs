/* eslint-disable @typescript-eslint/no-require-imports -- shared Node/Actions target resolver. */
const isEvidencePR = require('./evidence-pr.cjs');

// merge_commit_sha is the merged commit, squash commit or final rebased commit.
// It remains the target even when the default branch receives newer commits.
function mergedTarget(pr, { repo, defaultBranch }) {
  const fullName = `${repo.owner}/${repo.repo}`;
  if (!pr.merged || pr.state !== 'closed' || pr.base?.ref !== defaultBranch ||
      pr.head?.repo?.full_name !== fullName || pr.base?.repo?.full_name !== fullName) return null;
  if (!Number.isSafeInteger(pr.number) || pr.number < 1 || !/^[a-f0-9]{40}$/.test(pr.merge_commit_sha || '')) {
    throw new Error('Invalid merged PR identity');
  }
  return { pr: pr.number, commit: pr.merge_commit_sha };
}

async function prepareTarget({ github, context, core }) {
  core.setOutput('eligible', 'false');
  const event = context.payload;
  if (context.eventName !== 'pull_request' || event.action !== 'closed' || !event.pull_request?.merged) return;
  const { data: pr } = await github.rest.pulls.get({ ...context.repo, pull_number: event.number });
  const target = mergedTarget(pr, { repo: context.repo, defaultBranch: event.repository.default_branch });
  if (!target) return;
  if (pr.number !== event.number || target.commit !== event.pull_request.merge_commit_sha) {
    throw new Error('Merged PR event does not match GitHub metadata');
  }
  if (await isEvidencePR({ github, repo: context.repo, pr })) return;
  core.setOutput('commit', target.commit);
  core.setOutput('eligible', 'true');
}

module.exports = { mergedTarget, prepareTarget };
