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
    const evaluation = { id: 'e-v1', applicationId: 'a', version: 1, status: 'completed', freshness: 'current', completedAt: '2026-10-17T00:00:00Z', dimensionScores: [], eligibilityResults: [], eligibilityStatus: 'eligible', overall: 75, coverage: 1, confidence: 0.8, evaluationStatus: 'evaluated' };
    let currentEvaluation = evaluation;
    let decision = null;
    const submitted = [];
    const app = { id: 'a', candidateId: 'c', jobId: 'j', cycleId: 'test', status: 'active', screeningStatus: 'review_pending', linkedAt: '2026-10-17T00:00:00Z', linkedBy: 'hr-1', linkReason: 'test', origin: 'sourced' };
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/screening/api/**', async r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/decisions')) {
        submitted.push(r.request().postDataJSON());
        return r.fulfill({ status: 409, json: { code, decision: { id: 'existing', applicationId: 'a', outcome: 'hold', reason: 'Existing evidence', decidedBy: 'other-reviewer', decidedAt: '2026-10-17T00:00:00Z' } } });
      }
      if (p.endsWith('/a/screening')) return r.fulfill({ json: { application: app, evaluation: currentEvaluation, decision, concerns: [], verificationItems: [], humanAssessments: [] } });
      if (p.endsWith('/candidates/c')) return r.fulfill({ json: { candidate: { id: 'c', displayName: 'Synthetic Candidate', tags: [] }, resumeVersions: [], applications: [app], recommendations: [] } });
      if (p.endsWith('/jobs/j')) return r.fulfill({ json: { id: 'j', title: 'Synthetic Job', criteriaStatus: 'confirmed', workflowPolicy: { assessmentDisposition: 'not_required' } } });
      return r.fulfill({ json: [] });
    });
    for (const mode of ['DECISION_CONFLICT', 'CURRENT_EVALUATION_REQUIRED', 'EVALUATION_VERSION_CONFLICT']) {
      code = mode;
      await page.goto(`${base}applications/a/decision`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByRole('button', { name: 'Hold', exact: true }).click();
      await page.locator('textarea').fill('My unsent conclusion');
      await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Submit decision', exact: true }).click();
      const alert = page.getByRole('alert').filter({ hasText: mode === 'DECISION_CONFLICT' ? 'Your input was not submitted' : mode === 'EVALUATION_VERSION_CONFLICT' ? 'evaluation changed' : 'current screening evaluation' });
      await alert.waitFor();
      assert.equal(await page.locator('textarea').inputValue(), 'My unsent conclusion');
      assert.equal(await alert.getByRole('link').getAttribute('target'), '_blank');
      if (mode === 'DECISION_CONFLICT') assert.match(await alert.textContent(), /Existing evidence.*other-reviewer/);
      const input = submitted.at(-1);
      assert.equal(input.expectedEvaluationId, 'e-v1');
      assert.equal(input.expectedEvaluationVersion, 1);
      assert.equal(input.expectedDecisionId, null);
    }
    const before = submitted.length;
    for (const unavailable of [null, { ...evaluation, freshness: 'stale' }, { ...evaluation, status: 'running' }]) {
      currentEvaluation = unavailable;
      await page.goto(`${base}applications/a/decision`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.getByRole('button', { name: 'Hold', exact: true }).click();
      await page.locator('textarea').fill('Keep my reason');
      await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'every decision' }).waitFor();
      assert.equal(submitted.length, before);
      assert.equal(await page.locator('textarea').inputValue(), 'Keep my reason');
    }
    currentEvaluation = { ...evaluation, id: 'e-v2', version: 2 };
    await page.getByRole('button', { name: 'Reload evaluation', exact: true }).click();
    await page.getByTestId('evaluation-basis').filter({ hasText: 'e-v2' }).waitFor();
    assert.equal(await page.locator('textarea').inputValue(), 'Keep my reason');
    await page.getByRole('button', { name: 'Submit decision', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit decision', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'evaluation changed' }).waitFor();
    assert.equal(submitted.at(-1).expectedEvaluationVersion, 2);
    decision = { id: 'recorded', applicationId: 'a', outcome: 'hold', reason: 'Saved reason', status: 'approved', decidedBy: 'hr-1', decidedAt: '2026-10-17T01:00:00Z', evaluationId: 'e-v1', evaluationVersion: 1, evaluationCompletedAt: evaluation.completedAt, nextStepTarget: 'record_only' };
    await page.goto(`${base}applications/a/decision`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByTestId('decision-basis').waitFor();
    assert.match(await page.getByTestId('decision-basis').textContent(), /e-v1.*v1/);
    decision = { ...decision, evaluationId: null, evaluationVersion: null, evaluationCompletedAt: null };
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByTestId('decision-basis').waitFor();
    assert.match(await page.getByTestId('decision-basis').textContent(), /Not recorded/);
    await page.screenshot({ path: process.env.SCREENING_SCREENSHOT || '/tmp/screening-decision-basis.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS #216/#215 conflict, version preconditions, all-decision guards, reload, input preservation and saved/historical basis');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
