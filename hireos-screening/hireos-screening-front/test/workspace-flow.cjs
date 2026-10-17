// #198 #209 -- run by hand against a dev server (not in CI, like smoke.test.mjs):
//   EXE=<chromium> node test/workspace-flow.cjs <job workspace url>
// filters and the list position survive opening a candidate and going Back; Compare needs two ticked candidates.
const { chromium } = require(process.cwd() + '/node_modules/playwright-core');
(async () => {
  const base = process.argv[2];
  const b = await chromium.launch({ executablePath: process.env.EXE });
  const page = await b.newPage({ viewport: { width: 1280, height: 420 } });
  const rows = () => page.$$eval('.linked-candidates-table tbody tr.clickable', (trs) => trs.length);
  await page.goto(`${base}?status=awaiting`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  const before = { url: page.url().split('?')[1], rows: await rows(), statusSelect: await page.$eval('.workspace-filters select', (s) => s.value) };
  await page.evaluate(() => document.querySelector('main.main').scrollTo(0, 300));
  await page.waitForTimeout(200);
  const scrolled = await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop));
  await page.click('.linked-candidates-table tbody tr.clickable td:nth-child(3)');
  await page.waitForURL(/\/applications\//);
  await page.waitForTimeout(800);
  await page.goBack({ waitUntil: 'networkidle' });
  await page.waitForSelector('.linked-candidates-table tbody tr');
  await page.waitForTimeout(500);
  const after = { url: page.url().split('?')[1], rows: await rows(), statusSelect: await page.$eval('.workspace-filters select', (s) => s.value), scrollTop: await page.evaluate(() => Math.round(document.querySelector('main.main').scrollTop)) };
  console.log('filter+scroll', JSON.stringify({ before, scrolled, after }));
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
  console.log('selection', JSON.stringify({ s0, s1, s2, stayedOnPage: urlUnchanged }));
  await b.close();
})();
