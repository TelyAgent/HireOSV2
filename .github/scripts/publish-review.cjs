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

const QA_MARKER = '<!-- hireos:claude-qa -->';

function renderQa(report, runUrl) {
  if (!report) {
    return `${QA_MARKER}\n[AI-BLOCKED] Claude QA not completed.\n\nNo valid report was produced. Run: ${runUrl}`;
  }
  const icon = r => (r === 'pass' ? '✅' : '❌');
  const cell = text => String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
  const list = items => (items.length ? items.map(i => `- ${i}`).join('\n') : '- None');
  const bugs = report.bugs.length
    ? report.bugs.map(b => `- **${b.severity}** ${b.title}\n  - 复现: ${b.reproduction}\n  - 证据: ${b.evidence}`).join('\n')
    : '- None';
  return [
    QA_MARKER,
    `[AI-EVIDENCE] Claude QA: **${report.result}**`,
    '',
    `Issue #${report.issue} · PR #${report.pr} · commit \`${report.commit.slice(0, 12)}\``,
    '',
    '| AC | 结果 | 证据 |',
    '| --- | --- | --- |',
    ...report.acceptance_criteria.map(ac => `| ${ac.id} | ${icon(ac.result)} ${ac.result} | ${cell(ac.evidence)} |`),
    '',
    '### Bugs',
    bugs,
    '',
    '### Regressions',
    list(report.regressions),
    '',
    '<details><summary>Tests executed / added</summary>',
    '',
    list(report.tests_executed),
    '',
    list(report.tests_added),
    '',
    '</details>',
    '',
    `Run: ${runUrl}`,
  ].join('\n');
}

// Runs in a separate job with pull-requests: write; only reads the validated JSON as data.
// `kind` selects which report this call publishes; each kind keeps its own sticky comment.
module.exports = async ({ github, context, core, reportPath, contextPath, kind = 'review' }) => {
  const [marker, draw] = kind === 'qa' ? [QA_MARKER, renderQa] : [MARKER, render];
  const pr = context.payload.pull_request.number;
  const runUrl = `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  let report = null;
  try {
    report = readReport(kind, reportPath, JSON.parse(fs.readFileSync(contextPath, 'utf8')));
  } catch (error) {
    // Missing, malformed or mismatched reports are published as blocked, never as a pass.
    core.warning(`${kind} report not publishable: ${error.message}`);
  }
  const body = draw(report, runUrl);
  const comments = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number: pr, per_page: 100 });
  const existing = comments.find(c => c.user.type === 'Bot' && c.body.startsWith(marker));
  if (existing) {
    await github.rest.issues.updateComment({ ...context.repo, comment_id: existing.id, body });
  } else {
    await github.rest.issues.createComment({ ...context.repo, issue_number: pr, body });
  }
};

module.exports.render = render;
module.exports.renderQa = renderQa;
module.exports.MARKER = MARKER;
module.exports.QA_MARKER = QA_MARKER;
