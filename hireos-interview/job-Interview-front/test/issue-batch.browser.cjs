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
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
