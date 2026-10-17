// #198 #209 -- browser acceptance against a running dev server:
//   EXE=<chromium> node test/workspace-flow.cjs <job workspace url>
// Filters survive refresh and Back, while scroll is restored only by Back;
// empty results expose the active conditions and a clear action. Compare
// still needs two ticked candidates.
const { chromium } = require(process.cwd() + '/node_modules/playwright-core');
const assert = require('node:assert/strict');
(async () => {
  const base = process.argv[2];
  if (!base) throw new Error('Usage: node test/workspace-flow.cjs <job workspace url>');
  const b = await chromium.launch({ executablePath: process.env.EXE });
  const page = await b.newPage({ viewport: { width: 1280, height: 420 } });
  const rows = () => page.$$eval('.linked-candidates-table tbody tr.clickable', (trs) => trs.length);
  await page.goto(`${base}?status=awaiting`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  const before = { url: page.url().split('?')[1], rows: await rows(), statusSelect: await page.$eval('.workspace-filters select', (s) => s.value) };
  assert.equal(before.statusSelect, 'awaiting');
  assert.match(before.url, /(?:^|&)status=awaiting(?:&|$)/);
  await page.evaluate(() => document.querySelector('main.main').scrollTo(0, 300));
  await page.waitForTimeout(200);
  const scrolled = await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop));
  assert.ok(scrolled > 0, `expected the workspace to scroll, got ${scrolled}`);

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  const afterRefresh = {
    url: page.url().split('?')[1],
    rows: await rows(),
    statusSelect: await page.$eval('.workspace-filters select', (s) => s.value),
    scrollTop: await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop)),
  };
  assert.equal(afterRefresh.statusSelect, 'awaiting');
  assert.equal(afterRefresh.rows, before.rows);
  assert.equal(afterRefresh.url, before.url);
  assert.ok(afterRefresh.scrollTop <= 1, `refresh should start at the top, got ${afterRefresh.scrollTop}`);
  console.log('PASS: #198 refresh keeps filters and starts at top', JSON.stringify({ before, scrolled, afterRefresh }));

  await page.evaluate(() => document.querySelector('main.main').scrollTo(0, 300));
  await page.waitForTimeout(200);
  const beforeBack = await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop));
  assert.ok(beforeBack > 0, `expected a scroll position before Back, got ${beforeBack}`);
  await page.click('.linked-candidates-table tbody tr.clickable td:nth-child(3)');
  await page.waitForURL(/\/applications\//);
  await page.waitForTimeout(800);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  await page.waitForTimeout(500);
  const after = { url: page.url().split('?')[1], rows: await rows(), statusSelect: await page.$eval('.workspace-filters select', (s) => s.value), scrollTop: await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop)) };
  assert.equal(after.url, before.url);
  assert.equal(after.rows, before.rows);
  assert.equal(after.statusSelect, 'awaiting');
  assert.ok(after.scrollTop >= beforeBack - 2, `Back should restore scroll ${beforeBack}, got ${after.scrollTop}`);
  console.log('filter+scroll', JSON.stringify({ before, scrolled, after }));

  await page.goto(`${base}?status=decided&source=__missing_source__`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody', { state: 'attached' });
  assert.equal(await rows(), 0);
  await page.getByRole('button', { name: 'Clear filters' }).waitFor();
  assert.match(await page.locator('.linked-candidates-table').textContent(), /No linked candidates match this filter/);
  console.log('PASS: #198 empty results explain the active filter and expose Clear filters');
  // Selection
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  const btn = () => page.$eval('.candidate-list-header .actions button', (x) => ({ text: x.textContent.trim(), disabled: x.disabled }));
  const s0 = await btn();
  const boxes = await page.$$('.linked-candidates-table tbody input[type=checkbox]');
  await boxes[0].check();
  const s1 = await btn();
  await boxes[1].check();
  const s2 = await btn();
  const urlUnchanged = !page.url().includes('/applications/');
  assert.equal(s0.disabled, true);
  assert.equal(s1.disabled, true);
  assert.equal(s2.disabled, false);
  assert.equal(urlUnchanged, true);
  console.log('selection', JSON.stringify({ s0, s1, s2, stayedOnPage: urlUnchanged }));
  await b.close();
})();
