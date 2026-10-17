const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const registry = require('../../.github/ci/projects.json');
const results = [];
function run(name, dir, cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, { cwd: path.join(root, dir), env, encoding: 'utf8', maxBuffer: 24 * 1024 * 1024, timeout: 240000 });
  const log = `426-${name}.log`;
  fs.writeFileSync(path.join(__dirname, log), `${cmd} ${args.join(' ')}\nexit=${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  results.push({ name, command: [cmd, ...args].join(' '), exit: result.status, log });
  fs.writeFileSync(path.join(__dirname, '426-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${name}: ${result.status}`);
}
for (const name of ['identity-backend', 'interview-backend', 'interview-front']) {
  const project = registry.projects.find(p => p.name === name);
  if (!project) throw Error(`Missing CI registry entry ${name}`);
  for (const check of new Set([...project.checks, 'test'])) run(`${name}-${check}`, project.dir, 'npm', ['run', check]);
}
run('browser', 'hireos-interview/job-Interview-front', 'node', ['test/interviewer-binding.browser.cjs'], { ...process.env, NODE_PATH: path.join(root, 'hireos-screening/hireos-screening-front/node_modules') });
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
