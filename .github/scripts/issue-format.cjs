/* eslint-disable @typescript-eslint/no-require-imports -- trusted Actions entry point. */
const { inspectIssue } = require('./issue-contract.cjs');
const { publicationTarget } = require('./quality-source.cjs');

async function isLedgerBug(issue, github, context) {
  if (issue.user?.login !== 'github-actions[bot]' || issue.user?.type !== 'Bot' ||
      !/^<!-- codex-qa-bug:[a-f0-9]{20} -->\r?\n/.test(issue.body || '') ||
      !issue.labels?.some(label => label.name === 'needs-triage')) return false;
  const source = inspectIssue(issue.body, { mode: 'ledger-bug' });
  if (!source.valid) return false;
  const pr = /^Source PR: #([1-9]\d*)$/m.exec(source.sections.References)?.[1];
  const commit = /^Commit: ([a-f0-9]{40})$/m.exec(source.sections.Environment)?.[1];
  const prefix = `${context.serverUrl || 'https://github.com'}/${context.repo.owner}/${context.repo.repo}/actions/runs/`;
  const runUrl = source.sections.References.split(/\r?\n/).find(line => line.startsWith(prefix));
  const id = runUrl?.slice(prefix.length);
  if (!pr || !commit || !/^[1-9]\d*$/.test(id || '')) return false;
  const { data: run } = await github.rest.actions.getWorkflowRun({ ...context.repo, run_id: Number(id) });
  const target = await publicationTarget({ github, repo: context.repo, run,
    defaultBranch: context.payload.repository.default_branch });
  return target?.phase === 'qa' && target.pr.number === Number(pr) && target.commit === commit;
}

// Render only our own diagnostics; never include arbitrary Issue Markdown/HTML in summaries.
const escape = value => String(value).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

module.exports = async ({ github, context, core }) => {
  if (context.eventName !== 'issues' || !['opened', 'edited'].includes(context.payload.action)) {
    throw new Error('Expected an issues opened/edited event');
  }
  const number = context.payload.issue?.number;
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('Invalid Issue number');
  const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: number });
  if (issue.pull_request || issue.number !== number) throw new Error('Expected Issue, not PR');
  let result = inspectIssue(issue.body, { mode: 'submission' });
  let provenanceError;
  if (!result.valid) {
    try {
      if (await isLedgerBug(issue, github, context)) result = inspectIssue(issue.body, { mode: 'ledger-bug' });
    } catch (error) {
      // A provenance read failure is a failed check, never an exception granted by default.
      provenanceError = `Could not verify Ledger provenance: ${error.message}`;
    }
  }
  const errors = [...result.errors, ...(provenanceError ? [provenanceError] : [])];
  await core.summary.addHeading(`Issue #${number} format: ${result.valid ? 'pass' : 'fail'}`)
    .addRaw(result.valid ? 'The latest saved body satisfies the Issue submission contract.' :
      `<ul>${errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul>`)
    .write();
  if (!result.valid) core.setFailed('Issue format failed. See the job summary; fix the complete body using issue-submit.cjs.');
  return { valid: result.valid, errors };
};
