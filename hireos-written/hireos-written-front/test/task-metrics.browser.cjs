const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.WRITTEN_TEST_URL || 'http://127.0.0.1:5198/written/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    let release;
    const barrier = new Promise(resolve => { release = resolve; });
    let fail = false;
    let open = 0;
    await page.route('**/written/api/**', async r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/tasks/stats')) {
        await barrier;
        return r.fulfill(fail ? { status: 500, json: { code: 'TEST_FAILURE' } } : { json: { total: open, byCaseStatus: {}, assignee: { open, reviewsAwaiting: 0, inProgress: 0, dueInRange: null } } });
      }
      if (p.endsWith('/tasks')) return r.fulfill({ json: { items: [], nextCursor: null } });
      return r.fulfill({ json: [] });
    });
    await page.goto(`${base}tasks`, { waitUntil: 'domcontentloaded' });
    const metrics = page.getByTestId('primary-metrics');
    await metrics.getByText('Loading…', { exact: true }).first().waitFor();
    assert.equal(await metrics.getByText('Loading…', { exact: true }).count(), 4);
    assert.equal(await metrics.getByText('0', { exact: true }).count(), 0);
    release();
    await page.waitForFunction(() => document.querySelector('[data-testid="primary-metrics"]')?.getAttribute('aria-busy') === 'false');
    assert.deepEqual(await metrics.locator('.value').allTextContents(), ['0', '0', 'Unavailable', '0']);
    await page.getByText('Statistics snapshot time is not available.', { exact: true }).waitFor();
    fail = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('alert').filter({ hasText: 'Statistics unavailable.' }).waitFor();
    assert.deepEqual(await metrics.locator('.value').allTextContents(), Array(4).fill('Unavailable'));
    fail = false;
    open = 7;
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await metrics.getByText('7', { exact: true }).waitFor();
    assert.deepEqual(await metrics.locator('.value').allTextContents(), ['7', '0', 'Unavailable', '0']);
    assert.deepEqual(errors, []);
    console.log('PASS #410 aggregate loading, true zero, unknown due count, failure and retry; no page-count fallback');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
