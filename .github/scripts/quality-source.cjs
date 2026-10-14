/* eslint-disable @typescript-eslint/no-require-imports -- trusted CommonJS publisher dependency. */
const { mergedTarget } = require('./post-merge.cjs');

// Publication identity comes from GitHub run/PR metadata, never artifact targets.
async function publicationTarget({ github, repo, run, defaultBranch }) {
  const fullName = `${repo.owner}/${repo.repo}`;
  if (run.event !== 'pull_request' || run.head_repository?.full_name !== fullName) {
    throw new Error('Unexpected workflow source');
  }
  let phase, number, commit;
  if (run.name === 'CI' && /^\.github\/workflows\/ci\.yml(?:@.+)?$/.test(run.path || '')) {
    phase = 'review';
    commit = run.head_sha;
    const identity = /^Review before merge · PR #([1-9]\d*) · ([a-f0-9]{40})$/.exec(run.display_title || '');
    if (identity) {
      number = Number(identity[1]);
      if (identity[2] !== commit || run.pull_requests?.some(pr => pr.number !== number)) {
        throw new Error('Conflicting Review run identity');
      }
    } else {
      // Legacy CI has no fixed run-name; require its explicit GitHub PR association.
      if (run.pull_requests?.length !== 1) throw new Error('Expected one source PR');
      number = run.pull_requests[0].number;
    }
  } else if (run.name === 'Codex QA' && /^\.github\/workflows\/codex-qa\.yml(?:@.+)?$/.test(run.path || '')) {
    phase = 'qa';
    // Closed PR runs may have an empty pull_requests array. The fixed run-name
    // captures the event's PR and merge SHA in GitHub metadata, not an artifact.
    const identity = /^QA after merge · PR #([1-9]\d*) · ([a-f0-9]{40})$/.exec(run.display_title || '');
    if (!identity) throw new Error('Missing post-merge QA run identity; legacy runs require a new run');
    number = Number(identity[1]);
    commit = identity[2];
    if (run.pull_requests?.some(pr => pr.number !== number)) throw new Error('Conflicting QA source PR');
  } else {
    throw new Error('Unsupported quality workflow');
  }
  if (!Number.isSafeInteger(number) || number < 1 || !/^[a-f0-9]{40}$/.test(commit || '')) {
    throw new Error('Invalid quality run identity');
  }
  const { data: pr } = await github.rest.pulls.get({ ...repo, pull_number: number });
  if (pr.number !== number || pr.head.repo?.full_name !== fullName) return null;
  if (phase === 'review') {
    if (pr.head.sha !== commit) return null;
  } else {
    const target = mergedTarget(pr, { repo, defaultBranch });
    if (!target || target.commit !== commit) return null;
  }
  return { pr, phase, commit };
}

module.exports = { publicationTarget };
