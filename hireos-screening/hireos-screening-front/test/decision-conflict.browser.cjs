const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.SCREENING_TEST_URL || 'http://127.0.0.1:5199/screening/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let code = 'DECISION_CONFLICT';
    const app = { id: 'a', candidateId: 'c', jobId: 'j', cycleId: 'test', status: 'active', screeningStatus: 'review_pending', linkedAt: '2026-10-17T00:00:00Z', linkedBy: 'hr-1', linkReason: 'test', origin: 'sourced' };
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/screening/api/**', async r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/decisions')) return r.fulfill({ status: 409, json: { code, decision: { id: 'existing', applicationId: 'a', outcome: 'hold', reason: 'Existing evidence', decidedBy: 'other-reviewer', decidedAt: '2026-10-17T00:00:00Z' } } });
      if (p.endsWith('/a/screening')) return r.fulfill({ json: { application: app, evaluation: null, decision: null, concerns: [], verificationItems: [], humanAssessments: [] } });
      if (p.endsWith('/candidates/c')) return r.fulfill({ json: { candidate: { id: 'c', displayName: 'Synthetic Candidate', tags: [] }, resumeVersions: [], applications: [app], recommendations: [] } });
      if (p.endsWith('/jobs/j')) return r.fulfill({ json: { id: 'j', title: 'Synthetic Job', criteriaStatus: 'confirmed', workflowPolicy: { assessmentDisposition: 'not_required' } } });
      return r.fulfill({ json: [] });
    });
    for (const mode of ['DECISION_CONFLICT', 'CURRENT_EVALUATION_REQUIRED']) {
      code = mode;
      await page.goto(`${base}applications/a/decision`);
      await page.getByRole('button', { name: 'Hold', exact: true }).click();
      await page.locator('textarea').fill('My unsent conclusion');
      await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Submit decision', exact: true }).click();
      const alert = page.getByRole('alert').filter({ hasText: mode === 'DECISION_CONFLICT' ? 'Your input was not submitted' : 'current screening evaluation' });
      await alert.waitFor();
      assert.equal(await page.locator('textarea').inputValue(), 'My unsent conclusion');
      assert.equal(await alert.getByRole('link').getAttribute('target'), '_blank');
      if (mode === 'DECISION_CONFLICT') assert.match(await alert.textContent(), /Existing evidence.*other-reviewer/);
    }
    assert.deepEqual(errors, []);
    console.log('PASS #216/#215 conflict/reference, evaluation error and unsent draft preservation');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
