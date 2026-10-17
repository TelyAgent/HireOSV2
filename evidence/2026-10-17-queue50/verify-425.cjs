const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const registry = require('../../.github/ci/projects.json');
const results = [];
function run(name, dir, command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd: path.join(root, dir), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240000 });
  const log = `425-${name}.log`;
  fs.writeFileSync(path.join(__dirname, log), `${command} ${args.join(' ')}\nexit=${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  results.push({ name, command: [command, ...args].join(' '), exit: result.status, log });
  fs.writeFileSync(path.join(__dirname, '425-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${name}: ${result.status}`);
}
for (const name of ['screening-backend', 'screening-front']) {
  const project = registry.projects.find(p => p.name === name);
  for (const check of new Set([...project.checks, 'test'])) run(`${name}-${check}`, project.dir, 'npm', ['run', check]);
}
run('browser', 'hireos-screening/hireos-screening-front', 'node', ['test/screening-batches.browser.cjs']);
run('e2e', 'hireos-screening/hireos-screening-backend', 'node', ['test/screening-batches-e2e.cjs']);
run('workspace-regression', 'hireos-screening/hireos-screening-front', 'node', ['test/workspace-flow.cjs', 'http://localhost:8080/screening/jobs/j198/screening'], { ...process.env, SYNTHETIC: '1', EXE: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
run('decision-regression', 'hireos-screening/hireos-screening-front', 'node', ['test/decision-conflict.browser.cjs']);
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
