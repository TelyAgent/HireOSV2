// Hand-rolled Playwright smoke script, matching the job-Interview-front
// pattern (test/*.test.mjs, no runner/config — just `node test/x.test.mjs`
// against a running dev server). Navigates every route and asserts it
// renders without a JS runtime error; also exercises theme/language/role
// switching since those mutate every page via CSS vars + the i18n table.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SCREENING_TEST_URL || 'http://localhost:5174';

const ROUTES = [
  '/',
  '/tasks',
  '/library',
  '/imports/new',
  '/duplicates/dup-am-identity',
  '/candidates/cand-alex',
  '/candidates/cand-alex/jobs',
  '/jobs',
  '/jobs/job-a/criteria',
  '/jobs/job-a/screening',
  '/applications/app-alex-a',
  '/applications/app-riley-a/decision',
  '/comparisons/cmp-job-a',
  '/deliveries',
  '/deliveries/deliv-morganb-1',
  '/files',
  '/settings/preferences',
  '/settings/ai-models',
  '/this-route-does-not-exist',
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} :: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`${page.url()} :: console.error :: ${msg.text()}`);
  });

  for (const route of ROUTES) {
    await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    // Every real page renders inside #app with a topbar; a blank page means
    // the ErrorBoundary or a router miss swallowed something silently.
    await page.locator('#app .topbar').waitFor({ timeout: 5000 });
    console.log(`PASS: route renders — ${route}`);
  }

  // Theme / accent / text-size / language / role-switch — each mutates the
  // whole tree via CSS vars or the i18n table, so exercise them on one page.
  await page.goto(`${base}/tasks`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Appearance|外观/ }).click();
  await page.getByRole('button', { name: /^Dark$/ }).click();
  await page.getByRole('button', { name: /^Teal$/ }).click();
  await page.getByRole('button', { name: /^Large$/ }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('html').getAttribute('data-accent'), 'teal');
  assert.equal(await page.locator('html').getAttribute('data-text'), 'large');
  await page.getByRole('button', { name: /^Done$/ }).click();
  console.log('PASS: appearance (theme/accent/text-size) applies');

  await page.getByRole('button', { name: /^(中 \/ EN|EN \/ 中)$/ }).click();
  await page.getByText('我的任务').waitFor({ timeout: 3000 });
  console.log('PASS: language toggle (en -> zh)');
  await page.getByRole('button', { name: /^(中 \/ EN|EN \/ 中)$/ }).click();
  await page.getByText('My Tasks').first().waitFor({ timeout: 3000 });
  console.log('PASS: language toggle (zh -> en)');

  await page.locator('.role-pill').click();
  await page.locator('.radio-card', { hasText: 'Daniel Park' }).click();
  await page.locator('.role-pill').getByText('Daniel Park').waitFor({ timeout: 3000 });
  console.log('PASS: demo role switch');

  await page.reload({ waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/hireos-screening-mobile.png', fullPage: false });

  if (errors.length) {
    console.error('FAIL: page/console errors captured during navigation:');
    for (const e of errors) console.error(' -', e);
    failed = true;
  } else {
    console.log('PASS: no page or console errors across all routes');
  }
} catch (err) {
  console.error('FAIL:', err.message);
  failed = true;
} finally {
  await browser.close();
}

if (failed) process.exit(1);
console.log('ALL SMOKE CHECKS PASSED');
