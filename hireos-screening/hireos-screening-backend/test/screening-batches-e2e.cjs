const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFile, readdir } = require('node:fs/promises');
const { chromium } = require('../../hireos-screening-front/node_modules/playwright');
process.loadEnvFile('.env');

(async () => {
  const schema = `batch_e2e_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Local database only');
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { ScreeningService } = require('../dist/screening/screening.service');
  const { ScreeningBatchesService } = require('../dist/screening/screening-batches.service');
  const { ScreeningBatchesController } = require('../dist/screening/screening-batches.controller');
  const { WorkspaceGuard } = require('../dist/auth/workspace.guard');
  const { AiCallError } = require('../dist/shared/ai-json-client');
  const { Test } = require('@nestjs/testing');
  const db = new PrismaService();
  let http;
  let browser;
  const who = { workspaceId: 'e2e-workspace', actorId: 'test-author', roles: [] };
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  try {
    for (const folder of (await readdir('prisma/migrations')).filter(n => /^\d/.test(n)).sort()) {
      const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
      for (const statement of sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n').split(';').filter(s => s.trim())) await db.$executeRawUnsafe(statement);
    }
    const job = await db.job.create({ data: { workspaceId: who.workspaceId, title: 'Isolated end-to-end role', team: 'Test', location: 'Remote', employmentType: 'Full-time', seniority: 'Mid', status: 'open', criteriaStatus: 'confirmed', assessmentRequired: false } });
    await db.jobCriteriaVersion.create({ data: { workspaceId: who.workspaceId, jobId: job.id, version: 1, status: 'confirmed', requirements: [], dimensions: [{ id: 'skills', name: 'Skills', weight: 100, rubric: 'Evidence' }] } });
    const apps = [];
    for (let n = 0; n < 3; n++) {
      const candidate = await db.candidate.create({ data: { workspaceId: who.workspaceId, displayName: `E2E ${n}`, ownerId: who.actorId } });
      const fields = Object.fromEntries(['sourceEntries', 'resumeVersionRefs', 'employmentHistory', 'skills', 'education', 'certifications', 'projects', 'location', 'workAuthorization', 'languages', 'missingFields', 'corrections'].map(k => [k, []]));
      await db.candidateProfile.create({ data: { ...fields, workspaceId: who.workspaceId, candidateId: candidate.id, version: 1, parseStatus: 'succeeded', displayName: candidate.displayName } });
      const material = await db.material.create({ data: { workspaceId: who.workspaceId, name: `candidate-${n}.txt`, mime: 'text/plain', size: 20, hash: randomUUID(), text: `Synthetic resume ${n}`, segments: [], readStatus: 'readable' } });
      await db.resumeVersion.create({ data: { workspaceId: who.workspaceId, candidateId: candidate.id, materialId: material.id, version: 1, parseStatus: 'succeeded' } });
      apps.push({ ...await db.application.create({ data: { workspaceId: who.workspaceId, candidateId: candidate.id, jobId: job.id, linkedBy: who.actorId, linkReason: 'test' } }), candidateName: candidate.displayName });
    }
    const calls = new Map();
    let first = true;
    const ai = { isConfigured: () => true, modelName: () => 'synthetic', evaluate: async input => {
      calls.set(input.resumeText, (calls.get(input.resumeText) ?? 0) + 1);
      if (first) { first = false; throw new AiCallError('AI_HTTP_503: synthetic failure'); }
      return { coverage: 1, confidence: 0.8, dimensionScores: [{ dimensionId: 'skills', evaluated: true, score: 80, reason: 'Synthetic', evidenceQuote: null }], hardRequirementFindings: [] };
    } };
    const batches = new ScreeningBatchesService(db, new ScreeningService(db, ai));
    // Real controllers/services/database, with deterministic worker advancement and a synthetic AI boundary.
    const api = Object.fromEntries(['start', 'get', 'list', 'cancel', 'retry', 'reconcile'].map(name => [name, batches[name].bind(batches)]));
    const module = await Test.createTestingModule({ controllers: [ScreeningBatchesController], providers: [{ provide: ScreeningBatchesService, useValue: api }] })
      .overrideGuard(WorkspaceGuard).useValue({ canActivate: ctx => { ctx.switchToHttp().getRequest().identity = who; return true; } }).compile();
    http = module.createNestApplication({ logger: false });
    await http.listen(0, '127.0.0.1');
    const apiBase = `http://127.0.0.1:${http.getHttpServer().address().port}`;
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/account/api/**', route => route.fulfill({ status: route.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/screening/api/**', async route => {
      const p = new URL(route.request().url()).pathname.replace('/screening/api', '');
      if (p.includes('screening-batches')) return route.fulfill({ response: await route.fetch({ url: apiBase + p }) });
      const viewJob = { ...job, criteriaVersion: 1, requirements: [], dimensions: [], workflowPolicy: {} };
      if (p === `/jobs/${job.id}`) return route.fulfill({ json: viewJob });
      if (p === '/jobs') return route.fulfill({ json: [viewJob] });
      if (p === '/applications') return route.fulfill({ json: apps });
      const match = p.match(/^\/applications\/([^/]+)\/screening$/);
      if (match) return route.fulfill({ json: { application: apps.find(a => a.id === match[1]), evaluation: null, decision: null, concerns: [], verificationItems: [], humanAssessments: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(`http://localhost:8080/screening/jobs/${job.id}/screening`, { waitUntil: 'domcontentloaded' });
    await page.locator('.linked-candidates-table tbody input[type=checkbox]').first().waitFor();
    for (const box of await page.locator('.linked-candidates-table tbody input[type=checkbox]').all()) await box.check();
    const panel = page.getByRole('region', { name: 'Batch screening', exact: true });
    await panel.getByRole('button', { name: 'Screen 3 selected', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm start' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await db.screeningBatch.count(), 1);
    const claim1 = await batches.claim(who.workspaceId);
    const claim2 = await batches.claim(who.workspaceId);
    await batches.execute(claim1);
    await batches.execute(claim2);
    await panel.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await panel.getByRole('button', { name: 'Retry failed item', exact: true }).click();
    await panel.getByRole('button', { name: 'Retry failed item', exact: true }).waitFor({ state: 'hidden' });
    for (let n = 0; n < 3; n++) { const next = await batches.claim(who.workspaceId); if (!next) break; await batches.execute(next); }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByText('Completed: 3', { exact: true }).waitFor();
    assert.equal(await db.application.count(), 3);
    assert.equal(await db.screeningEvaluation.count(), 3);
    assert.equal(await db.screeningBatch.count(), 1);
    assert.deepEqual([...calls.values()].sort(), [1, 1, 2]);
    assert.deepEqual(errors, []);
    console.log('PASS #425 real local HTTP + PostgreSQL browser E2E: 3 members, 1 AI failure, retry only failed item, reload completed=3, 3 Applications, 3 evaluations, provider calls [1,1,2].');
  } finally {
    if (browser) await browser.close();
    if (http) await http.close();
    await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await db.$disconnect();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
