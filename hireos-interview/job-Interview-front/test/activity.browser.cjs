const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    let mode = 'populated', writes = 0, delayed;
    const records = [{ id: 'r1', actorId: 'actual-actor', createdAt: '2026-10-17T00:00:00Z', event: 'review_recorded' }];
    await page.route('**/interview/api/**', r => {
      if (r.request().method() !== 'GET') writes++;
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/debrief')) return r.fulfill({ json: { totalCards: 0, mustHaveTotal: 0, cards: [] } });
      if (p.endsWith('/tasks/slow/activity')) { delayed = r; return; }
      if (p.endsWith('/tasks/new/activity')) return r.fulfill({ json: [] });
      if (p.endsWith('/activity')) return r.fulfill(mode === 'failed' ? { status: 503, json: {} } : { json: mode === 'empty' ? [] : records });
      if (/\/tasks\/(task|slow|new)$/.test(p)) return r.fulfill({ json: { id: p.split('/').pop(), job: { id: 'job', title: 'Synthetic', jdText: '' }, candidate: { name: 'Synthetic' }, rounds: [], stages: [], materials: [], createdAt: '2026-10-17T00:00:00Z' } });
      return r.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:8080/interview/project/task/overview', { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('recorded-activity');
    await panel.getByText('Review recorded', { exact: true }).waitFor().catch(async e => { console.error(errors, await page.locator('body').innerText()); throw e; });
    assert.match(await panel.innerText(), /actual-actor/);
    mode = 'empty'; await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByText('No recorded activity yet').waitFor();
    mode = 'failed'; await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByRole('alert').waitFor();
    mode = 'populated'; await panel.getByRole('button', { name: 'Retry' }).click();
    await panel.getByText('Review recorded', { exact: true }).waitFor();
    await panel.scrollIntoViewIfNeeded();
    await panel.screenshot({ path: '../../evidence/2026-10-17-queue50/243-activity-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Collapse navigation/i }).click();
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    const bounds = await panel.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await panel.screenshot({ path: '../../evidence/2026-10-17-queue50/243-activity.png' });
    async function navigate(id) {
      await page.evaluate(id => { history.pushState({}, '', `/interview/project/${id}/overview`); window.dispatchEvent(new PopStateEvent('popstate')); }, id);
    }
    await navigate('slow');
    await panel.getByRole('status').waitFor();
    for (let i = 0; !delayed && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(delayed);
    await navigate('new');
    await panel.getByText('No recorded activity yet').waitFor();
    await delayed.fulfill({ json: records });
    await page.waitForTimeout(200);
    assert.doesNotMatch(await panel.innerText(), /actual-actor/);
    assert.equal(writes, 0); assert.deepEqual(errors, []);
    console.log('PASS #243 populated, empty, failure/retry, loading, task-switch stale response, narrow layout, read-only');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
