const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const base = process.env.WRITTEN_TEST_URL || 'http://localhost:8080/written/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let q;
    const versions = [];
    const deprecations = [];
    let failPublish = false;
    let failVersions = false;
    let edits = 0;
    await page.route('**/fonts.googleapis.com/**', route => route.abort());
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/written/api/**', async route => {
      const request = route.request();
      const url = new URL(request.url()).pathname;
      const method = request.method();
      if (url.endsWith('/ai/extract-competencies')) return route.fulfill({ json: { competencies: [{ name: 'Design', fraction: 1 }] } });
      if (url.endsWith('/questions') && method === 'POST') {
        q = { ...request.postDataJSON(), id: 'version-browser', code: 'Q-0099', type: 'Written', difficulty: 'Medium', estMinutes: 30, version: 0, revision: 1, status: 'draft_review', deliverables: [], favorite: false };
        return route.fulfill({ json: q });
      }
      if (url.endsWith('/versions')) return route.fulfill(failVersions ? { status: 503, json: { message: 'Unavailable' } } : { json: versions });
      if (url.endsWith('/deprecations')) return route.fulfill({ json: deprecations });
      if (url.endsWith('/deprecate')) {
        assert.equal(request.postDataJSON().expectedRevision, q.revision);
        deprecations.push({ id: 'deprecation-2', version: q.version, actorId: 'test-maintainer', createdAt: '2026-10-17T09:00:00Z' });
        q = { ...q, status: 'deprecated' };
        return route.fulfill({ json: { question: q, replayed: false } });
      }
      if (url.endsWith('/publish')) {
        assert.equal(request.postDataJSON().expectedRevision, q.revision);
        if (failPublish) return route.fulfill({ status: 503, json: { message: 'Synthetic publish unavailable' } });
        q = { ...q, version: q.version + 1, status: 'published' };
        versions.unshift({ id: `v${q.version}`, version: q.version, content: structuredClone(q), historicalBaseline: false, publishedBy: 'test-author', publishedAt: '2026-10-17T08:00:00Z' });
        return route.fulfill({ json: { question: q, replayed: false } });
      }
      if (url.endsWith('/questions/version-browser') && method === 'PATCH') {
        assert.equal(request.postDataJSON().expectedRevision, q.revision);
        q = { ...q, ...request.postDataJSON(), revision: q.revision + 1, status: 'draft_review' };
        edits++;
        return route.fulfill({ json: q });
      }
      return route.fulfill({ json: url.endsWith('/questions') ? (q ? [q] : []) : [] });
    });
    await page.goto(`${base}question-bank`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Create question', exact: true }).click();
    const drawer = page.locator('.ant-drawer-content');
    await drawer.locator('input').first().fill('Browser version test');
    await drawer.locator('textarea').fill('Original published prompt');
    await drawer.getByRole('button', { name: 'Save draft', exact: true }).click();
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(q.status, 'draft_review');
    await page.goto(`${base}questions/version-browser`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Draft · Not published', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    await page.getByText('No published versions yet.').waitFor();
    async function publish() {
      await page.getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
      await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await publish();
    await page.getByRole('button', { name: 'v1 · Latest published', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit question', exact: true }).click();
    await drawer.locator('textarea').fill('Second published prompt');
    await drawer.getByRole('button', { name: 'Save draft', exact: true }).click();
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(edits, 1);
    assert.equal(versions[0].content.prompt, 'Original published prompt');
    failPublish = true;
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Publish', exact: true }).click();
    await page.getByText('Synthetic publish unavailable', { exact: false }).waitFor();
    await page.locator('.ant-modal .ant-btn-loading').waitFor({ state: 'hidden' });
    assert.equal(q.status, 'draft_review');
    assert.equal(versions.length, 1);
    failPublish = false;
    await page.locator('.ant-modal:visible .ant-modal-footer button').last().click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'v1 · Earlier revision', exact: true }).click();
    assert.match(await page.getByTestId('question-version-content').innerText(), /Original published prompt/);
    assert.doesNotMatch(await page.getByTestId('question-version-content').innerText(), /Second published prompt/);
    failVersions = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    await page.getByText('Could not load versions.', { exact: false }).waitFor();
    failVersions = false;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('button', { name: 'v2 · Latest published', exact: true }).waitFor();
    assert.match(await page.getByTestId('question-version-content').innerText(), /Second published prompt/);
    await page.screenshot({ path: path.resolve('../../evidence/2026-10-17-queue50/365-question-versions.png'), fullPage: true });
    await page.getByRole('button', { name: 'Deprecate question', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm deprecation', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(q.status, 'deprecated');
    await page.getByTestId('question-deprecation').waitFor();
    assert.match(await page.getByTestId('question-deprecation').innerText(), /v2.*test-maintainer/);
    assert.equal(await page.getByRole('button', { name: 'Publish', exact: true }).count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Versions', exact: true }).click();
    await page.getByTestId('question-deprecation').waitFor();
    await page.screenshot({ path: path.resolve('../../evidence/2026-10-17-queue50/368-deprecation.png'), fullPage: true });
    await page.getByRole('button', { name: 'Edit question', exact: true }).click();
    await drawer.locator('textarea').fill('Third published prompt');
    await drawer.getByRole('button', { name: 'Save draft', exact: true }).click();
    await drawer.waitFor({ state: 'hidden' });
    assert.equal(q.status, 'draft_review');
    await publish();
    await page.getByRole('button', { name: 'v3 · Latest published', exact: true }).waitFor();
    await page.getByRole('button', { name: 'v2 · Earlier revision', exact: true }).click();
    await page.getByTestId('question-deprecation').waitFor();
    assert.equal(deprecations.length, 1);
    assert.equal(versions[1].content.prompt, 'Second published prompt');
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await page.getByTestId('question-version-content').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391, JSON.stringify(bounds));
    await page.evaluate(async question => {
      const resource = suffix => performance.getEntriesByType('resource').map(r => r.name).find(name => name.includes(suffix));
      const reactModule = await import(resource('/deps/react.js'));
      const React = reactModule.default ?? reactModule;
      const domModule = await import(resource('/deps/react-dom_client.js'));
      const { createRoot } = domModule.default ?? domModule;
      const { MemoryRouter } = await import(resource('/deps/react-router-dom.js'));
      const { App } = await import(resource('/deps/antd.js'));
      const { StoreProvider } = await import(resource('/src/store/StoreContext.tsx'));
      const { QUESTIONS } = await import(resource('/src/data/fixtures.ts'));
      const { toBankQuestion } = await import(resource('/src/data/realQuestionsMerge.ts'));
      const { AssessmentQuestionDrawer } = await import('/written/src/components/AssessmentQuestionDrawer.tsx');
      for (const id of Object.keys(QUESTIONS)) delete QUESTIONS[id];
      for (const status of ['published', 'deprecated', 'draft_review']) {
        QUESTIONS[status] = toBankQuestion({ ...question, id: status, roles: ['Engineer'], status });
      }
      const host = document.createElement('div');
      document.body.replaceChildren(host);
      createRoot(host).render(React.createElement(App, null, React.createElement(MemoryRouter, null,
        React.createElement(StoreProvider, null, React.createElement(AssessmentQuestionDrawer, {
          open: true, caseId: 'synthetic', jobTitle: 'Engineer', onClose() {}, onConfirm(value) { window.selectedPlanQuestion = value; },
        })))));
    }, q);
    const picker = page.locator('.ant-drawer select');
    await picker.waitFor();
    assert.deepEqual(await picker.locator('option').evaluateAll(options => options.map(o => o.value)), ['', 'published']);
    await picker.selectOption('published');
    await page.getByText('Published version v3', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Add to plan', exact: true }).click();
    assert.equal(await page.evaluate(() => window.selectedPlanQuestion.questionId), 'published');
    assert.deepEqual(errors, []);
    console.log('PASS #365/#368 browser: draft, publish/retry, immutable versions, deprecate audit/reload, no direct restore, edit/republish v3, mobile bounds. Synthetic API + separate real DB tests.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
