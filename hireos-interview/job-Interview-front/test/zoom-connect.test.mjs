import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const context = await browser.newContext();
  let connected = false;
  await context.route('**/api/meetings/host/status', route => route.fulfill({ json: { connected, name: connected ? 'OAuth Test Host' : null, pending: false, error: null } }));
  await context.route('**/api/meetings/host/authorize', route => {
    assert.equal(route.request().headers()['x-hireos-zoom'], '1');
    connected = true;
    return route.fulfill({ json: { authorizationUrl: 'https://zoom.us/oauth/authorize?mock=1' } });
  });
  await context.route('https://zoom.us/oauth/authorize?mock=1', route => route.fulfill({ contentType: 'text/plain', body: 'Mock OAuth approval' }));
  const page = await context.newPage();
  await page.goto(`${process.env.ZOOM_TEST_URL || 'http://localhost:5173'}/project/live`);
  await page.getByRole('button', { name: /^(Connect Zoom|连接 Zoom)$/ }).click();
  await page.getByText('Host: OAuth Test Host').waitFor();
  await page.getByRole('button', { name: 'Create / host meeting', exact: true }).waitFor();
  console.log('PASS: connect button, OAuth popup, CSRF header, status polling, host controls');
} finally { await browser.close(); }
