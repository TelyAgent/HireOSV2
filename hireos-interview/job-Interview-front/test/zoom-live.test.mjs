import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.ZOOM_TEST_URL || 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  let mode = 'disabled';
  let issued = 0;
  const connection = { connected: true, name: 'Test host', pending: false, error: null };
  await page.route('**/api/meetings/host/status', route => route.fulfill({ json: connection }));
  await page.route('**/api/meetings/host/start', route => {
    issued++;
    return route.fulfill({ status: mode === 'disabled' ? 404 : 200, contentType: 'application/json', body: JSON.stringify(mode === 'disabled' ? { code: 'ZOOM_DISABLED' } : { meetingNumber: '12345678901', password: 'test', displayName: 'Test interviewer', signature: 'test.signature', zak: 'test-zak', joinUrl: 'https://zoom.us/j/12345678901', expiresAt: 9999999999 }) });
  });
  await page.route('https://source.zoom.us/**', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().includes('zoom-meeting-embedded') ? `window.ZoomMtgEmbedded = { createClient() { window.joinCount = 0; let handler; return { on(name, fn) { handler = fn; }, updateVideoOptions() {}, async init() { document.getElementById('meeting').textContent = 'SDK test meeting'; }, async join() { window.joinCount++; handler({state:'Connected'}); }, async leaveMeeting() { handler({state:'Closed'}); } }; }, destroyClient() {} };` : '' }));
  await page.goto(`${base}/project/live`);
  await page.getByRole('button', { name: /^(Create \/ host meeting|创建 \/ 进入主持会议)$/ }).click();
  await page.getByText(/Zoom development mode is disabled|Zoom 开发联调未开启/).waitFor();
  assert.equal(page.frames().length, 1);
  mode = 'ready';
  await page.getByRole('button', { name: /^(Retry|重试)$/ }).click();
  await page.getByText(/^(Connected|已连接)$/).waitFor();
  const meeting = page.frames().find(frame => frame.url().includes('/zoom-meeting/'));
  assert.equal(await meeting.evaluate(() => window.joinCount), 1);
  assert.equal(issued, 2);
  await page.screenshot({ path: '/tmp/hireos-zoom-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /^(Leave meeting|离开会议)$/ }).click();
  await page.getByText(/^(Left meeting|已离开会议)$/).waitFor();
  assert.equal(page.frames().length, 1);
  await page.getByRole('button', { name: /^(Create \/ host meeting|创建 \/ 进入主持会议)$/ }).click();
  await page.getByText(/^(Connected|已连接)$/).waitFor();
  await page.getByRole('button', { name: /^(EN \/ 中|中 \/ EN)$/ }).click();
  assert.equal(page.frames().length, 2);
  await page.getByRole('button', { name: /退出.*计划|返回.*计划|Exit to plan/i }).click();
  await page.waitForURL('**/project/plan');
  assert.equal(page.frames().length, 1);
  assert.deepEqual(errors, []);

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.route('**/api/meetings/host/status', route => route.fulfill({ json: connection }));
  await mobile.goto(`${base}/project/live`);
  await mobile.getByRole('button', { name: /^(Create \/ host meeting|创建 \/ 进入主持会议)$/ }).click();
  await mobile.getByText(/invitation link supplied|主持人提供的 Zoom 邀请链接/).waitFor();
  assert.equal(mobile.frames().length, 1);
  const box = await mobile.locator('.zoom-panel').boundingBox();
  assert.ok(box.width <= 390 && box.x >= 0);
  await mobile.screenshot({ path: '/tmp/hireos-zoom-mobile.png', fullPage: true });
  console.log('PASS: disabled config, isolated SDK join, repeat join, leave cleanup, language switch, navigation cleanup, mobile fallback');
} finally { await browser.close(); }
