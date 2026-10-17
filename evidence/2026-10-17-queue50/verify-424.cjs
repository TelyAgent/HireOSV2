const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const project = require('../../.github/ci/projects.json').projects.find(p => p.name === 'screening-backend');
const results = [];
for (const check of project.checks) {
  const result = spawnSync('npm', ['run', check], { cwd: path.join(root, project.dir), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240000 });
  const log = `424-${check}.log`;
  fs.writeFileSync(path.join(__dirname, log), `npm run ${check}\nexit=${result.status}\n${result.stdout ?? ''}${result.stderr ?? ''}${result.error ?? ''}`);
  results.push({ command: `npm run ${check}`, exit: result.status, log });
  fs.writeFileSync(path.join(__dirname, '424-results.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(`${check}: ${result.status}`);
}
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
