// The new-task entry: one JD + one résumé becomes a written-test case, with the job created in JD
// (deduped there) and the candidate + application registered in Core Record.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

test('quick start creates a case from a JD and a résumé', async (t) => {
  if (!process.env.DATABASE_URL) return t.skip('DATABASE_URL not set');
  const schema = `written_qs_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.set('schema', schema);
  process.env.DATABASE_URL = url.toString();
  const setupDb = new PrismaClient();
  await setupDb.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  // Some migration files carry ';' inside comments, so let Prisma apply them rather than splitting by hand.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { env: process.env, stdio: 'ignore' });

  const { NotFoundException } = require('@nestjs/common');
  const { PrismaService } = require('../dist/persistence/prisma.service');
  const { QuickStartService } = require('../dist/intake/quick-start.service');
  const { extractText } = require('../dist/intake/text-extraction');
  const identity = { workspaceId: `test-${randomUUID()}`, actorId: 'test-user', roles: [] };

  const listCalls = []; const files = new Map(); const jobs = new Map(); const candidates = new Map(); const applications = new Map();
  const once = (map, key, make) => { if (!map.has(key)) map.set(key, make()); return map.get(key); };
  const core = {
    async uploadMaterial(_i, file) { const id = randomUUID(); files.set(id, { name: file.originalname, buffer: file.buffer }); return { id, name: file.originalname }; },
    async getMaterial(_i, id) { if (!files.has(id)) throw new NotFoundException({ code: 'NOT_FOUND' }); return { id, name: files.get(id).name }; },
    async downloadMaterialContent(_i, id) { return files.get(id).buffer; },
    async getJob(_i, id) { if (!jobs.has(id)) throw new NotFoundException({ code: 'NOT_FOUND' }); return jobs.get(id); },
    async listJobs(_i, q, status) { listCalls.push([q, status]); return [...jobs.values()]; },
    async resolveCandidateForMaterial(_i, body) {
      const created = !candidates.has(body.materialId);
      return { ...once(candidates, body.materialId, () => ({ id: randomUUID(), displayName: body.displayName, identityStatus: 'provisional', status: 'active' })), created };
    },
    async createApplication(_i, body, key) { return once(applications, key, () => ({ id: randomUUID(), ...body, status: 'active' })); },
  };
  const sources = new Map(); const jdCalls = [];
  const jd = {
    async get(_i, coreJobId) { const text = [...sources].find(([, id]) => id === coreJobId)?.[0]; return text ? { responsibilities: [], requirements: [], sourceText: text } : null; },
    async createFromText(_i, body, key) {
      jdCalls.push({ body, key });
      const norm = body.text.replace(/\s+/g, ' ').trim();
      if (sources.has(norm)) { const id = sources.get(norm); return { coreJobId: id, title: jobs.get(id).title, jdText: body.text, duplicate: true }; }
      const job = { id: randomUUID(), title: body.text.trim().split('\n')[0], status: 'draft' };
      jobs.set(job.id, job); sources.set(norm, job.id);
      return { coreJobId: job.id, title: job.title, jdText: body.text, duplicate: false };
    },
  };
  const db = new PrismaService(); await db.$connect();
  const service = new QuickStartService(db, core, jd);
  const upload = (name, text) => service.upload(identity, { originalname: name, buffer: Buffer.from(text), size: Buffer.byteLength(text) });
  try {
    const resume = await upload('Lin_Chen.txt', 'Lin Chen\n\nShipped payment systems.');
    let first;
    await t.test('upload stores the file in Core Record and returns its text', async () => {
      assert.equal(resume.readStatus, 'available'); assert.match(resume.text, /Shipped payment systems/);
      await assert.rejects(upload('notes.md', 'x'), (e) => e.response?.code === 'UNSUPPORTED_FILE_TYPE');
      await assert.rejects(upload('fake.pdf', 'not a pdf'), (e) => e.response?.code === 'UNSUPPORTED_FILE_TYPE');
    });
    await t.test('new JD text + résumé creates the job via JD, the Core application, and one linked case with its task', async () => {
      first = await service.start(identity, { jd: { text: 'Payments Engineer\nRemote\n\nOwn the ledger.' }, resumeMaterialId: resume.id }, 'key-1');
      assert.equal(first.duplicate, false); assert.equal(first.jobTitle, 'Payments Engineer'); assert.equal(first.candidateName, 'Lin Chen');
      assert.equal(jdCalls.at(-1).key, 'written.quick-start:key-1');
      const kase = await db.case.findUnique({ where: { id: first.caseId }, include: { job: true, task: true } });
      assert.equal(kase.status, 'linked'); assert.equal(kase.origin, 'quick_start');
      assert.match(kase.resumeText, /Shipped payment systems/); assert.match(kase.job.jdText, /Own the ledger/);
      assert.equal(kase.coreApplicationId, [...applications.values()][0].id);
      assert.equal([...applications.values()][0].origin, 'written_quick_start');
      assert.equal(kase.task.type, 'invite_pending'); assert.equal(kase.task.title, 'Lin Chen — plan ready, test not yet sent');
    });
    await t.test('the same JD and résumé again reuse the job, candidate and case, flagged as a duplicate JD', async () => {
      const again = await service.start(identity, { jd: { text: '  Payments Engineer\nRemote\n\n Own the ledger. ' }, resumeMaterialId: resume.id });
      assert.equal(again.duplicate, true); assert.equal(again.caseId, first.caseId);
      assert.equal(await db.case.count({ where: { workspaceId: identity.workspaceId } }), 1);
      assert.equal(candidates.size, 1); assert.equal(applications.size, 1);
    });
    await t.test('a résumé another subsystem already linked to a candidate keeps that candidate', async () => {
      const known = await upload('Wen_Shared.txt', 'Wen Shared\n\nAlready interviewed.');
      const interviewCandidate = { id: randomUUID(), displayName: 'Wen (from Interview)', identityStatus: 'provisional', status: 'active' };
      candidates.set(known.id, interviewCandidate);
      const result = await service.start(identity, { jd: { text: 'Payments Engineer\nRemote\n\nOwn the ledger.' }, resumeMaterialId: known.id });
      const kase = await db.case.findUnique({ where: { id: result.caseId }, include: { candidate: true } });
      assert.equal(kase.candidate.coreCandidateId, interviewCandidate.id);
      assert.equal(result.candidateName, 'Wen (from Interview)');
    });
    await t.test('an existing Core Record job can be picked instead of new JD text', async () => {
      const job = { id: randomUUID(), title: 'Data Analyst', status: 'open' }; jobs.set(job.id, job);
      const callsBefore = jdCalls.length;
      const result = await service.start(identity, { jd: { coreJobId: job.id }, resumeMaterialId: resume.id });
      assert.equal(result.jobTitle, 'Data Analyst'); assert.notEqual(result.caseId, first.caseId);
      assert.equal(jdCalls.length, callsBefore, 'picking an existing job does not touch JD intake');
    });
    await t.test('choosing an existing job: only published jobs are offered or accepted', async () => {
      const draft = { id: randomUUID(), title: 'Still a draft', status: 'draft' }; jobs.set(draft.id, draft);
      await service.searchJobs(identity, 'x');
      assert.deepEqual(listCalls.at(-1), ['x', 'open']);
      await assert.rejects(service.start(identity, { jd: { coreJobId: draft.id }, resumeMaterialId: resume.id }), (e) => e.getStatus() === 409 && e.response.code === 'JOB_NOT_PUBLISHED');
    });
    await t.test('a résumé is required and must be readable; nothing is created upstream otherwise', async () => {
      const callsBefore = jdCalls.length;
      await assert.rejects(service.start(identity, { jd: { text: 'Ghost Role' } }), (e) => e.getStatus() === 422 && e.response?.code === 'INVALID_SCHEMA');
      await assert.rejects(service.start(identity, { jd: { text: 'Ghost Role' }, resumeMaterialId: randomUUID() }), (e) => e.getStatus() === 404);
      const empty = (await core.uploadMaterial(identity, { originalname: 'blank.txt', buffer: Buffer.from('   ') })).id;
      await assert.rejects(service.start(identity, { jd: { text: 'Ghost Role' }, resumeMaterialId: empty }), (e) => e.response?.code === 'MATERIAL_NOT_AVAILABLE');
      await assert.rejects(service.start(identity, { jd: { text: 'x', coreJobId: 'y' }, resumeMaterialId: resume.id }), (e) => e.getStatus() === 422 && e.response?.code === 'INVALID_SCHEMA');
      assert.equal(jdCalls.length, callsBefore);
    });
    await t.test('text extraction: DOCX is read, binary junk is reported as unreadable', async () => {
      const JSZip = require('jszip'); const zip = new JSZip();
      zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
      zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>DOCX Engineer</w:t></w:r></w:p></w:body></w:document>');
      assert.deepEqual(await extractText('role.docx', await zip.generateAsync({ type: 'nodebuffer' })), { text: 'DOCX Engineer', errorCode: null });
      assert.equal((await extractText('junk.txt', Buffer.from([0xff, 0xfe, 0x00]))).errorCode, 'FILE_UNREADABLE');
    });
  } finally {
    await db.$disconnect();
    await setupDb.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    await setupDb.$disconnect();
  }
});
