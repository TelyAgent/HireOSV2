const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [], downloads = [];
    let failHistory = false;
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    page.on('pageerror', e => errors.push(e.message));
    const state = { candidateName: 'Test candidate', jobTitle: 'Engineer', packageId: 'project', packageVersion: 2, rubricVersion: 3, generatedAt: '2026-10-17T00:00:00Z', published: true, evidence: [], hrConfirmedAt: '2026-10-16T00:00:00Z', hmConfirmedAt: '2026-10-16T00:00:00Z', decision: 'recommend_offer', offerState: 'none', needsReview: false };
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/interview/api/**', route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      if (path.endsWith('/package.pdf')) { downloads.push(url.searchParams.get('version')); return route.fulfill({ body: '%PDF-1.4 fixture', contentType: 'application/pdf' }); }
      let json = [];
      if (path.endsWith('/tasks/project')) json = { id: 'project', job: { id: 'job', title: 'Engineer' }, candidate: { id: 'c', name: 'Test candidate' }, rounds: [], materials: [], parseJobs: [], resume: null, stages: ['overview', 'rubric', 'plan', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: true })) };
      if (path.endsWith('/package')) json = state;
      if (path.endsWith('/package/versions')) json = [{ version: 2, createdAt: state.generatedAt }, { version: 1, createdAt: '2026-10-15T00:00:00Z' }];
      if (path.endsWith('/versions/1')) {
        if (failHistory) return route.fulfill({ status: 503, json: { message: 'History unavailable' } });
        json = { ...state, packageVersion: 1, historical: true, generatedAt: '2026-10-15T00:00:00Z', decision: 'hold' };
      }
      return route.fulfill({ json });
    });
    await page.goto(`${base}project/project/package`, { waitUntil: 'domcontentloaded' });
    const select = page.getByRole('combobox', { name: 'Package version' });
    await select.locator('option[value="1"]').waitFor({ state: 'attached' });
    await page.getByText(/Package project.*Version 2.*Rubric v3/).waitFor();
    await select.selectOption('1');
    await page.getByRole('status').filter({ hasText: 'Historical snapshot (read-only)' }).waitFor();
    await page.getByText('Hold', { exact: true }).waitFor();
    for (const button of await page.getByRole('button', { name: 'Unconfirm', exact: true }).all()) assert.equal(await button.isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Send to Offer', exact: true }).count(), 0);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export PDF/ }).click();
    assert.equal((await download).suggestedFilename(), 'evaluation-package-project-v1.pdf');
    assert.deepEqual(downloads, ['1']);
    await select.selectOption('current');
    await page.getByText('Recommend for offer', { exact: true }).waitFor();
    await page.reload();
    await select.locator('option[value="1"]').waitFor({ state: 'attached' });
    await select.selectOption('1');
    await page.getByText(/Package project.*Version 1.*Rubric v3/).waitFor();
    await select.selectOption('current');
    await page.getByText('Recommend for offer', { exact: true }).waitFor();
    failHistory = true;
    await select.selectOption('1');
    await page.getByRole('button', { name: 'Back to current content' }).click();
    await page.getByText('Recommend for offer', { exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS #317 current/history, readonly actions, original version PDF, history after reload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
