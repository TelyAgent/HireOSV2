const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const registry = require('../../.github/ci/projects.json');
const names = ['jd-backend', 'jd-front', 'screening-backend', 'screening-front', 'written-backend', 'written-front', 'interview-backend', 'interview-front'];
const results = [];
for (const name of names) {
  const project = registry.projects.find(p => p.name === name);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, project.dir, 'package.json')));
  for (const check of new Set([...project.checks, ...(pkg.scripts.test ? ['test'] : [])])) {
    const env = { ...process.env, ...(name === 'jd-front' && check === 'test' ? { NODE_OPTIONS: '--no-experimental-webstorage' } : {}) };
    const run = spawnSync('npm', ['run', check], { cwd: path.join(root, project.dir), env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240000 });
    const log = `merge-${name}-${check}.log`;
    fs.writeFileSync(path.join(__dirname, log), `npm run ${check}\nexit=${run.status}\n${run.stdout ?? ''}${run.stderr ?? ''}${run.error ?? ''}`);
    results.push({ name, command: `npm run ${check}`, exit: run.status, log });
    fs.writeFileSync(path.join(__dirname, 'merge-results.json'), JSON.stringify(results, null, 2) + '\n');
    console.log(`${name} ${check}: ${run.status}`);
  }
}
process.exitCode = results.some(r => r.exit !== 0) ? 1 : 0;
