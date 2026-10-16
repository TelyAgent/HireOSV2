/* eslint-disable @typescript-eslint/no-require-imports -- Node CLI and testable GitHub transport. */
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { validateIssue } = require('./issue-contract.cjs');

function parseArgs(args) {
  const [action, ...rest] = args;
  if (!['create', 'edit'].includes(action)) throw new Error('Use create or edit');
  const options = { action };
  const allowed = { '--repo': 'repo', '--body-file': 'filename', '--title': 'title', '--issue': 'number' };
  for (let i = 0; i < rest.length; i += 2) {
    const key = allowed[rest[i]], value = rest[i + 1];
    if (!key || options[key] !== undefined || !value || value.startsWith('--')) {
      throw new Error('Unknown, duplicate or missing option; --mode is not supported');
    }
    options[key] = value;
  }
  if (!options.filename) throw new Error('--body-file is required');
  if (action === 'create' && (!options.title?.trim() || options.number !== undefined)) {
    throw new Error('create requires --title and does not accept --issue');
  }
  if (action === 'edit' && (options.title !== undefined || !/^[1-9]\d*$/.test(options.number || '') ||
      !Number.isSafeInteger(Number(options.number)))) {
    throw new Error('edit requires --issue <positive number> and only updates the body');
  }
  return options;
}

function gh(args, input) {
  const result = spawnSync('gh', args, { input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `gh failed (${result.status})`);
  return result.stdout;
}

function submitIssue(options, transport = gh) {
  // Capture once: gh receives this exact validated value, never a second file read.
  const body = fs.readFileSync(options.filename, 'utf8');
  validateIssue(body, { mode: 'submission' });
  const repo = options.repo || transport(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.split('/').some(p => p === '.' || p === '..')) {
    throw new Error('Expected --repo OWNER/REPO');
  }
  const endpoint = `repos/${repo}/issues`;
  if (options.action === 'edit') {
    const current = JSON.parse(transport(['api', `${endpoint}/${options.number}`]));
    if (current.pull_request || current.number !== Number(options.number)) throw new Error('Expected an Issue, not a PR');
    return JSON.parse(transport(['api', '--method', 'PATCH', `${endpoint}/${options.number}`, '--input', '-'],
      JSON.stringify({ body })));
  }
  if (options.action !== 'create' || !options.title?.trim()) throw new Error('Invalid create request');
  return JSON.parse(transport(['api', '--method', 'POST', endpoint, '--input', '-'],
    JSON.stringify({ title: options.title, body })));
}

module.exports = { parseArgs, submitIssue };
if (require.main === module) {
  try {
    const issue = submitIssue(parseArgs(process.argv.slice(2)));
    process.stdout.write(`${issue.html_url}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
