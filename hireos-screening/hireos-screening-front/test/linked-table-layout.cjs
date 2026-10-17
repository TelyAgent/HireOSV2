// #203 -- layout check for the linked-candidates table, run by hand against a dev server (not in CI, like smoke.test.mjs):
//   EXE=<chromium> node test/linked-table-layout.cjs <workspace url> <screenshot.png> [width] [height]
// prints whether the page scrolls sideways and whether every row's Open link is inside the viewport.
const { chromium } = require(process.cwd() + '/node_modules/playwright-core');
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
  console.log(JSON.stringify(m));
  await page.screenshot({ path: out });
  await b.close();
})();
