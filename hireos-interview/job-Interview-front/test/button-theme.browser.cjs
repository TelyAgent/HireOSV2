const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/interview/api/**', route => route.fulfill({ json: route.request().url().endsWith('/jobs')
      ? [{ id: 'job', title: 'Test engineer', recruitingStatus: 'open', createdAt: '2026-10-01T00:00:00Z' }]
      : route.request().url().endsWith('/materials') ? { id: 'material', name: 'resume.txt', text: 'Test', readStatus: 'available', errorCode: null } : [] }));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Cluster by JD', exact: true }).click();
    for (const [mode, scheme] of [['Light', 'light'], ['Dark', 'dark'], ['Deep', 'dark'], ['System', 'light'], ['System', 'dark']]) {
      for (const accent of ['Blue', 'Teal', 'Violet']) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.getByRole('button', { name: /Appearance/ }).click();
        let dialog = page.getByRole('dialog');
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: mode, exact: true }) }).click();
        await dialog.locator('label').filter({ has: page.getByRole('radio', { name: accent, exact: true }) }).click();
        await dialog.getByRole('button', { name: 'Done', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        await page.getByRole('button', { name: 'Link candidate', exact: true }).click();
        dialog = page.getByRole('dialog');
        await dialog.locator('input[type=file]').setInputFiles({ name: 'resume.txt', mimeType: 'text/plain', buffer: Buffer.from('Test') });
        const confirm = dialog.getByRole('button', { name: 'Link candidate', exact: true });
        await page.waitForFunction(() => !document.querySelector('.ant-modal-footer .ant-btn-primary')?.disabled);
        await page.mouse.move(0, 0);
        await page.waitForFunction(() => {
          const buttons = [...document.querySelectorAll('.ant-modal .ant-btn-primary')];
          const probe = document.createElement('span');
          probe.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--brand');
          document.body.appendChild(probe);
          const expected = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return buttons.length === 2 && buttons.every(button => getComputedStyle(button).backgroundColor === expected);
        });
        assert.equal(await confirm.isDisabled(), false);
        assert.equal(await dialog.getByRole('button', { name: 'Replace resume', exact: true }).isEnabled(), true);
        if (mode === 'Light' && accent === 'Blue') await dialog.screenshot({ path: '/tmp/hireos-link-theme-blue.png', animations: 'disabled' });
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await dialog.waitFor({ state: 'hidden' });
        console.log(`PASS buttons match page accent: ${mode}/${scheme}/${accent}`);
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
