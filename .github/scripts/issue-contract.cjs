/* eslint-disable @typescript-eslint/no-require-imports -- shared by github-script steps and node:test. */
// The Issue contract (AGENTS.md "Issue 和 PR 门槛"), shared by the PR check and batch QA.
const FIELDS = ['Type', 'Subsystem', 'Problem', 'User Outcome', 'Scope', 'Non-goals', 'Acceptance Criteria',
  'References', 'Dependencies', 'Risk', 'Owner', 'AI Ready'];

/** Issue numbers a PR body closes (`Closes #n`, `Fixes #n`, `Resolves #n`), de-duplicated. */
function closingIssueNumbers(body) {
  const matches = [...(body || '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi)];
  return [...new Set(matches.map(m => Number(m[1])))];
}

/** Throws with a readable reason unless the Issue is AI Ready with every field and numbered ACs. */
function assertIssueReady(issue) {
  if (issue.pull_request) throw new Error('Linked Issue points to a PR.');
  const sections = Object.fromEntries([...(issue.body || '').matchAll(/^### (.+)\r?\n+([\s\S]*?)(?=^### |$(?![\s\S]))/gm)]
    .map(m => [m[1].trim(), m[2].trim()]));
  for (const field of FIELDS) {
    if (!sections[field] || sections[field] === '_No response_') throw new Error(`Missing Issue field: ${field}`);
  }
  if (sections['AI Ready'] !== 'Yes') throw new Error('AI Ready must be Yes.');
  if (!/^AC-\d+/m.test(sections['Acceptance Criteria'].replace(/^[-*] (?:\[[ x]\] )?/gm, ''))) {
    throw new Error('Acceptance Criteria must have AC-1 style identifiers.');
  }
}

module.exports = { closingIssueNumbers, assertIssueReady };
