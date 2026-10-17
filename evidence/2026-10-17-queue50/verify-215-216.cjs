const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const registry = require('../../.github/ci/projects.json');
const results = [];
function run(name, cwd, command, args, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240000 });
  const log = `215-216-${name}.log`;
  fs.writeFileSync(path.join(__dirname, log), `${command} ${args.join(' ')}\nexit=${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  results.push({ name, command: [command, ...args].join(' '), exit: result.status, log });
  fs.writeFileSync(path.join(__dirname, '215-216-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${name}: ${result.status}`);
}
for (const name of ['screening-backend', 'screening-front']) {
  const project = registry.projects.find(p => p.name === name);
  for (const check of new Set([...project.checks, 'test'])) run(`${name}-${check}`, path.join(root, project.dir), 'npm', ['run', check]);
}
run('browser', path.join(root, 'hireos-screening/hireos-screening-front'), 'node', ['test/decision-conflict.browser.cjs'], { ...process.env, SCREENING_TEST_URL: 'http://127.0.0.1:8080/screening/', SCREENING_SCREENSHOT: path.join(__dirname, '215-216-historical-basis.png') });
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
