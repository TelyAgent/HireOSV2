const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const results = [];
function run(name, dir, args, env = process.env) {
  const result = spawnSync('node', args, { cwd: path.join(root, dir), env, encoding: 'utf8', timeout: 900000, maxBuffer: 24 * 1024 * 1024 });
  const log = `merge-batch-${name}.log`;
  fs.writeFileSync(path.join(__dirname, log), `node ${args.join(' ')}\nexit=${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  results.push({ name, command: ['node', ...args].join(' '), exit: result.status, log });
  fs.writeFileSync(path.join(__dirname, 'merge-batch-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${name}: ${result.status}`);
}
for (const n of [426, 425, 365]) run(String(n), '.', [`evidence/2026-10-17-queue50/verify-${n}.cjs`]);
for (const name of ['rubric-source', 'activity', 'screening-resolution', 'material-triage', 'task-entry-materials']) {
  run(name, 'hireos-interview/job-Interview-front', [`test/${name}.browser.cjs`], { ...process.env, NODE_PATH: path.join(root, 'hireos-screening/hireos-screening-front/node_modules') });
}
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
