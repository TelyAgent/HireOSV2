// #203 -- layout acceptance against a running dev server:
//   EXE=<chromium> node test/linked-table-layout.cjs <workspace url> <screenshot.png> [width] [height]
// Fails when the table scrolls sideways, core cells are hidden, long names
// widen the table, or the Open action is outside the viewport.
const { chromium } = require(process.cwd() + '/node_modules/playwright-core');
const assert = require('node:assert/strict');
(async () => {
  const [, , url, out, width = '1024', height = '768', lang = 'zh', zoom = '1'] = process.argv;
  const b = await chromium.launch({ executablePath: process.env.EXE });
  const page = await b.newPage({ viewport: { width: +width, height: +height }, deviceScaleFactor: 1 });
  await page.addInitScript((l) => { try { localStorage.setItem('hireos_screening_lang', l); } catch {} }, lang);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr', { timeout: 15000 });
  if (zoom !== '1') await page.evaluate((z) => { document.documentElement.style.zoom = z; }, zoom);
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const table = document.querySelector('.linked-candidates-table');
    const card = table.closest('.card');
    const open = [...table.querySelectorAll('tbody tr td:last-child a')].map((a) => a.getBoundingClientRect());
    const r = table.getBoundingClientRect();
    return { viewport: innerWidth, docScroll: document.documentElement.scrollWidth, tableLeft: Math.round(r.left), tableRight: Math.round(r.right),
      cardScroll: card.scrollWidth > card.clientWidth, openVisible: open.every((o) => o.right <= innerWidth && o.left >= 0), openRight: open.map((o) => Math.round(o.right)) };
  });
  if (zoom === '1') {
    assert.equal(m.cardScroll, false, `table card scrolls horizontally: ${JSON.stringify(m)}`);
    assert.equal(m.openVisible, true, `Open action is outside the viewport: ${JSON.stringify(m)}`);
  }
  assert.ok(m.openRight.length > 0, 'expected at least one linked candidate');
  assert.ok(await page.locator('.linked-candidates-table .table-head-filter').isVisible(), 'eligibility filter must remain visible');
  assert.ok(await page.locator('.linked-candidates-table tbody .badge').count() > 0, 'human-readable status must remain present');

  const longName = await page.evaluate(() => {
    const name = document.querySelector('.linked-candidates-table .candidate-name');
    if (!name) return null;
    name.textContent = 'LongCandidateName'.repeat(20);
    const table = document.querySelector('.linked-candidates-table');
    const card = table.closest('.card');
    const open = [...table.querySelectorAll('tbody tr.clickable td:last-child a')].map((a) => a.getBoundingClientRect());
    return { cardScroll: card.scrollWidth > card.clientWidth, openVisible: open.every((o) => o.right <= innerWidth && o.left >= 0) };
  });
  assert.ok(longName, 'expected a candidate name for the long-text check');
  if (zoom === '1') {
    assert.equal(longName.cardScroll, false, 'a long candidate name must not widen the table');
    assert.equal(longName.openVisible, true, 'Open action must remain visible with a long name');
  }

  if (zoom !== '1') {
    await page.evaluate(() => {
      const card = document.querySelector('.linked-candidates-table')?.closest('.card');
      if (card) card.scrollLeft = card.scrollWidth;
    });
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.linked-candidates-table tbody tr.clickable td:last-child a').first().isVisible(), true, 'Open action must remain usable after zoomed scrolling');
  }
  const firstOpen = page.locator('.linked-candidates-table tbody tr.clickable td:last-child a').first();
  await firstOpen.click();
  await page.waitForURL(/\/applications\//);
  assert.match(page.url(), /\/applications\//);
  await page.goBack({ waitUntil: 'networkidle' });
  console.log(JSON.stringify(m));
  await page.screenshot({ path: out });
  await b.close();
})();
