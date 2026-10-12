/* eslint-disable @typescript-eslint/no-require-imports -- actions/github-script loads this CommonJS module. */
const fs = require('node:fs');
const { readReport } = require('./report.cjs');

const MARKER = '<!-- hireos:claude-review -->';

function render(report, runUrl) {
  if (!report) {
    return `${MARKER}\n[AI-BLOCKED] Claude Review not completed.\n\nNo valid report was produced. Run: ${runUrl}`;
  }
  const findings = report.findings.length
    ? report.findings.map(f => `- ${f.blocking ? '**blocking**' : 'non-blocking'} \`${f.path}:${f.line}\` — ${f.description}\n  - Evidence: ${f.evidence}`).join('\n')
    : '- None';
  return [
    MARKER,
    `[AI-EVIDENCE] Claude Review: **${report.result}** · security: **${report.security}**`,
    '',
    `Issue #${report.issue} · PR #${report.pr} · commit \`${report.commit.slice(0, 12)}\``,
    '',
    report.summary,
    '',
    '### Findings',
    findings,
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

// Runs in a separate job with pull-requests: write; only reads the validated JSON as data.
module.exports = async ({ github, context, core, reportPath, contextPath }) => {
  const pr = context.payload.pull_request.number;
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  let report = null;
  try {
    report = readReport('review', reportPath, JSON.parse(fs.readFileSync(contextPath, 'utf8')));
  } catch (error) {
    // Missing, malformed or mismatched reports are published as blocked, never as a pass.
    core.warning(`Review report not publishable: ${error.message}`);
  }
  const body = render(report, runUrl);
  const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: pr, per_page: 100 });
  const existing = comments.find(c => c.user.type === 'Bot' && c.body.startsWith(MARKER));
  if (existing) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ ...context.repo, issue_number: pr, body });
  }
};

module.exports.render = render;
module.exports.MARKER = MARKER;
