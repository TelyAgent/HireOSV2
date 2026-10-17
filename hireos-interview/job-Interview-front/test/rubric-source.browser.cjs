const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:8080/interview/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    const job = { id: 'j', title: 'Synthetic source review', jdText: 'New JD: build reporting APIs.', jdVersion: 2 };
    const task = { id: 'task', jobId: 'j', job, candidate: { id: 'candidate', name: 'Synthetic candidate' }, status: 'planning', rounds: [], parseJobs: [], materials: [], resume: null, stages: ['overview', 'rubric', 'plan', 'schedule', 'brief', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: true })) };
    const card = { id: 'c1', requirement: 'Build payment APIs', responsibilityType: 'lead', cardPriority: 'P0', competencyTags: 'API', expectedEvidence: 'Project example', levelAnchors: { l1: '1', l2: '2', l3: '3', l4: '4', l5: '5' }, weight: 100, sourceRefs: [], source: { status: 'verified', jdVersion: 1, parseJobId: 'p1', refs: [{ segmentId: 's2', quote: 'Build reliable APIs for payments.' }] } };
    const rubric = { id: 'r1', jobId: 'j', version: 1, versionNumber: 1, status: 'draft', cards: [card] };
    let writes = 0;
    const exports = [];
    let failExport = false;
    let exportKey;
    await page.route('**/interview/api/**', r => {
      if (r.request().method() !== 'GET') writes++;
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/rubric/exports') && r.request().method() === 'POST') {
        const body = r.request().postDataJSON();
        if (exportKey) assert.equal(body.requestId, exportKey);
        exportKey = body.requestId;
        if (failExport) return r.fulfill({ status: 503, json: { code: 'UNAVAILABLE' } });
        const record = { id: 'export-1', actorId: 'export-author', versionNumber: 1, revision: 1, rubricStatus: 'draft', status: 'succeeded', createdAt: '2026-10-17T00:00:00Z' };
        exports.push(record); return r.fulfill({ json: record });
      }
      if (p.endsWith('/rubric/exports')) return r.fulfill({ json: exports });
      if (p.endsWith('/exports/export-1/pdf')) return r.fulfill({ contentType: 'application/pdf', body: Buffer.from('%PDF-1.4\nSynthetic browser transport fixture') });
      if (p.endsWith('/tasks/task')) return r.fulfill({ json: task });
      if (p.endsWith('/rubric')) return r.fulfill({ json: { jobId: 'j', jdVersion: 2, locked: false, generation: null, rubric } });
      if (p.endsWith('/rubric-claims')) return r.fulfill({ json: { taskId: 'task', rubricVersionId: 'r1', status: 'missing_resume_or_rubric', cards: [] } });
      if (p.endsWith('/rubric-questions')) return r.fulfill({ json: { jobId: 'j', rubricVersionId: 'r1', generation: null, questions: [] } });
      return r.fulfill({ json: [] });
    });
    await page.goto(`${base}project/task/rubric`, { waitUntil: 'domcontentloaded' });
    const source = page.getByTestId('jd-source-c1');
    try { await source.getByText('Build reliable APIs for payments.', { exact: true }).waitFor(); }
    catch (error) { console.error({ errors, body: (await page.locator('body').innerText()).slice(0, 3000) }); throw error; }
    assert.match(await source.innerText(), /snapshot v1/);
    assert.match(await source.innerText(), /Not the current JD version/);
    assert.match(await source.innerText(), /Segment: s2/);
    assert.ok(!(await source.innerText()).includes('reporting APIs'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await source.getByText('Build reliable APIs for payments.', { exact: true }).waitFor();
    await page.screenshot({ path: '../../evidence/2026-10-17-queue50/251-jd-source.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Collapse navigation/i }).click();
    assert.equal(await source.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    card.source = { status: 'not_recorded', jdVersion: null, parseJobId: null, refs: [] };
    card.sourceRefs = [{ segmentId: 'unverified', quote: 'Never display this legacy quote' }];
    await page.reload({ waitUntil: 'domcontentloaded' });
    await source.getByText(/source not recorded/).waitFor();
    assert.ok(!(await source.innerText()).includes('Never display'));
    assert.ok(!(await source.innerText()).includes('snapshot v'));
    assert.equal(writes, 0);
    const exportPanel = page.getByTestId('rubric-exports');
    failExport = true;
    await exportPanel.getByRole('button', { name: 'Export saved version PDF' }).click();
    await exportPanel.getByRole('alert').waitFor();
    failExport = false;
    await exportPanel.getByRole('button', { name: 'Export saved version PDF' }).click();
    await exportPanel.getByText('PDF generation records', { exact: true }).click();
    await exportPanel.getByText('Generated', { exact: true }).waitFor();
    const download = page.waitForEvent('download');
    await exportPanel.getByRole('button', { name: 'Download PDF', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'rubric-v1-r1.pdf');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await exportPanel.getByText('PDF generation records', { exact: true }).click();
    await exportPanel.getByText('Generated', { exact: true }).waitFor();
    assert.match(await exportPanel.innerText(), /export-author/);
    assert.doesNotMatch(await exportPanel.innerText(), /Downloaded|下载成功/);
    assert.equal(await exportPanel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await exportPanel.screenshot({ path: '../../evidence/2026-10-17-queue50/253-export-history.png' });
    assert.deepEqual(errors, []);
    console.log('PASS #251/#253 provenance, PDF generation retry key, download transport, history reload, truthful status and narrow layout');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
