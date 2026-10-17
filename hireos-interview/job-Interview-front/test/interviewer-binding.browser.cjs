const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let admin = true, fail = true, writes = 0;
    const members = [
      { id: 'admin', email: 'admin@example.com', displayName: 'Admin', roles: ['admin'], status: 'active', membershipStatus: 'active' },
      { id: 'member', email: 'member@example.com', displayName: 'Member', roles: ['interviewer'], status: 'active', membershipStatus: 'active' },
      { id: 'disabled', email: 'disabled@example.com', displayName: 'Disabled', roles: ['hr'], status: 'disabled', membershipStatus: 'active' },
      { id: 'invited', email: 'invited@example.com', displayName: 'Invited', roles: ['hr'], status: 'active', membershipStatus: 'invited' },
    ];
    const rows = [{ id: 'directory', name: 'Directory Person', accountBinding: null }];
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => {
      const path = new URL(r.request().url()).pathname;
      if (path.endsWith('/me')) return r.fulfill({ json: { user: { ...members[0], locale: 'zh', localeChosen: true }, roles: admin ? ['admin'] : ['hr'] } });
      if (path.endsWith('/users')) return r.fulfill({ status: admin ? 200 : 403, json: admin ? members : {} });
      return r.fulfill({ json: { loginRequired: false } });
    });
    await page.route('**/interview/api/**', r => {
      const path = new URL(r.request().url()).pathname;
      if (path.endsWith('/account-bindings')) return r.fulfill({ json: rows });
      if (path.endsWith('/account-binding')) {
        writes++;
        if (fail) return r.fulfill({ status: 503, json: { code: 'IDENTITY_UNAVAILABLE' } });
        assert.equal(r.request().postDataJSON().accountId, 'member');
        rows[0].accountBinding = { accountId: 'member', boundBy: 'admin', boundAt: '2026-10-17T00:00:00Z' };
        return r.fulfill({ json: rows[0].accountBinding });
      }
      return r.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:8080/interview/settings/members', { waitUntil: 'domcontentloaded' });
    const section = page.getByTestId('interviewer-bindings'), row = page.getByTestId('binding-directory');
    await row.getByRole('combobox').click();
    assert.equal(await page.getByTitle('Disabled (disabled@example.com)', { exact: true }).count(), 0);
    assert.equal(await page.getByTitle('Invited (invited@example.com)', { exact: true }).count(), 0);
    await page.getByTitle('Member (member@example.com)', { exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    const initialCollapse = page.getByRole('button', { name: /Collapse navigation|收起导航/ });
    if (await initialCollapse.count()) await initialCollapse.click();
    await section.scrollIntoViewIfNeeded();
    assert.ok(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await section.screenshot({ path: '../../evidence/2026-10-17-queue50/426-binding-selection.png' });
    await page.setViewportSize({ width: 1366, height: 1000 });
    await row.getByRole('button', { name: '关联账号', exact: true }).click();
    await page.getByRole('button', { name: /取\s*消/ }).click();
    assert.equal(writes, 0);
    await row.getByRole('button', { name: '关联账号', exact: true }).click();
    await page.getByRole('button', { name: '确认关联', exact: true }).click();
    await page.getByRole('dialog').getByRole('alert').waitFor();
    assert.match(await row.innerText(), /Member/);
    fail = false;
    await page.getByRole('button', { name: '确认关联', exact: true }).click();
    await row.getByText(/已关联：Member/).waitFor();
    assert.equal(await row.getByRole('combobox').count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await row.getByText(/操作人：Admin/).waitFor();
    await section.screenshot({ path: '../../evidence/2026-10-17-queue50/426-binding-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    const collapse = page.getByRole('button', { name: /Collapse navigation|收起导航/ });
    if (await collapse.count()) await collapse.click();
    await section.scrollIntoViewIfNeeded();
    assert.ok(await section.evaluate(el => el.scrollWidth <= el.clientWidth + 1));
    await section.screenshot({ path: '../../evidence/2026-10-17-queue50/426-binding-narrow.png' });
    admin = false;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText(/Only admins can manage|只有管理员|仅管理员/).first().waitFor();
    assert.equal(await section.count(), 0);
    assert.equal(writes, 2); assert.deepEqual(errors, []);
    console.log('PASS #426 browser: selection, cancellation, failure preservation, retry, read-only audit, reload, narrow and non-admin');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
