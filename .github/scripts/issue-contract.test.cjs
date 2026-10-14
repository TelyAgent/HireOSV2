/* eslint-disable @typescript-eslint/no-require-imports -- Node regression tests. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { validateIssue, inspectIssue } = require('./issue-contract.cjs');
const schema = require('../schemas/issue-contract.json');
const fields = { Type: 'Feature', Subsystem: 'cross-cutting', Problem: 'Missing behavior', 'User Outcome': 'Works',
  Scope: 'One feature', 'Non-goals': 'None', 'Acceptance Criteria': '- AC-1: works', References: 'None',
  Dependencies: 'None', Risk: 'low', Owner: '@supervisor', Estimate: '3', 'AI Ready': 'Yes', 'User Flows': 'Call feature' };
const body = values => Object.entries(values).map(([k, v]) => `### ${k}\n\n${v}`).join('\n\n');
test('all Issue forms match required schema fields and dropdown choices', () => {
  for (const [type, filename] of [['Feature', 'feature'], ['Bug', 'bug'], ['Design', 'design'], ['Tech Debt', 'tech-debt']]) {
    const text = fs.readFileSync(path.join(__dirname, '../ISSUE_TEMPLATE', filename + '.yml'), 'utf8');
    const sections = text.split(/(?=^  - type: )/m);
    const required = sections.filter(s => /required: true/.test(s)).map(s => /label: (.+)/.exec(s)?.[1]);
    assert.deepEqual(required.sort(), [...schema.common, ...schema.types[type]].sort());
    for (const part of sections) {
      const label = /label: (.+)/.exec(part)?.[1];
      if (!schema.enums[label]) continue;
      const choices = [...part.matchAll(/^        - (.+)$/gm)].map(m => m[1].replace(/^['"]|['"]$/g, ''));
      assert.deepEqual(choices, label === 'Type' ? [type] : schema.enums[label], label);
    }
  }
});
test('submission and execution distinguish triage, concrete points and ledger exception', () => {
  validateIssue(body(fields), { mode: 'execution' });
  validateIssue(body({ ...fields, 'Acceptance Criteria': '- AC-1: works\n  Verification: execute the feature\n- AC-2: rejects invalid input' }));
  const triage = { ...fields, Estimate: 'TBD', 'AI Ready': 'No' };
  validateIssue(body(triage));
  assert.throws(() => validateIssue(body(triage), { mode: 'execution' }), /AI Ready/);
  assert.throws(() => validateIssue(body({ ...fields, Estimate: 'TBD' })), /concrete Estimate/);
  const bug = Object.fromEntries(Object.entries({ ...triage, Type: 'Bug', Owner: 'Pending human triage; source Issue #1 owner to assign.',
    Severity: 'S3', Reproduction: 'Call', 'Expected / Actual': 'Works / fails', Environment: 'Run' }).filter(([k]) => k !== 'User Flows'));
  validateIssue(body(bug), { mode: 'ledger-bug' });
  assert.throws(() => validateIssue(body(bug)), /Owner/);
  assert.throws(() => validateIssue(body(fields), { mode: 'ledger-bug' }), /Ledger Bug/);
});
test('rejects missing fields, illegal enums, duplicate headings and malformed/duplicate ACs', () => {
  for (const [key, value] of [['Estimate', ''], ['Risk', 'urgent'], ['Owner', '@a @b'], ['Subsystem', 'unknown'],
    ['Acceptance Criteria', '- AC-1: works\n- AC-1: again'], ['Acceptance Criteria', '- AC-1: ']]) {
    assert.throws(() => validateIssue(body({ ...fields, [key]: value })));
  }
  assert.throws(() => validateIssue(body(fields) + '\n### Scope\n\nextra'), /Duplicate/);
  assert.throws(() => validateIssue(body(fields).replace('### Scope', '## Scope')), /third-level/);
  assert.throws(() => validateIssue(body(fields) + '\n### Surprise\n\nx'), /Unknown/);
});
test('code fences, comments and nested headings do not create fields or AC definitions', () => {
  const text = body({ ...fields, Scope: 'One feature\n#### Notes\nDetails' }) + '\n<!--\n### Scope\nignored\n-->\n```md\n### Scope\nignored\n```';
  validateIssue(text);
  assert.equal(Object.keys(inspectIssue(text).sections).length, Object.keys(fields).length);
});
test('CLI validates full body and fails invalid inputs and inaccessible files', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'contract-'));
  try {
    const file = path.join(folder, 'issue.md'), cli = path.join(__dirname, 'issue-contract.cjs');
    fs.writeFileSync(file, body(fields));
    assert.equal(spawnSync(process.execPath, [cli, file, 'execution']).status, 0);
    fs.writeFileSync(file, 'invalid body');
    assert.equal(spawnSync(process.execPath, [cli, file, 'submission']).status, 1);
    assert.equal(spawnSync(process.execPath, [cli, file, 'ledger-bug']).status, 1);
    assert.equal(spawnSync(process.execPath, [cli, file + '-missing']).status, 1);
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
