/* eslint-disable @typescript-eslint/no-require-imports -- plain Node script used by CI. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REGISTRY = path.join(__dirname, '../ci/projects.json');
// Changes here affect how every project is checked, so they re-run everything.
const GLOBAL_PATHS = ['.github/ci/', '.github/workflows/ci.yml', '.github/scripts/'];

function loadProjects(file = REGISTRY) {
  const { projects } = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const p of projects) {
    for (const check of p.known_failing) {
      if (!p.checks.includes(check)) throw new Error(`${p.name}: known_failing "${check}" is not in checks`);
    }
  }
  return projects;
}

// Returns the projects whose directory contains at least one changed file.
// `changedFiles === null` means "unknown diff" (push to main, manual run) and selects all.
function selectProjects(projects, changedFiles) {
  if (changedFiles === null) return projects;
  if (changedFiles.some(f => GLOBAL_PATHS.some(g => f.startsWith(g)))) return projects;
  return projects.filter(p => changedFiles.some(f => f.startsWith(p.dir + '/')));
}

function changedFilesBetween(base, head) {
  const out = execFileSync('git', ['diff', '--name-only', `${base}...${head}`], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

module.exports = { loadProjects, selectProjects, GLOBAL_PATHS };

if (require.main === module) {
  const [base, head] = process.argv.slice(2);
  const projects = loadProjects();
  const selected = selectProjects(projects, base && head ? changedFilesBetween(base, head) : null);
  const matrix = JSON.stringify({ include: selected });
  console.log(`Selected: ${selected.map(p => p.name).join(', ') || '(none)'}`);
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${matrix}\nany=${selected.length > 0}\n`);
  }
}
