const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    const job = { id: 'job', title: 'Test engineer', recruitingStatus: 'open', createdAt: '2026-10-01T00:00:00Z' };
    const rows = ['with', 'without'].map(id => ({ id, jobId: job.id, job: { title: job.title }, status: 'draft', candidate: { id, name: `Candidate ${id}` }, rounds: [], createdAt: job.createdAt,
      resume: id === 'with' ? { material: { id: 'material-v2', name: 'resume-v2.txt' } } : null }));
    let failPreview = false;
    await page.route('**/interview/api/jobs', route => route.fulfill({ json: [job] }));
    await page.route('**/interview/api/tasks', route => route.fulfill({ json: rows }));
    await page.route('**/interview/api/tasks/with', route => route.fulfill(failPreview
      ? { status: 503, json: { code: 'REQUEST_FAILED' } }
      : { json: { resume: { material: { id: 'material-v2', name: 'resume-v2.txt', text: 'Version 2: shipped reliable systems.' } } } }));
    await page.goto(base);
    for (const mode of ['Task list', 'Cluster by JD']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      if (mode === 'Cluster by JD') await page.getByRole('button', { name: 'Expand', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'No resume', exact: true }).isDisabled(), true);
      const trigger = page.getByRole('button', { name: 'View résumé', exact: true });
      await trigger.focus();
      await page.keyboard.press('Enter');
      const drawer = page.getByRole('dialog');
      await drawer.getByText('Version 2: shipped reliable systems.', { exact: true }).waitFor();
      assert.match(await drawer.innerText(), /material-v2/);
      assert.equal(new URL(page.url()).pathname, new URL(base).pathname);
      await drawer.getByRole('button', { name: 'Close', exact: true }).click();
      await drawer.waitFor({ state: 'hidden' });
      await trigger.waitFor();
    }
    failPreview = true;
    await page.getByRole('button', { name: 'View résumé', exact: true }).click();
    await page.getByRole('dialog').getByRole('alert').waitFor();
    failPreview = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByText('Version 2: shipped reliable systems.', { exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    console.log('PASS #221/#304: both views, no-resume disabled, linked material preview, keyboard activation, no navigation, retry');
    let creates = 0;
    await page.route('**/interview/api/quick-start', route => { creates++; return route.fulfill({ status: 400, json: { code: 'JD_REQUIRED' } }); });
    await page.getByRole('button', { name: '+ New Interview Project', exact: true }).first().click();
    for (const blank of ['', '   \n  ']) {
      await page.locator('#jdTextInput').fill(blank);
      await page.getByRole('button', { name: 'Create project', exact: true }).click();
      await page.getByRole('alert').getByText('A job description is required before a project can be created.', { exact: true }).waitFor();
      assert.equal(await page.locator('#jdTextInput').getAttribute('aria-invalid'), 'true');
      assert.equal(await page.locator('#jdTextInput').getAttribute('aria-describedby'), 'jdRequiredError');
      assert.equal(creates, 0);
    }
    await page.locator('#jdTextInput').fill('Platform engineer');
    assert.equal(await page.locator('#jdTextInput').getAttribute('aria-invalid'), null);
    console.log('PASS #227: empty/whitespace JD, linked error, no create request, correction clears error');
    await page.route('**/interview/api/jobs', route => route.fulfill({ json: [job, { ...job, id: 'jd-only', title: 'Unfilled engineer' }] }));
    await page.goto(base);
    await page.getByRole('button', { name: 'Draft (3)', exact: true }).click();
    await page.getByRole('button', { name: 'Task list', exact: true }).click();
    await page.getByText('Draft 3 = 2 candidate tasks + 1 job without candidates.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('table').getByRole('button', { name: /Candidate (with|without)/ }).count(), 2);
    await page.getByRole('button', { name: 'View drafts by JD', exact: true }).click();
    await page.getByRole('table').getByText('Unfilled engineer', { exact: true }).waitFor();
    await page.getByRole('table').getByText('0 candidates', { exact: true }).waitFor();
    console.log('PASS #223: mixed draft count, candidate-task rows, JD-only discoverability');
    let release;
    let pending = new Promise(resolve => { release = resolve; });
    let failHome = false;
    await page.route('**/interview/api/jobs', async route => { await pending; await route.fulfill(failHome ? { status: 503, json: { code: 'REQUEST_FAILED' } } : { json: [] }); });
    await page.route('**/interview/api/tasks', async route => { await pending; await route.fulfill({ json: [] }); });
    await page.goto(base);
    await page.getByRole('table').getByRole('status').waitFor();
    assert.equal(await page.getByText('No projects yet.', { exact: true }).count(), 0);
    assert.ok((await page.getByTestId('home-metric').allTextContents()).every(v => /Loading/.test(v)));
    assert.equal(await page.getByRole('button', { name: 'All projects', exact: true }).count(), 1);
    release();
    await page.getByText('No projects yet.', { exact: true }).waitFor();
    assert.ok((await page.getByTestId('home-metric').allTextContents()).every(v => v === '0'));
    await page.getByRole('button', { name: 'All projects (0)', exact: true }).waitFor();
    failHome = true;
    await page.reload();
    await page.getByRole('table').getByRole('alert').waitFor();
    assert.ok((await page.getByTestId('home-metric').allTextContents()).every(v => v === 'Unavailable'));
    assert.equal(await page.getByText('No projects yet.', { exact: true }).count(), 0);
    failHome = false;
    pending = new Promise(resolve => { release = resolve; });
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('table').getByRole('status').waitFor();
    assert.ok((await page.getByTestId('home-metric').allTextContents()).every(v => /Loading/.test(v)));
    release();
    await page.getByText('No projects yet.', { exact: true }).waitFor();
    console.log('PASS #300: slow requests, no false zero/empty, real zero, failure, slow retry');
    let rubric = { id: 'rubric-1', versionNumber: 1, status: 'confirmed', confirmedBy: 'reviewer-1', confirmedAt: '2026-10-15T12:00:00Z', sourceJdVersion: 2, cards: [] };
    await page.route('**/interview/api/tasks/project', route => route.fulfill({ json: {
      id: 'project', status: 'draft', job: { ...job, jdVersion: 9, jdText: 'Engineer' }, candidate: { id: 'candidate', name: 'Test' },
      stages: ['overview', 'rubric', 'plan', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, done: false, unlocked: true })), rounds: [], materials: [], parseJobs: [], resume: null,
    } }));
    await page.route('**/interview/api/jobs/job/rubric', route => route.fulfill({ json: { jobId: 'job', jdVersion: 9, locked: false, generation: null, rubric } }));
    await page.goto(`${base}project/project/rubric`);
    const confirmation = page.locator('dl[aria-label="Rubric confirmation record"]');
    await confirmation.getByText('reviewer-1', { exact: true }).waitFor();
    await confirmation.getByText('v2', { exact: true }).waitFor();
    assert.doesNotMatch(await confirmation.innerText(), /v9|Not recorded/);
    rubric = { ...rubric, id: 'rubric-2', versionNumber: 2, confirmedBy: 'reviewer-2', confirmedAt: null, sourceJdVersion: null };
    await page.reload();
    await confirmation.getByText('reviewer-2', { exact: true }).waitFor();
    assert.equal(await confirmation.getByText('Not recorded', { exact: true }).count(), 2);
    assert.doesNotMatch(await confirmation.innerText(), /reviewer-1|v2/);
    rubric = { ...rubric, status: 'draft', confirmedBy: null };
    await page.reload();
    await page.getByText('Confirm rubric', { exact: true }).waitFor();
    assert.equal(await confirmation.count(), 0);
    console.log('PASS #254: confirmed source JD, refreshed version, missing metadata, draft hides confirmation');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
