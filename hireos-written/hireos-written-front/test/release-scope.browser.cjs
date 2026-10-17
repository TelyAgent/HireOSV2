const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.WRITTEN_TEST_URL || 'http://127.0.0.1:5198/written/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/written/api/**', r => r.fulfill({ json: [] }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => performance.getEntriesByType('resource').some(r => r.name.includes('/react-dom_client.js')));
    await page.evaluate(async () => {
      const resource = name => performance.getEntriesByType('resource').find(r => r.name.includes(`/deps/${name}.js`)).name;
      const reactModule = await import(resource('react'));
      const React = reactModule.default ?? reactModule;
      const dom = await import(resource('react-dom_client'));
      const { createRoot } = dom.default ?? dom;
      const { MemoryRouter } = await import(resource('react-router-dom'));
      const { App } = await import(resource('antd'));
      const { StoreProvider } = await import('/written/src/store/StoreContext.tsx');
      const { ReleaseContent } = await import('/written/src/pages/ReleasePage.tsx');
      const f = await import(performance.getEntriesByType('resource').filter(r => r.name.includes('/src/data/fixtures.ts')).at(-1).name);
      for (const id of ['a', 'b']) {
        f.CASES[id] = { id, candidateId: id, status: 'finalized' };
        f.CORE_CANDIDATES[id] = { id, name: `Synthetic ${id}` };
        f.RESULTS[`result_${id}`] = { id: `result_${id}`, caseId: id, evaluationId: `eval_${id}`, overall: 80, status: 'final_not_released', releaseId: null, invitationId: id };
        f.EVALUATIONS[`eval_${id}`] = { id: `eval_${id}`, attemptId: id, status: 'final', finalizedBy: null, finalizedAt: '2026-10-17T00:00:00Z', summary: `Summary for ${id}`, criteria: [] };
      }
      const host = document.createElement('div');
      host.id = 'release-harness';
      document.body.replaceChildren(host);
      const root = createRoot(host);
      window.renderRelease = (id, invitationId = id) => root.render(React.createElement(App, null, React.createElement(StoreProvider, null, React.createElement(MemoryRouter, null, React.createElement(ReleaseContent, { caseId: id, invitationId })))));
      window.releaseFixtures = f;
      window.renderRelease('a');
    });
    const form = page.locator('#release-harness');
    await form.locator('textarea').fill('Private draft for a only');
    await form.getByRole('checkbox').nth(0).check();
    await form.getByRole('checkbox').nth(1).check();
    await page.evaluate(() => window.renderRelease('b'));
    await page.waitForFunction(() => document.querySelector('#release-harness textarea')?.value === 'Summary for b');
    assert.equal(await form.locator('textarea').inputValue(), 'Summary for b');
    assert.equal(await form.getByRole('checkbox').nth(0).isChecked(), false);
    assert.equal(await form.getByRole('checkbox').nth(1).isChecked(), false);
    await form.locator('textarea').fill('Draft b old version');
    await page.evaluate(() => {
      window.releaseFixtures.EVALUATIONS.eval_b.finalizedAt = '2026-10-17T01:00:00Z';
      window.releaseFixtures.EVALUATIONS.eval_b.summary = 'Updated summary b';
      window.renderRelease('b');
    });
    await page.waitForFunction(() => document.querySelector('#release-harness textarea')?.value === 'Updated summary b');
    await page.evaluate(() => window.renderRelease('a', 'b'));
    await form.getByText('No finalized result for this case yet.').waitFor();
    assert.equal(await form.locator('textarea').count(), 0);
    console.log('PASS #398 case/round/evaluation scope resets draft and approvals; mismatched case cannot render a release');
    await page.evaluate(() => {
      const f = window.releaseFixtures;
      f.CASES.a.status = 'closed';
      f.CASES.a.closeReason = 'passed';
      f.RESULTS.result_a.releaseId = 'rel_a';
      f.RESULTS.result_a.overall = 5;
      f.RELEASES.rel_a = { id: 'rel_a', caseId: 'a', overall: 5, showScore: true, outcomeText: 'Below requirements', feedbackText: 'Specific evidence', nextStepText: 'HR follow-up', publishedAt: '2026-10-17T00:00:00Z' };
      window.renderRelease('a');
    });
    await form.getByText('Manual closure decision; the published assessment is unchanged.').waitFor();
    assert.match(await form.innerText(), /Assessment outcome: Not recorded/);
    assert.match(await form.innerText(), /Decision by: Not recorded/);
    assert.match(await form.innerText(), /Decision reason: Not recorded/);
    let closeBody;
    await page.route('**/written/api/cases/a/close', async r => {
      closeBody = r.request().postDataJSON();
      await r.fulfill({ json: { status: 'closed', closeReason: 'passed', closedAt: '2026-10-17T02:00:00Z', closeDecision: { actorId: 'reviewer-test', decidedAt: '2026-10-17T02:00:00Z', reason: closeBody.decisionReason, assessmentOutcome: 'not_met', overridesAssessment: true, invitationId: 'a', submissionId: 'sub_a' } } });
    });
    await page.evaluate(() => {
      const f = window.releaseFixtures;
      f.CASES.a.status = 'released';
      f.RELEASES.rel_a.assessmentOutcome = 'not_met';
      window.renderRelease('a');
    });
    await form.getByRole('button', { name: 'Passed', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByText('The assessment is unmet or unknown. A decision reason is required to choose Passed.').waitFor();
    assert.equal(await modal.getByRole('button', { name: 'Confirm', exact: true }).isEnabled(), false);
    await modal.locator('textarea').fill('Reviewed additional work sample');
    await modal.getByRole('button', { name: 'Confirm', exact: true }).click();
    await form.getByText('Manual override of assessment outcome').waitFor();
    assert.deepEqual(closeBody, { reason: 'passed', decisionReason: 'Reviewed additional work sample' });
    assert.match(await form.innerText(), /Decision by: reviewer-test/);
    assert.match(await form.innerText(), /Reviewed additional work sample/);
    assert.match(await form.innerText(), /Below requirements/);
    await modal.waitFor({ state: 'hidden' });
    await page.screenshot({ path: '../../evidence/2026-10-17-queue50/written-close-audit.png', fullPage: true });
    for (const sample of [
      { outcome: 'met', closeReason: 'passed', score: 80, label: 'Meets requirements', reasonLabel: 'Passed' },
      { outcome: 'not_met', closeReason: 'rejected', score: 5, label: 'Does not meet requirements', reasonLabel: 'Not passed' },
    ]) {
      await page.evaluate(sample => {
        const f = window.releaseFixtures;
        f.CASES.a.closeReason = sample.closeReason;
        f.CASES.a.closeDecision = { actorId: 'reviewer-test', decidedAt: '2026-10-17T02:00:00Z', reason: 'Reviewed evidence', assessmentOutcome: sample.outcome, overridesAssessment: false };
        f.RESULTS.result_a.overall = sample.score;
        f.RELEASES.rel_a.overall = sample.score;
        f.RELEASES.rel_a.assessmentOutcome = sample.outcome;
        f.RELEASES.rel_a.outcomeText = sample.label;
        window.renderRelease('a');
      }, sample);
      await form.getByText(`Assessment outcome: ${sample.label}`, { exact: true }).waitFor();
      assert.match(await form.innerText(), new RegExp(`Reason: ${sample.reasonLabel}`));
      assert.equal(await form.getByText('Manual override of assessment outcome', { exact: true }).count(), 0);
      assert.match(await form.innerText(), /Decision by: reviewer-test/);
      assert.match(await form.innerText(), /Decision reason: Reviewed evidence/);
    }
    console.log('PASS #397/#399 historical unknown, required override reason and persisted response display (mock API, DB tested separately)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
