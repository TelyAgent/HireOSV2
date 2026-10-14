/* eslint-disable @typescript-eslint/no-require-imports -- shared QA environment helper. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { loadProjects, selectProjects } = require('./projects.cjs');
function touchedProjects(context, registry) {
  if (context.phase !== 'qa' || !Array.isArray(context.changed_files)) throw new Error('QA requires merged changed_files');
  return selectProjects(registry, context.changed_files.map(file => file.filename));
}
function allowedChange(filename, projects) {
  if (filename.startsWith('evidence/') || filename.startsWith('.trusted/')) return true;
  if (filename.startsWith('test/')) return true;
  return projects.some(p => filename.startsWith(p.dir + '/test/'));
}
function prepare(context, { runner = execFileSync } = {}) {
  const projects = touchedProjects(context, loadProjects(path.resolve('.github/ci/projects.json')));
  fs.mkdirSync('evidence', { recursive: true });
  fs.writeFileSync('evidence/projects.json', JSON.stringify(projects, null, 2));
  for (const project of projects) {
    for (const [tool, args, kind] of [['npm', ['ci', '--no-audit', '--no-fund'], 'install'],
      ...(project.prisma ? [['npx', ['prisma', 'generate'], 'prisma']] : [])]) {
      try {
        const output = runner(tool, args, { cwd: project.dir, encoding: 'utf8' });
        fs.writeFileSync(`evidence/${kind}-${project.name}.log`, output || '');
      } catch (error) {
        fs.writeFileSync(`evidence/${kind}-${project.name}.log`, String(error.stdout || '') + String(error.stderr || error.message));
        throw error;
      }
    }
  }
  return projects;
}
function guard() {
  const projects = JSON.parse(fs.readFileSync('evidence/projects.json', 'utf8'));
  // Include untracked files without staging their content, preserving temporary tests as evidence.
  execFileSync('git', ['add', '-N', '--', '.', ':!evidence', ':!.trusted']);
  const patch = execFileSync('git', ['diff', '--binary', 'HEAD', '--', '.', ':!evidence', ':!.trusted']);
  fs.writeFileSync('evidence/qa-tests.patch', patch);
  const names = execFileSync('git', ['diff', '--name-only', '-z', 'HEAD'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const unexpected = names.filter(name => !allowedChange(name, projects));
  if (unexpected.length) throw new Error('QA modified product files: ' + unexpected.join(', '));
}
module.exports = { touchedProjects, allowedChange, prepare, guard };
if (require.main === module) {
  if (process.argv[2] === 'prepare') prepare(JSON.parse(fs.readFileSync('evidence/context.json', 'utf8')));
  else if (process.argv[2] === 'guard') guard();
  else throw new Error('Expected prepare or guard');
}
