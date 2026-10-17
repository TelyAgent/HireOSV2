const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.SCREENING_TEST_URL || 'http://localhost:8080/screening/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(12000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const job = { id: 'batch-job', title: 'Batch test workspace', status: 'open', criteriaStatus: 'confirmed', criteriaVersion: 1, requirements: [], dimensions: [], workflowPolicy: {} };
    const apps = Array.from({ length: 4 }, (_, n) => ({ id: `a${n}`, candidateId: `c${n}`, candidateName: `Synthetic ${n}`, jobId: job.id, status: 'active', screeningStatus: 'review_pending', linkedAt: '2026-10-17T00:00:00Z', linkedBy: 'emma', origin: 'sourced' }));
    let batch;
    const starts = [];
    let retries = 0;
    let reconciles = 0;
    let readFails = false;
    const recount = () => { batch.counts = Object.fromEntries(['queued', 'running', 'completed', 'failed', 'cancelled', 'unknown'].map(status => [status, batch.items.filter(i => i.status === status).length])); };
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/account/api/**', route => route.fulfill({ status: route.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/screening/api/**', async route => {
      const request = route.request();
      const p = new URL(request.url()).pathname;
      if (p.endsWith('/screening-batches') && request.method() === 'POST') {
        starts.push(request.postDataJSON());
        if (!batch) {
          batch = { id: 'batch-1', jobId: job.id, actorId: 'test', createdAt: '2026-10-17T08:00:00Z', cancelledAt: null,
            items: starts[0].applicationIds.map((id, n) => ({ id: `item-${id}`, applicationId: id, status: ['completed', 'failed', 'unknown', 'queued'][n], attempt: n === 3 ? 0 : 1, evaluationId: n === 0 ? 'ev-1' : null, errorCode: n === 1 ? 'EVALUATION_FAILED' : n === 2 ? 'RESULT_UNKNOWN' : null })) };
          recount();
          return route.abort('connectionreset');
        }
        assert.equal(starts[1].idempotencyKey, starts[0].idempotencyKey);
        assert.deepEqual(starts[1].applicationIds, starts[0].applicationIds);
        return route.fulfill({ json: batch });
      }
      if (p.endsWith('/screening-batches')) return route.fulfill(readFails ? { status: 500, json: { code: 'TEST_READ_FAILURE' } } : { json: batch ? [batch] : [] });
      if (p.endsWith('/retry')) {
        retries++;
        assert.match(p, /item-a1\/retry$/);
        batch.items[1] = { ...batch.items[1], status: 'completed', attempt: 2, errorCode: null, evaluationId: 'ev-2' }; recount();
        return route.fulfill({ json: batch });
      }
      if (p.endsWith('/cancel')) { batch.cancelledAt = new Date().toISOString(); batch.items[3].status = 'cancelled'; recount(); return route.fulfill({ json: batch }); }
      if (p.endsWith('/reconcile')) { reconciles++; return route.fulfill({ json: batch }); }
      if (p.endsWith('/jobs/batch-job')) return route.fulfill({ json: job });
      if (p.endsWith('/jobs')) return route.fulfill({ json: [job] });
      if (p.endsWith('/applications')) return route.fulfill({ json: apps });
      const match = p.match(/\/applications\/(a\d+)\/screening$/);
      if (match) return route.fulfill({ json: { application: apps.find(a => a.id === match[1]), evaluation: null, decision: null, concerns: [], verificationItems: [], humanAssessments: [] } });
      return route.fulfill({ json: [] });
    });
    await page.goto(`${base}jobs/${job.id}/screening`, { waitUntil: 'domcontentloaded' });
    for (const box of await page.locator('.linked-candidates-table tbody input[type=checkbox]').all()) await box.check();
    // Wait for actual rows before selecting; the initial page can still be loading.
    await page.locator('.linked-candidates-table tbody input[type=checkbox]').first().waitFor();
    for (const box of await page.locator('.linked-candidates-table tbody input[type=checkbox]').all()) await box.check();
    const panel = page.getByRole('region', { name: 'Batch screening', exact: true });
    await panel.getByRole('button', { name: 'Screen 4 selected', exact: true }).click();
    await page.getByRole('dialog').getByText('4 fixed candidates').waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm start' }).click();
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.equal(starts.length, 1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByRole('button', { name: 'Resume start request' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm start' }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await panel.getByTestId('batch-item-a1').getByRole('button', { name: 'Retry failed item' }).click();
    await panel.getByTestId('batch-item-a1').getByText('Completed', { exact: true }).waitFor();
    assert.equal(retries, 1);
    assert.equal(await panel.getByTestId('batch-item-a0').getByRole('button').count(), 0);
    await panel.getByRole('button', { name: 'Cancel queued', exact: true }).click();
    await panel.getByTestId('batch-item-a3').getByText('Cancelled', { exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Check unknown results', exact: true }).click();
    await panel.getByTestId('batch-item-a2').getByText('Unknown', { exact: true }).waitFor();
    assert.equal(await panel.getByTestId('batch-item-a2').getByRole('button').count(), 0);
    assert.equal(reconciles, 1);
    readFails = true;
    await panel.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await panel.getByRole('alert').waitFor();
    readFails = false;
    await panel.getByRole('button', { name: 'Refresh status', exact: true }).click();
    await panel.getByRole('alert').waitFor({ state: 'hidden' });
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await panel.scrollIntoViewIfNeeded();
      const bounds = await panel.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, JSON.stringify(bounds));
      await panel.screenshot({ path: path.resolve(`../../evidence/2026-10-17-queue50/425-batch-${width}.png`) });
    }
    assert.deepEqual(errors, []);
    console.log('PASS #425 workspace: fixed selection, lost response + reload same key, failed-only retry, cancellation, unknown no retry, read failure/recovery, desktop/mobile bounds.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
