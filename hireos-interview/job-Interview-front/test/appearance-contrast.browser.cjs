const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/interview/api/**', route => route.fulfill({ json: [] }));
    for (const surface of ['modal', 'settings']) {
    await page.goto(surface === 'modal' ? base : `${base}settings/appearance`);
    if (surface === 'modal') await page.getByRole('button', { name: /Appearance/ }).click();
    const dialog = surface === 'modal' ? page.getByRole('dialog') : page.locator('.hs-content');
    for (const [theme, scheme] of [['Light', 'light'], ['Dark', 'light'], ['Deep', 'light'], ['System', 'light'], ['System', 'dark']]) {
      await page.emulateMedia({ colorScheme: scheme });
      await dialog.locator('label').filter({ has: page.getByRole('radio', { name: theme, exact: true }) }).click();
      for (const accent of ['Blue', 'Teal', 'Violet']) {
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: accent, exact: true }) }).click();
        // Wait for the radio background/color transition before measuring final contrast.
        await page.waitForTimeout(300);
        const results = await dialog.locator('.hs-tiny, .hs-label, .appearance-preview-label, .appearance-preview p, .ant-radio-button-wrapper, .ant-btn').evaluateAll(elements => {
          const rgba = value => value.match(/[\d.]+/g).map(Number);
          const blend = (fg, bg) => fg.slice(0, 3).map((v, i) => v * (fg[3] ?? 1) + bg[i] * (1 - (fg[3] ?? 1)));
          const lum = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          return elements.map(el => {
            const chain = [];
            for (let parent = el; parent; parent = parent.parentElement) chain.unshift(parent);
            let bg = [255, 255, 255];
            for (const node of chain) bg = blend(rgba(getComputedStyle(node).backgroundColor), bg);
            const fg = blend(rgba(getComputedStyle(el).color), bg);
            const a = lum(fg), b = lum(bg);
            return { text: el.textContent, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
          });
        });
        for (const result of results) assert.ok(result.ratio >= 4.5, `${theme}/${scheme}/${accent}: ${JSON.stringify(result)}`);
        for (const name of ['Light', 'Dark', 'Deep', 'System', 'Blue', 'Teal', 'Violet', 'Small', 'Medium', 'Large']) assert.equal(await dialog.getByRole('radio', { name, exact: true }).count(), 1);
        const selected = dialog.locator('.ant-radio-button-wrapper-checked');
        assert.equal(await selected.count(), 3);
        for (const label of await selected.all()) assert.ok((await label.evaluate(el => getComputedStyle(el).textDecorationLine)).includes('underline'));
        const radio = dialog.getByRole('radio', { name: theme, exact: true });
        await radio.focus();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Shift+Tab');
        const focus = await page.evaluate(() => {
          const wrapper = document.activeElement.closest('.ant-radio-button-wrapper');
          return wrapper && { style: getComputedStyle(wrapper).outlineStyle, width: getComputedStyle(wrapper).outlineWidth };
        });
        assert.ok(focus && focus.style !== 'none' && parseFloat(focus.width) >= 2);
        console.log(`PASS #291 ${surface}/${theme}/${scheme}/${accent}: min contrast ${Math.min(...results.map(r => r.ratio)).toFixed(2)}; names, selection, keyboard focus`);
      }
    }
    await dialog.screenshot({ path: `/tmp/hireos-291-${surface}.png` });
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
