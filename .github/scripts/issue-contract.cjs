/* eslint-disable @typescript-eslint/no-require-imports -- shared CLI and Actions contract. */
const fs = require('node:fs');
const contract = require('../schemas/issue-contract.json');
function closingIssueNumbers(body) {
  return [...new Set([...(body || '').matchAll(/\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi)].map(m => Number(m[1])))];
}
function inspectIssue(body) {
  const sections = {}, errors = [];
  let current, fence, comment = false;
  for (const original of String(body || '').split(/\r?\n/)) {
    let line = original;
    if (comment) { const end = line.indexOf('-->'); if (end < 0) continue; line = line.slice(end + 3); comment = false; }
    line = line.replace(/<!--[\s\S]*?-->/g, '');
    const start = line.indexOf('<!--'); if (start >= 0) { line = line.slice(0, start); comment = true; }
    const marker = /^\s*(`{3,}|~{3,})/.exec(line);
    if (marker) { if (!fence) fence = marker[1][0]; else if (marker[1][0] === fence) fence = undefined; continue; }
    if (fence) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading && heading[1].length <= 3) {
      if (heading[1] !== '###') errors.push('Issue fields must use unique third-level headings');
      current = heading[2];
      if (Object.hasOwn(sections, current)) errors.push(`Duplicate Issue field: ${current}`);
      else sections[current] = '';
      continue;
    }
    if (current) sections[current] += line + '\n';
  }
  for (const key of Object.keys(sections)) sections[key] = sections[key].trim();
  return { sections, errors };
}
const isOwner = value => /^@[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value || '');
function validateIssue(body, { mode = 'submission' } = {}) {
  if (!['submission', 'execution', 'ledger-bug'].includes(mode)) throw new Error('Invalid Issue validation mode');
  const { sections, errors } = inspectIssue(body);
  if (errors.length) throw new Error(errors.join('; '));
  const typeFields = contract.types[sections.Type];
  if (!typeFields) throw new Error('Invalid Issue Type');
  for (const name of [...contract.common, ...typeFields]) {
    if (!sections[name] || sections[name] === '_No response_') throw new Error(`Missing Issue field: ${name}`);
  }
  const allowed = new Set([...contract.common, ...typeFields, ...contract.extra]);
  for (const name of Object.keys(sections)) if (!allowed.has(name)) throw new Error(`Unknown Issue field: ${name}`);
  for (const [name, values] of Object.entries(contract.enums)) {
    if (name === 'Subsystem') {
      const entries = sections[name].split(/[,\n]+/).map(v => v.trim().replace(/^[-*] /, '')).filter(Boolean);
      if (!entries.length || entries.some(v => !values.includes(v))) throw new Error('Invalid Issue Subsystem');
      continue;
    }
    if (sections[name] !== undefined && !values.includes(sections[name])) throw new Error(`Invalid Issue ${name}`);
  }
  const ledgerOwner = /^Pending human triage; source Issue #[1-9]\d* owner to assign\.$/.test(sections.Owner);
  if (!isOwner(sections.Owner) && !(mode === 'ledger-bug' && ledgerOwner)) throw new Error('Invalid Issue Owner');
  const lines = sections['Acceptance Criteria'].split('\n').filter(line => line.trim() && !/^####/.test(line));
  const ids = [];
  for (const line of lines) {
    const match = /^(?:[-*] (?:\[[ x]\] )?)?(AC-[1-9]\d*):\s*(\S.*)$/.exec(line);
    if (!match) {
      if (!ids.length || /^(?:[-*] (?:\[[ x]\] )?)?AC-/.test(line)) {
        throw new Error('Acceptance Criteria must have unique nonempty AC-1 style identifiers');
      }
      continue; // Details may continue below a criterion; identifiers remain unique.
    }
    if (ids.includes(match[1])) throw new Error(`Duplicate Acceptance Criterion: ${match[1]}`);
    ids.push(match[1]);
  }
  if (!ids.length) throw new Error('Acceptance Criteria must have AC-1 style identifiers');
  if (sections['AI Ready'] === 'Yes' && sections.Estimate === 'TBD') throw new Error('AI Ready=Yes requires a concrete Estimate');
  if (mode === 'execution' && sections['AI Ready'] !== 'Yes') throw new Error('AI Ready must be Yes');
  if (mode === 'ledger-bug' && (sections.Type !== 'Bug' || sections.Estimate !== 'TBD' || sections['AI Ready'] !== 'No')) {
    throw new Error('Ledger Bug requires Bug / TBD / No');
  }
  return sections;
}
function assertIssueReady(issue) {
  if (issue.pull_request) throw new Error('Linked Issue points to a PR.');
  return validateIssue(issue.body, { mode: 'execution' });
}
module.exports = { closingIssueNumbers, inspectIssue, validateIssue, isOwner, assertIssueReady };
if (require.main === module) {
  try {
    const [filename, mode = 'submission'] = process.argv.slice(2);
    if (!filename || !['submission', 'execution'].includes(mode)) throw new Error('Usage: issue-contract.cjs <body-file> submission|execution');
    validateIssue(fs.readFileSync(filename, 'utf8'), { mode });
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
