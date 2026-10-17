const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { randomUUID, createHash } = require('node:crypto');
const { unlink, readdir, readFile } = require('node:fs/promises');
const { PrismaClient } = require('@prisma/client');
const { resolve } = require('node:path');
const { Test } = require('@nestjs/testing');
const { ConfigService } = require('@nestjs/config');
const { AppModule } = require('../dist/app.module');
const { PrismaService } = require('../dist/persistence/prisma.service');
const { ParsingService } = require('../dist/intake/parsing.service');
const { JobsService } = require('../dist/intake/jobs.service');
const { WorkspaceGuard } = require('../dist/intake/workspace.guard');
const { AiService } = require('../dist/intake/ai.service');
const { CoreRecordClient } = require('../dist/core-record/core-record.client');
const { JdContentFacade } = require('../dist/core-record/jd-content.facade');

function pdfFixture(text) {
  const stream = text ? `BT /F1 12 Tf 50 750 Td (${text}) Tj ET` : '';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let value = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(value.length); value += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = value.length;
  value += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(value);
}

test('intake persistence, validation, parsing and recovery', async (t) => {
  const schema = `intake_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const setupDb = new PrismaClient();
  await setupDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  for (const folder of (await readdir('prisma/migrations')).filter((name) => /^\d/.test(name)).sort()) {
    const sql = await readFile(`prisma/migrations/${folder}/migration.sql`, 'utf8');
    for (const statement of sql.split(';').filter((s) => s.trim())) await setupDb.$executeRawUnsafe(statement);
  }
  let mode = 'ok';
  const model = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    assert.equal(request.temperature, undefined);
    const source = JSON.parse(request.messages[1].content);
    const segment = source.segments[0];
    const fact = { value: segment.text, segmentId: segment.id, quote: mode === 'bad-source' ? 'invented source' : segment.text };
    let result = { title: fact, name: null, email: mode === 'email' ? { value: 'ada@example.com', segmentId: segment.id, quote: segment.text } : null, facts: [], missingFields: [], warnings: [] };
    if (mode.startsWith('star')) {
      assert.match(request.messages[0].content, /draft capability verification card/);
      result = { questions: [{ segmentId: segment.id, quote: mode.endsWith('invalid') ? 'invented source' : segment.text,
        situationPrompt: 'What was the context?', taskPrompt: 'What was your task?', actionPrompt: 'What did you do?', resultPrompt: 'What changed?' }], warnings: [] };
    }
    if (mode.startsWith('claims')) result = { cards: [{ cardId: 'card-test', claims: [{ segmentId: segment.id, quote: mode.endsWith('invalid') ? 'invented experience' : segment.text }] }] };
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ choices: [{ message: { content: mode === 'bad-json' ? '{' : JSON.stringify(result) } }], usage: { total_tokens: 10 } }));
  });
  await new Promise((done) => model.listen(0, '127.0.0.1', done));
  process.env.HIREOS_AI_BASE_URL = `http://127.0.0.1:${model.address().port}`;
  process.env.HIREOS_AI_API_KEY = 'test-only'; process.env.HIREOS_AI_MODEL = 'fixture-model';
  process.env.HIREOS_AI_TIMEOUT_SECONDS = '60';
  const workspaceId = `test-${randomUUID()}`;
  const identity = { workspaceId, actorId: 'test-user' };
  // Core Record is a separate service; stand in for its upload endpoint (hash-deduped like
  // the real one) so this test doesn't depend on a running core-record instance.
  // Candidates / Applications / Jobs are kept in memory, idempotent by key like the real service.
  const coreJobs = new Map(); const coreCandidates = new Map(); const materialCandidates = new Map(); const listJobsStatuses = []; const coreApplications = new Map(); const emailMatches = [];
  const once = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };
  const coreRecord = {
    async uploadMaterial(_identity, file) {
      const hash = createHash('sha256').update(file.buffer).digest('hex');
      return { id: `core-${hash.slice(0, 32)}`, name: file.originalname, mime: file.mimetype, size: file.buffer.length, hash, readStatus: 'available', securityStatus: 'clean' };
    },
    async getJob(_identity, id) { if (!coreJobs.has(id)) throw Object.assign(new Error('NOT_FOUND'), { status: 404 }); return coreJobs.get(id); },
    // Résumé file -> Core candidate, shared across subsystems (Core's /candidates/from-material).
    async resolveCandidateForMaterial(_identity, body) {
      if (materialCandidates.has(body.materialId)) return { ...coreCandidates.get(materialCandidates.get(body.materialId)), created: false };
      const candidate = { id: randomUUID(), displayName: body.displayName, identityStatus: 'provisional', status: 'active' };
      coreCandidates.set(candidate.id, candidate); materialCandidates.set(body.materialId, candidate.id);
      return { ...candidate, created: true };
    },
    async createCandidate(_identity, body, key) { return once(coreCandidates, key, () => ({ id: randomUUID(), displayName: body.displayName, identityStatus: 'provisional', status: 'active' })); },
    async createApplication(_identity, body, key) { return once(coreApplications, key, () => ({ id: randomUUID(), ...body, status: 'active' })); },
    async findCandidatesByEmail() { return emailMatches; },
    async listJobs(_identity, _q, status) { listJobsStatuses.push(status); return [...coreJobs.values()].filter((j) => !status || j.status === status); },
  };
  // JD subsystem stand-in: same JD text (whitespace-normalized) resolves to the same job.
  const jdSources = new Map(); const jdCalls = [];
  const jdContent = {
    async get(_identity, coreJobId) { const text = [...jdSources].find(([, id]) => id === coreJobId)?.[0]; return text ? { responsibilities: [], requirements: [], sourceText: text } : null; },
    async createFromText(_identity, body, key) {
      jdCalls.push({ body, key });
      const norm = body.text.replace(/\s+/g, ' ').trim();
      if (jdSources.has(norm)) { const id = jdSources.get(norm); return { coreJobId: id, title: coreJobs.get(id).title, jdText: body.text, duplicate: true }; }
      const job = { id: randomUUID(), title: body.text.trim().split('\n')[0], status: 'draft' };
      coreJobs.set(job.id, job); jdSources.set(norm, job.id);
      return { coreJobId: job.id, title: job.title, jdText: body.text, duplicate: false };
    },
  };
  const module = await Test.createTestingModule({ imports: [AppModule] }).overrideGuard(WorkspaceGuard).useValue({
    canActivate(context) { context.switchToHttp().getRequest().identity = identity; return true; },
  }).overrideProvider(CoreRecordClient).useValue(coreRecord).overrideProvider(JdContentFacade).useValue(jdContent).compile();
  const app = module.createNestApplication({ logger: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const db = app.get(PrismaService); const worker = app.get(ParsingService);
  await worker.onModuleDestroy();
  const base = `http://127.0.0.1:${app.getHttpServer().address().port}/api`;
  const send = (path, body, key = randomUUID(), method = 'POST') => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key }, body: JSON.stringify(body) });
  const jdText = 'Backend Engineer\n\nBuild reliable APIs.';
  let job;
  try {
    await t.test('an attached job is readable within its workspace', async () => {
      // Jobs are owned by Core Record and attached via POST /jobs/attach; seed one directly.
      job = await db.job.create({ data: { workspaceId, createdBy: identity.actorId, coreJobId: randomUUID(), title: 'Backend Engineer', jdText: jdText } });
      const read = await (await fetch(`${base}/jobs/${job.id}`)).json();
      assert.equal(read.id, job.id); assert.equal(read.jdText, jdText); assert.equal(read.tasks.length, 0);
    });
    await t.test('workspace isolation and production fail-closed guard', async () => {
      await assert.rejects(app.get(JobsService).get('different-workspace', job.id), (e) => e.getStatus() === 404);
      const guard = new WorkspaceGuard(new ConfigService({ NODE_ENV: 'production', DEV_AUTH_ENABLED: 'true' }));
      await assert.rejects(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ headers: {}, method: 'GET' }) }) }), (e) => e.getStatus() === 401);
    });
    let resumeMaterial;
    await t.test('real TXT, PDF and DOCX extraction; OCR, invalid and oversized files', async () => {
      const upload = async (name, content) => { const form = new FormData(); form.append('file', new Blob([content]), name); return fetch(`${base}/materials`, { method: 'POST', body: form }); };
      let response = await upload('Ada_Example.txt', 'Ada Example\n\nBuilt APIs with NestJS.');
      assert.equal(response.status, 201); resumeMaterial = await response.json();
      assert.equal(resumeMaterial.readStatus, 'available'); assert.match(resumeMaterial.text, /Ada/);
      assert.equal(resumeMaterial.storageKey, undefined);
      assert.equal((await upload('fake.pdf', 'not pdf')).status, 400);
      assert.equal((await upload('empty.txt', '')).status, 400);
      assert.equal((await upload('large.txt', Buffer.alloc(10 * 1024 * 1024 + 1))).status, 413);
      response = await upload('role.pdf', pdfFixture('PDF Engineer'));
      assert.equal(response.status, 201); const pdf = await response.json(); assert.match(pdf.text, /PDF Engineer/); assert.equal(pdf.segments[0].page, 1);
      response = await upload('scan.pdf', pdfFixture(''));
      assert.equal((await response.json()).errorCode, 'OCR_REQUIRED');
      const JSZip = require('jszip'); const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX Engineer</w:t></w:r></w:p></w:body></w:document>');
      response = await upload('role.docx', await zip.generateAsync({ type: 'nodebuffer' }));
      assert.equal(response.status, 201); assert.match((await response.json()).text, /DOCX Engineer/);
    });
    let task;
    await t.test('linking a résumé creates exactly one task per (job, candidate); relinking reuses it', async () => {
      let response = await send(`/jobs/${job.id}/tasks`, { materialId: resumeMaterial.id });
      assert.equal(response.status, 201); task = await response.json();
      assert.equal(task.candidate.name, 'Ada Example');
      assert.equal(task.job.id, job.id);
      const again = await send(`/jobs/${job.id}/tasks`, { materialId: resumeMaterial.id });
      assert.equal((await again.json()).id, task.id, 'relinking the same résumé reuses the same task');
      const linked = await db.interviewTask.findUnique({ where: { id: task.id }, include: { candidate: true } });
      assert.equal(linked.origin, 'manual'); assert.ok(linked.coreApplicationId, 'a Core Record application is registered');
      assert.ok(linked.candidate.coreCandidateId, 'the candidate is registered with Core Record');
      assert.equal(coreApplications.size, 1, 'relinking does not register a second application');
      const refreshed = await (await fetch(`${base}/jobs/${job.id}`)).json();
      assert.equal(refreshed.tasks.length, 1);
    });
    let quickJob;
    await t.test('quick start: new JD text + one résumé creates the job via JD and one task', async () => {
      const upload = async (name, content) => { const form = new FormData(); form.append('file', new Blob([content]), name); return (await fetch(`${base}/materials`, { method: 'POST', body: form })).json(); };
      const resume = await upload('Lin_Chen.txt', 'Lin Chen\n\nShipped payment systems.');
      const response = await send('/quick-start', { jd: { text: 'Platform Engineer\nRemote\n\nOwn the platform.' }, resumeMaterialId: resume.id }, 'qs-key-1');
      assert.equal(response.status, 201); const body = await response.json();
      assert.equal(body.duplicate, false); quickJob = body.job;
      assert.equal(quickJob.title, 'Platform Engineer'); assert.ok(quickJob.coreJobId);
      assert.match(quickJob.jdText, /Own the platform/, 'local JD text comes from the JD source text');
      assert.equal(jdCalls.at(-1).key, 'interview.quick-start:qs-key-1');
      assert.equal(body.task.job.id, quickJob.id); assert.equal(body.task.candidate.name, 'Lin Chen');
      const row = await db.interviewTask.findUnique({ where: { id: body.task.id } });
      assert.equal(row.origin, 'quick_start'); assert.ok(row.coreApplicationId);
      assert.equal([...coreApplications.values()].at(-1).origin, 'interview_quick_start');
      const listed = await (await fetch(`${base}/tasks`)).json();
      assert.equal(listed.find(t => t.id === body.task.id).resume.material.id, resume.id);
      assert.equal(listed.find(t => t.id === body.task.id).resume.material.name, 'Lin_Chen.txt');
      await db.interviewTask.update({ where: { id: body.task.id }, data: { resumeId: null } });
      const withoutResume = await (await fetch(`${base}/tasks`)).json();
      assert.equal(withoutResume.find(t => t.id === body.task.id).resume, null);
      await db.interviewTask.update({ where: { id: body.task.id }, data: { resumeId: row.resumeId } });
    });
    await t.test('quick start: a résumé another subsystem already knows reuses that Core candidate', async () => {
      const form = new FormData(); form.append('file', new Blob(['Wen Shared\n\nKnown to Written already.']), 'Wen_Shared.txt');
      const resume = await (await fetch(`${base}/materials`, { method: 'POST', body: form })).json();
      const local = await db.material.findUnique({ where: { id: resume.id } });
      const writtenCandidate = { id: randomUUID(), displayName: 'Wen Shared', identityStatus: 'provisional', status: 'active' };
      coreCandidates.set(writtenCandidate.id, writtenCandidate); materialCandidates.set(local.coreMaterialId, writtenCandidate.id);
      coreJobs.get(quickJob.coreJobId).status = 'open'; // published in JD meanwhile, so it can be picked
      const body = await (await send('/quick-start', { jd: { coreJobId: quickJob.coreJobId }, resumeMaterialId: resume.id })).json();
      const row = await db.interviewTask.findUnique({ where: { id: body.task.id }, include: { candidate: true } });
      assert.equal(row.candidate.coreCandidateId, writtenCandidate.id);
      assert.equal([...coreApplications.values()].find((a) => a.id === row.coreApplicationId).candidateId, writtenCandidate.id);
    });
    await t.test('quick start: the same JD again is reported as a duplicate of the existing job', async () => {
      const body = await (await send('/quick-start', { jd: { text: '  Platform Engineer\nRemote\n\n  Own the platform.  ' } })).json();
      assert.equal(body.duplicate, true); assert.equal(body.job.id, quickJob.id); assert.equal(body.task, null);
      assert.equal(await db.job.count({ where: { workspaceId, coreJobId: quickJob.coreJobId } }), 1);
    });
    await t.test('the job list picks up fields filled in Core Record later (e.g. by JD structuring)', async () => {
      Object.assign(coreJobs.get(quickJob.coreJobId), { location: 'Remote (APAC)', team: 'Platform' });
      const rows = await (await fetch(`${base}/jobs`)).json();
      const row = rows.find((r) => r.id === quickJob.id);
      assert.equal(row.location, 'Remote (APAC)'); assert.equal(row.department, 'Platform');
    });
    await t.test('quick start: an existing Core Record job can be picked instead of new JD text', async () => {
      const coreJob = { id: randomUUID(), title: 'Data Engineer', status: 'open' }; coreJobs.set(coreJob.id, coreJob);
      const callsBefore = jdCalls.length;
      const body = await (await send('/quick-start', { jd: { coreJobId: coreJob.id } })).json();
      assert.equal(body.job.coreJobId, coreJob.id); assert.equal(body.job.title, 'Data Engineer'); assert.equal(body.duplicate, false);
      assert.equal(jdCalls.length, callsBefore, 'picking an existing job does not touch JD intake');
    });
    await t.test('choosing an existing job: only published jobs are offered or accepted', async () => {
      const draft = { id: randomUUID(), title: 'Still a draft', status: 'draft' }; coreJobs.set(draft.id, draft);
      const offered = await (await fetch(`${base}/external-jobs`)).json();
      assert.equal(listJobsStatuses.at(-1), 'open', 'the picker asks Core Record for published jobs');
      assert.ok(!offered.some((j) => j.id === draft.id));
      const response = await send('/quick-start', { jd: { coreJobId: draft.id } });
      assert.equal(response.status, 409); assert.equal((await response.json()).code, 'JOB_NOT_PUBLISHED');
      assert.equal(await db.job.count({ where: { workspaceId, coreJobId: draft.id } }), 0);
    });
    await t.test('quick start: a bad résumé is rejected before anything is created upstream', async () => {
      const callsBefore = jdCalls.length;
      assert.equal((await send('/quick-start', { jd: { text: 'Ghost Role' }, resumeMaterialId: randomUUID() })).status, 404);
      assert.equal((await send('/quick-start', { jd: { text: '   ' } })).status, 422);
      assert.equal((await send('/quick-start', { jd: { text: 'x', coreJobId: 'y' } })).status, 422);
      assert.equal(jdCalls.length, callsBefore);
    });
    let interviewer;
    await t.test('a task is created with two generic rounds automatically', async () => {
      const rounds = await (await fetch(`${base}/tasks/${task.id}/rounds`)).json();
      assert.equal(rounds.length, 2);
      assert.deepEqual(rounds.map((r) => r.sequence), [1, 2]);
      assert.deepEqual(rounds.map((r) => r.name), ['Round 1', 'Round 2']);
      assert.ok(rounds.every((r) => r.status === 'Planned' && r.interviewer === null));
    });
    await t.test('a new round can be added manually and takes the next sequence number', async () => {
      interviewer = await db.interviewer.create({ data: { workspaceId, name: 'Dana Scott', title: 'Panel Lead' } });
      const response = await send(`/tasks/${task.id}/rounds`, { name: 'Culture round', interviewerId: interviewer.id, questions: 5, mandatory: 8 });
      assert.equal(response.status, 201); const round = await response.json();
      assert.equal(round.sequence, 3);
      assert.equal(round.name, 'Culture round');
      assert.equal(round.interviewer.name, 'Dana Scott');
      assert.equal(round.mandatory, 5, 'mandatory is clamped to the question count');
      const rounds = await (await fetch(`${base}/tasks/${task.id}/rounds`)).json();
      assert.equal(rounds.length, 3);
      assert.equal((await send(`/tasks/${task.id}/rounds`, { interviewerId: randomUUID() })).status, 400, 'unknown interviewer is rejected');
      assert.equal((await send(`/tasks/${randomUUID()}/rounds`, {})).status, 404);
    });
    await t.test('round edits are versioned independently and validate the interviewer', async () => {
      const rounds = await (await fetch(`${base}/tasks/${task.id}/rounds`)).json();
      const round = rounds[0];
      const body = { version: round.version, name: 'Round 1 — revised', format: 'Video interview', duration: 60,
        competencies: 'System Design, Communication', questions: 4, mandatory: 2, notes: 'Focus on trade-offs.',
        status: 'completed', interviewerId: interviewer.id };
      let response = await send(`/rounds/${round.id}`, body, '', 'PATCH');
      assert.equal(response.status, 200); const saved = await response.json();
      assert.equal(saved.version, 2); assert.equal(saved.status, 'completed'); assert.equal(saved.interviewer.name, 'Dana Scott');
      response = await send(`/rounds/${round.id}`, body, '', 'PATCH');
      assert.equal(response.status, 409, 'stale version is rejected');
      assert.equal((await send(`/rounds/${round.id}`, { ...body, version: 2, interviewerId: randomUUID() }, '', 'PATCH')).status, 400);
    });
    await t.test('AI extraction is sourced and never silently edits job or candidate fields', async () => {
      await worker.tick(); await worker.tick();
      const resumeParse = await db.parseJob.findFirst({ where: { workspaceId, type: 'resume', materialId: resumeMaterial.id } });
      assert.equal(resumeParse.status, 'needs_review'); assert.equal(resumeParse.result.title.segmentId, 's1');
      assert.equal((await db.job.findUnique({ where: { id: job.id } })).title, 'Backend Engineer');
      const candidate = await db.candidate.findUnique({ where: { id: task.candidate.id } });
      assert.equal(candidate.name, 'Ada Example');
    });
    await t.test('a parsed email matching another Core candidate flags (never merges) the candidate', async () => {
      const form = new FormData(); form.append('file', new Blob(['Ada Again\n\nada@example.com']), 'Ada_Again.txt');
      const material = await (await fetch(`${base}/materials`, { method: 'POST', body: form })).json();
      const linked = await (await send(`/jobs/${job.id}/tasks`, { materialId: material.id })).json();
      emailMatches.push({ id: randomUUID(), displayName: 'Ada Example', email: 'ada@example.com' });
      mode = 'email';
      try { for (let i = 0; i < 4; i++) await worker.tick(); } finally { mode = 'ok'; emailMatches.length = 0; }
      const candidate = await db.candidate.findUnique({ where: { id: linked.candidate.id } });
      assert.equal(candidate.possibleDuplicate, true); assert.equal(candidate.name, 'Ada Again');
      const list = await (await fetch(`${base}/tasks`)).json();
      assert.equal(list.find((row) => row.id === linked.id).candidate.possibleDuplicate, true);
    });
    await t.test('invalid AI responses and missing configuration stay explicit', async () => {
      const ai = app.get(AiService); const source = { sourceId: 'test', segments: [{ id: 's1', text: 'Engineer' }] };
      mode = 'bad-json'; await assert.rejects(ai.extract('resume', source), (e) => e.code === 'AI_OUTPUT_INVALID');
      mode = 'bad-source'; await assert.rejects(ai.extract('resume', source), (e) => e.code === 'AI_SOURCE_INVALID');
      mode = 'ok';
      await assert.rejects(new AiService({ get: () => undefined }).extract('resume', source), (e) => e.code === 'AI_NOT_CONFIGURED');
    });
    await t.test('task status changes are versioned independently of the job', async () => {
      const body = { version: 1, status: 'ready_to_schedule' };
      const response = await send(`/tasks/${task.id}/intake`, body, '', 'PATCH');
      assert.equal(response.status, 200); const saved = await response.json();
      assert.equal(saved.status, 'ready_to_schedule'); assert.equal(saved.reviewed, true);
      assert.equal(await db.revision.count({ where: { taskId: task.id } }), 1);
    });
    await t.test('#250: registered preview and claims adapters validate real HTTP model responses', async () => {
      const ai = app.get(AiService);
      const source = { sourceId: 'test', segments: [{ id: 'card-test', text: 'Build reliable APIs' }] };
      try {
        mode = 'star';
        assert.equal((await ai.extract('rubric_questions', source)).result.questions[0].segmentId, 'card-test');
        mode = 'star-invalid';
        await assert.rejects(ai.extract('rubric_questions', source), e => e.code === 'AI_SOURCE_INVALID');
        mode = 'claims';
        assert.equal((await ai.extract('rubric_claims', { ...source, cards: [{ id: 'card-test' }] })).result.cards[0].claims[0].quote, 'Build reliable APIs');
        mode = 'claims-invalid';
        await assert.rejects(ai.extract('rubric_claims', source), e => e.code === 'AI_SOURCE_INVALID');
      } finally { mode = 'ok'; }
    });
    await t.test('expired leases recover without overriding human edits', async () => {
      const resumeParse = await db.parseJob.findFirst({ where: { workspaceId, type: 'resume', materialId: resumeMaterial.id } });
      await db.candidate.update({ where: { id: task.candidate.id }, data: { name: 'Ada Reviewed' } });
      await db.parseJob.update({ where: { id: resumeParse.id }, data: { status: 'parsing', leaseToken: 'dead-worker', leaseUntil: new Date(0) } });
      await worker.tick();
      assert.equal((await db.parseJob.findUnique({ where: { id: resumeParse.id } })).status, 'needs_review');
      assert.equal((await db.candidate.findUnique({ where: { id: task.candidate.id } })).name, 'Ada Reviewed');
    });
    await t.test('#325/#250: real persisted JD levels and task-scoped resume claims APIs', async () => {
      const { RubricService } = require('../dist/rubric/rubric.service');
      const svc = app.get(RubricService);
      const originalGet = jdContent.get;
      const requirements = [
        { id: 'req-api', label: 'Build reliable APIs', requiredLevel: 4 },
        { id: 'req-sql', label: 'Design SQL schemas', requiredLevel: 3 },
      ];
      jdContent.get = async () => ({ requirements, responsibilities: [], roleSummary: 'Backend Engineer' });
      try {
        const queued = await svc.generate(workspaceId, job.id, identity);
        assert.deepEqual(queued.input.requirements, requirements);
        const cards = requirements.map((r, i) => ({ requirement: r.label, responsibilityType: 'lead', cardPriority: 'P0', competencyTags: ['API'], expectedEvidence: 'Specific project', levelAnchors: { l1: '1', l2: '2', l3: '3', l4: '4', l5: '5' }, weight: 50, segmentId: `jd-requirement:${r.id}`, quote: r.label }));
        await db.parseJob.update({ where: { id: queued.id }, data: { status: 'needs_review', result: { cards, warnings: [] } } });
        const rubric = (await svc.getRubric(workspaceId, job.id)).rubric;
        assert.deepEqual(rubric.cards.map(c => c.requiredLevel), [4, 3]);
        assert.deepEqual(rubric.cards.map(c => c.sourceRequirementId), ['req-api', 'req-sql']);
        const [one, two] = await Promise.all([send(`/tasks/${task.id}/rubric-claims`, {}), send(`/tasks/${task.id}/rubric-claims`, {})]);
        assert.equal(one.status, 201); assert.equal(two.status, 201);
        assert.equal(await db.parseJob.count({ where: { taskId: task.id, type: 'rubric_claims' } }), 1);
        const parse = await db.parseJob.findFirst({ where: { taskId: task.id, type: 'rubric_claims' } });
        const segment = parse.input.segments.find(s => s.text.includes('Built APIs'));
        const result = { cards: [{ cardId: rubric.cards[0].id, claims: [{ segmentId: segment.id, quote: 'Built APIs with NestJS.' }] }, { cardId: rubric.cards[1].id, claims: [] }] };
        await db.parseJob.update({ where: { id: parse.id }, data: { status: 'needs_review', result } });
        const read = await (await fetch(`${base}/tasks/${task.id}/rubric-claims`)).json();
        assert.equal(read.materialId, resumeMaterial.id);
        assert.equal(read.cards.find(c => c.cardId === rubric.cards[0].id).claims[0].quote, 'Built APIs with NestJS.');
        assert.deepEqual(read.cards.find(c => c.cardId === rubric.cards[1].id).claims, []);
        await assert.rejects(svc.candidateClaims('other-workspace', task.id), e => e.getStatus() === 404);
        const candidate = await db.candidate.create({ data: { workspaceId, name: 'Other synthetic candidate' } });
        const other = await db.interviewTask.create({ data: { workspaceId, createdBy: identity.actorId, jobId: job.id, candidateId: candidate.id } });
        const noResume = await svc.candidateClaims(workspaceId, other.id);
        assert.equal(noResume.status, 'missing_resume_or_rubric');
        assert.deepEqual(noResume.cards, []);
        result.cards[0].claims[0].quote = 'Invented experience';
        await db.parseJob.update({ where: { id: parse.id }, data: { result } });
        assert.equal((await svc.candidateClaims(workspaceId, task.id)).status, 'failed');
        assert.equal((await svc.candidateClaims(workspaceId, task.id, true)).status, 'queued');
        const { BriefService } = require('../dist/brief/brief.service');
        const brief = app.get(BriefService);
        const beforeQuestions = await db.interviewQuestion.count({ where: { workspaceId } });
        const previews = await Promise.all([send(`/jobs/${job.id}/rubric-questions`, {}), send(`/jobs/${job.id}/rubric-questions`, {})]);
        assert.deepEqual(previews.map(r => r.status), [201, 201]);
        assert.equal(await db.parseJob.count({ where: { jobId: job.id, type: 'rubric_questions' } }), 1);
        const preview = await db.parseJob.findFirst({ where: { jobId: job.id, type: 'rubric_questions' } });
        const questions = preview.input.segments.map(s => ({ segmentId: s.id, quote: s.text, situationPrompt: 'What was the context?', taskPrompt: 'What was your task?', actionPrompt: 'What did you do?', resultPrompt: 'What changed?' }));
        await db.parseJob.update({ where: { id: preview.id }, data: { status: 'needs_review', result: { questions, warnings: [] } } });
        const displayed = await (await fetch(`${base}/jobs/${job.id}/rubric-questions`)).json();
        assert.equal(displayed.questions.length, 2);
        assert.equal(displayed.rubricVersionId, rubric.id);
        assert.equal(await db.interviewQuestion.count({ where: { workspaceId } }), beforeQuestions, 'draft preview does not become formal interview questions');
        await assert.rejects(brief.generate(workspaceId, job.id), e => e.getResponse().code === 'RUBRIC_NOT_CONFIRMED');
        await assert.rejects(brief.rubricPreview('other-workspace', job.id), e => e.getStatus() === 404);
        questions[0].quote = 'Invented requirement';
        await db.parseJob.update({ where: { id: preview.id }, data: { result: { questions, warnings: [] } } });
        assert.equal((await brief.rubricPreview(workspaceId, job.id)).generation.status, 'failed');
        assert.equal((await brief.rubricPreview(workspaceId, job.id, true)).generation.status, 'queued');
        await db.capabilityCard.update({ where: { id: rubric.cards[0].id }, data: { requirement: 'Changed requirement' } });
        const changed = await brief.rubricPreview(workspaceId, job.id);
        assert.equal(changed.generation, null);
        assert.deepEqual(changed.questions, [], 'edits invalidate old preview even before the next generation');
        await db.rubricVersion.update({ where: { id: rubric.id }, data: { status: 'confirmed' } });
        const question = await db.interviewQuestion.create({ data: { workspaceId, rubricVersionId: rubric.id, cardId: rubric.cards[0].id,
          situationPrompt: 'HTTP scenario', taskPrompt: 'Task?', actionPrompt: 'Action?', resultPrompt: 'Result?' } });
        const round = await db.interviewRound.create({ data: { workspaceId, taskId: task.id, sequence: 99, name: 'HTTP skip verification',
          format: 'Onsite panel', duration: 45, competencies: '', questions: 1, mandatory: 0, notes: '',
          scheduledAt: new Date(), briefSnapshotRubricVersion: rubric.versionNumber } });
        const skipResponse = await send(`/rounds/${round.id}/questions/${question.id}/skip`, {});
        assert.equal(skipResponse.status, 201);
        const skip = await skipResponse.json();
        assert.equal(skip.actorId, identity.actorId);
        const skipRead = await (await fetch(`${base}/rounds/${round.id}/skipped-questions`)).json();
        assert.equal(skipRead[0].id, skip.id);
        const repeated = await (await send(`/rounds/${round.id}/questions/${question.id}/skip`, {})).json();
        assert.equal(repeated.id, skip.id);
        await db.interviewTask.update({ where: { id: task.id }, data: { debriefConfirmedAt: new Date() } });
        const decisionResponse = await send(`/tasks/${task.id}/decision`, { decision: 'hold', reason: 'HTTP audit reason', version: 0 }, '', 'PATCH');
        assert.equal(decisionResponse.status, 200);
        const decision = await decisionResponse.json();
        assert.equal(decision.decisionReason, 'HTTP audit reason');
        assert.equal(decision.decisionBy, identity.actorId);
        assert.equal(decision.decisionVersion, 1);
        const stale = await send(`/tasks/${task.id}/decision`, { decision: 'do_not_proceed', reason: 'Stale', version: 0 }, '', 'PATCH');
        assert.equal(stale.status, 409);
        const emptyRecommendation = await send(`/rounds/${round.id}/recommendation`, { recommendation: 'advance', reason: ' ' }, '', 'PATCH');
        assert.equal(emptyRecommendation.status, 422);
        const recommended = await send(`/rounds/${round.id}/recommendation`, { recommendation: 'advance', reason: 'HTTP recommendation evidence' }, '', 'PATCH');
        assert.equal(recommended.status, 200);
        assert.equal((await recommended.json()).recommendationReason, 'HTTP recommendation evidence');
        await db.interviewTask.update({ where: { id: task.id }, data: { planConfirmedAt: new Date() } });
        const schedule = await send(`/rounds/${round.id}/schedule`, { version: round.version, scheduledAt: '2026-11-01T10:00:00.000Z', timezone: 'UTC', meetingLink: '', interviewerId: interviewer.id });
        assert.equal(schedule.status, 201);
        assert.equal((await schedule.json()).interviewer.id, interviewer.id);
      } finally { jdContent.get = originalGet; }
    });
  } finally {
    const materials = await db.material.findMany({ where: { workspaceId } });
    await db.interviewTask.deleteMany({ where: { workspaceId } });
    await db.candidate.deleteMany({ where: { workspaceId } });
    await db.job.deleteMany({ where: { workspaceId } });
    await db.material.deleteMany({ where: { workspaceId } });
    // Materials referenced from Core Record have no local file (storageKey is null).
    for (const material of materials.filter((m) => m.storageKey)) await unlink(resolve(process.env.STORAGE_DIR || '.local/materials', material.storageKey)).catch(() => {});
    await app.close(); await new Promise((done) => model.close(done));
    await setupDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await setupDb.$disconnect();
  }
});
