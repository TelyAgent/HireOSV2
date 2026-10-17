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
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/written/api/**', route => route.fulfill({ json: route.request().url().endsWith('/questions') ? [{
      id: 'question', code: 'Q-TEST', title: 'Usage test', prompt: 'Describe a recovery plan.', type: 'Written', roles: ['Engineer'], competencies: [{ name: 'Recovery', fraction: 1 }], difficulty: 'Medium', estMinutes: 30, language: 'English', version: 2, status: 'published', author: null, deliverables: [], favorite: false,
    }] : [] }));
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`${base}questions/question`);
      await page.getByText(/Usage: Unknown/).waitFor();
      await page.getByRole('button', { name: 'Usage', exact: true }).click();
      for (const label of ['Used in cases', 'Candidates who have seen this version']) {
        const metric = page.locator('.metric').filter({ has: page.getByText(label, { exact: true }) });
        assert.equal(await metric.locator('.value').textContent(), 'Unknown');
      }
      await page.getByRole('status').filter({ hasText: 'External usage records have not been retrieved.' }).waitFor();
      assert.equal(await page.locator('.metric').filter({ hasText: 'Role mappings' }).locator('.value').textContent(), '1');
      console.log(`PASS #367 AC-1 real bank mapping + detail/header unknown, role count intact, width ${width}`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
