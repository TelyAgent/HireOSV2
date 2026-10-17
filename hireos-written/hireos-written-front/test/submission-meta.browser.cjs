const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.WRITTEN_TEST_URL || 'http://127.0.0.1:5198/written/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    let writes = 0;
    await page.route('**/written/api/**', r => {
      if (r.request().method() !== 'GET') writes++;
      return r.fulfill({ json: [] });
    });
    await page.goto(`${base}question-bank`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Import ZIP', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText('ZIP import is not available. No files have been uploaded or parsed.').waitFor();
    assert.equal(await dialog.getByRole('button', { name: /Parse/ }).count(), 0);
    await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
    assert.equal(writes, 0);
    await page.evaluate(async () => {
      const resource = name => performance.getEntriesByType('resource').find(r => r.name.includes(`/deps/${name}.js`)).name;
      const reactModule = await import(resource('react'));
      const React = reactModule.default ?? reactModule;
      const dom = await import(resource('react-dom_client'));
      const { createRoot } = dom.default ?? dom;
      const { App } = await import(resource('antd'));
      const { StoreProvider } = await import('/written/src/store/StoreContext.tsx');
      const { RealSubmissionContent } = await import('/written/src/pages/SubmissionDetailPage.tsx');
      const f = await import(performance.getEntriesByType('resource').filter(r => r.name.includes('/src/data/fixtures.ts')).at(-1).name);
      const { applyRealEvaluation } = await import('/written/src/data/realPlanItemsMerge.ts');
      f.CASES.case1 = { id: 'case1', candidateId: 'candidate1' };
      f.CORE_CANDIDATES.candidate1 = { id: 'candidate1', name: 'Synthetic candidate' };
      const submission = { submittedAt: '2026-10-17T00:00:00Z', answers: [], evaluation: null };
      applyRealEvaluation('case1', { id: 'inv1', round: 2, questions: [], submission });
      if (f.ATTEMPTS.att_real_inv1.receivedAt || f.ATTEMPTS.att_real_inv1.processedAt) throw new Error('Fabricated receipt/processing timestamps');
      const host = document.createElement('div');
      host.id = 'submission-harness';
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.renderSubmission = known => root.render(React.createElement(App, null, React.createElement(StoreProvider, null,
        React.createElement(RealSubmissionContent, { questions: [{ questionId: 'q', code: 'Q1', title: 'Synthetic question', prompt: 'Explain' }], answers: [{ questionId: 'q', answerText: 'Synthetic answer' }], submittedAt: submission.submittedAt,
          ...(known ? { caseId: 'case1', invitationId: 'inv1', round: 2 } : {}), onGoToEvaluation() {} }))));
      window.renderSubmission(true);
    });
    const host = page.locator('#submission-harness');
    await host.getByText('Synthetic candidate (candidate1)', { exact: true }).waitFor();
    for (const text of ['case1', 'inv1', 'Online text answers', 'Synthetic answer']) await host.getByText(text, { exact: true }).waitFor();
    assert.equal(await host.getByText('Not recorded', { exact: true }).count(), 2);
    assert.equal(await host.getByRole('button', { name: /Download|Preview/ }).count(), 0);
    await page.evaluate(() => window.renderSubmission(false));
    await page.waitForFunction(() => [...document.querySelectorAll('#submission-harness dd')].filter(n => n.textContent === 'Not recorded').length === 6);
    assert.deepEqual(errors, []);
    console.log('PASS #366 no fake parse or writes; #362 real text binding, missing metadata and no fabricated timestamps/files');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
