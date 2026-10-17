const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.JD_TEST_URL || 'http://127.0.0.1:5198/jd/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    const job = { id: 'job', workspaceId: 'ws', title: 'Platform engineer', status: 'open', openings: 1, version: 1, createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
    await page.route('**/jd/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/jobs')) return route.fulfill({ json: [job] });
      if (path.endsWith('/jobs/job')) return route.fulfill({ json: job });
      if (path.endsWith('/versions')) return route.fulfill({ json: { jdCode: 'JD-TEST', versions: [] } });
      if (path.includes('/documents/')) return route.fulfill({ json: { jobId: 'job', audience: 'internal', blocks: [], meta: null, revision: 1, updatedAt: job.updatedAt } });
      if (path.endsWith('/drafts/current')) return route.fulfill({ json: { roleSummary: '', responsibilities: [], requirements: [], sourceRefs: [] } });
      return route.fulfill({ status: 404, json: { code: 'NOT_FOUND' } });
    });
    await page.goto(`${base}jobs/job/document`);
    const recruitment = page.getByRole('group', { name: 'Recruiting status', exact: true });
    const publication = page.getByRole('group', { name: 'JD publication', exact: true });
    await publication.getByText('Not published', { exact: true }).waitFor();
    assert.match(await recruitment.innerText(), /Published/);
    for (const zoom of [1, 2]) {
      await page.evaluate(zoom => { document.documentElement.style.zoom = String(zoom); }, zoom);
      const a = await recruitment.boundingBox();
      const b = await publication.boundingBox();
      const action = await page.getByRole('button', { name: 'Publish', exact: true }).boundingBox();
      assert.ok(a && b && action);
      const overlaps = (x, y) => x.x < y.x + y.width && y.x < x.x + x.width && x.y < y.y + y.height && y.y < x.y + x.height;
      assert.equal(overlaps(a, b), false);
      assert.equal(overlaps(a, action) || overlaps(b, action), false);
    }
    assert.deepEqual(errors, []);
    console.log('PASS #92 AC-1/AC-3: real workspace header, independent status labels, 100% and 200% CSS zoom, no action overlap');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
