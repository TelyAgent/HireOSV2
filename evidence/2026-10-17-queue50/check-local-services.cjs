const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const registry = require('../../.github/ci/projects.json');
const report = { checkedAt: new Date().toISOString(), databases: [], requests: [] };
const save = () => fs.writeFileSync(path.join(__dirname, 'local-services-results.json'), JSON.stringify(report, null, 2) + '\n');
async function get(route, allowed = [200], port = 8080) {
  let data;
  const result = { route, port, allowed };
  try {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, { signal: AbortSignal.timeout(15000) });
    result.status = response.status;
    data = await response.json();
    result.ok = allowed.includes(response.status);
    if (!response.ok) result.code = data.code ?? data.message;
    if (response.status === 404) {
      const expected = route.endsWith('/drafts/current') ? 'DRAFT_NOT_FOUND' : 'DOCUMENT_NOT_FOUND';
      result.ok = result.ok && result.code === expected;
    }
    if (response.status === 401) result.ok = result.ok && result.code === 'AUTH_REQUIRED';
    if (response.status === 422) result.ok = result.ok && result.code === 'INVALID_SCHEMA';
  } catch (error) { result.ok = false; result.error = error.message; }
  report.requests.push(result); save();
  console.log(`${result.status ?? 'ERROR'} ${route}`);
  return data;
}
const rows = value => Array.isArray(value) ? value : value?.items ?? [];
(async () => {
  for (const project of registry.projects.filter(p => p.prisma)) {
    const cwd = path.join(root, project.dir);
    const guard = spawnSync(process.execPath, ['-e', "process.loadEnvFile('.env');const u=new URL(process.env.DATABASE_URL);if(!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw Error('Not a local database');console.log(JSON.stringify({host:u.hostname,port:u.port,database:u.pathname,schema:u.searchParams.get('schema')||'public'}))"], { cwd, encoding: 'utf8' });
    if (guard.status !== 0) throw Error(`Local database guard failed for ${project.name}`);
    const db = { project: project.name, target: JSON.parse(guard.stdout) };
    for (const [check, args] of Object.entries({ status: ['migrate', 'status'], drift: ['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma', '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code'] })) {
      const result = spawnSync('npx', ['prisma', ...args], { cwd, encoding: 'utf8', timeout: 30000 });
      db[check] = { exit: result.status, output: (result.stdout + result.stderr).trim() };
    }
    report.databases.push(db); save();
  }
  const jd = rows(await get('/jd/api/jobs'));
  for (const job of jd) {
    await get(`/jd/api/jobs/${job.id}`);
    await get(`/jd/api/jobs/${job.id}/drafts/current`, [200, 404]);
    await get(`/jd/api/jobs/${job.id}/documents/internal`, [200, 404]);
    await get(`/jd/api/jobs/${job.id}/documents/external`, [200, 404]);
    await get(`/jd/api/jobs/${job.id}/versions`);
  }
  await get('/jd/api/copilot/conversations');
  const screening = rows(await get('/screening/api/jobs'));
  await get('/screening/api/tasks');
  await get('/screening/api/library');
  await get('/screening/api/connections');
  for (const job of screening) {
    await get(`/screening/api/jobs/${job.id}`);
    await get(`/screening/api/jobs/${job.id}/recommendations`);
    const apps = rows(await get(`/screening/api/applications?jobId=${encodeURIComponent(job.id)}`));
    for (const app of apps) {
      await get(`/screening/api/applications/${app.id}`);
      await get(`/screening/api/applications/${app.id}/screening`);
      await get(`/screening/api/applications/${app.id}/evaluations`);
    }
  }
  const written = rows(await get('/written/api/tasks'));
  await get('/written/api/tasks/stats'); await get('/written/api/questions');
  await get('/written/api/settings/mail-accounts');
  for (const id of new Set(written.map(t => t.caseId).filter(Boolean))) {
    for (const section of ['rounds', 'plan-items', 'invitations', 'context']) await get(`/written/api/cases/${id}/${section}`);
  }
  const interview = rows(await get('/interview/api/tasks'));
  await get('/interview/api/jobs'); await get('/interview/api/interviewers');
  for (const task of interview) {
    await get(`/interview/api/tasks/${task.id}`);
    await get(`/interview/api/tasks/${task.id}/debrief`);
    await get(`/interview/api/tasks/${task.id}/decision`);
    await get(`/interview/api/tasks/${task.id}/package/versions`);
    await get(`/interview/api/tasks/${task.id}/package/events`);
    const rounds = rows(await get(`/interview/api/tasks/${task.id}/rounds`));
    for (const round of rounds) {
      for (const section of ['scores', 'summary', 'skipped-questions', 'transcript']) await get(`/interview/api/rounds/${round.id}/${section}`);
    }
  }
  await get('/core-record/api/v1/health', [200], 8090);
  const coreJobs = rows(await get('/core-record/api/v1/jobs', [200], 8090));
  for (const job of coreJobs.slice(0, 5)) {
    await get(`/core-record/api/v1/jobs/${job.id}`, [200], 8090);
    await get(`/core-record/api/v1/jobs/${job.id}/role-versions`, [200], 8090);
  }
  await get('/core-record/api/v1/candidates', [422], 8090);
  await get('/core-record/api/v1/candidates?email=local-migration-audit%40example.invalid', [200], 8090);
  await get('/account/api/health'); await get('/account/api/auth/config');
  await get('/account/api/auth/me', [401]);
  const failures = report.requests.filter(r => !r.ok);
  console.log(JSON.stringify({ checked: report.requests.length, failures }));
  if (failures.length || report.databases.some(d => d.status.exit !== 0)) process.exitCode = 1;
})().catch(error => { console.error(error); save(); process.exitCode = 1; });
