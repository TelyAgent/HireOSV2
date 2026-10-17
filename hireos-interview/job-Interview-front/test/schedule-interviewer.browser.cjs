const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    let writes = 0;
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const round = { id: 'round', sequence: 1, name: 'Round 1', format: 'Video interview', duration: 45, status: 'Planned', interviewer: null, version: 1, scheduledAt: '2026-11-01T10:00:00.000Z', timezone: 'UTC' };
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/interview/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let json = [];
      if (path.endsWith('/tasks/project')) json = { id: 'project', job: { id: 'job', title: 'Engineer' }, candidate: { id: 'c', name: 'Test candidate' }, rounds: [round], materials: [], parseJobs: [], resume: null, stages: ['overview', 'rubric', 'plan', 'schedule', 'brief', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: false })) };
      if (path.endsWith('/rounds')) json = [round];
      if (path.endsWith('/host/status')) json = { connected: false, pending: false };
      if (path.endsWith('/rounds/round/schedule')) { writes++; Object.assign(round, route.request().postDataJSON()); json = round; }
      return route.fulfill({ json });
    });
    await page.goto(`${base}project/project/schedule`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Interviewer required', { exact: true }).waitFor();
    assert.equal(await page.getByText('Scheduled', { exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
    const save = page.getByRole('button', { name: 'Save schedule', exact: true });
    await save.waitFor();
    assert.equal(await save.isDisabled(), true);
    await page.getByRole('status').filter({ hasText: 'Review and assign the interviewer in Interview plan before saving the schedule.' }).waitFor();
    assert.equal(writes, 0);
    await page.getByRole('button', { name: 'Review interview plan', exact: true }).click();
    await page.waitForURL('**/project/project/plan');
    round.interviewer = { id: 'interviewer', name: 'Reviewer', title: null };
    await page.goto(`${base}project/project/schedule`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reschedule', exact: true }).click();
    await page.getByText('Interviewer: Reviewer', { exact: true }).waitFor();
    assert.equal(await save.isEnabled(), true);
    await save.click();
    await page.getByText('Scheduled', { exact: true }).waitFor();
    assert.equal(writes, 1);
    assert.equal(await page.getByText('Unassigned', { exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS #260 missing interviewer blocked, legacy state marked, plan link, assigned save');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
