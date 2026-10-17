const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    const job = { id: 'j', title: 'Synthetic job', jdText: 'Platform engineer', recruitingStatus: 'open', createdAt: '2026-10-17T00:00:00Z' };
    const material = (id, name, readStatus = 'available') => ({ id, name, readStatus, text: '', segments: [], errorCode: null });
    const task = { id: 'task', jobId: 'j', job, candidate: { id: 'c', name: 'Synthetic candidate' }, status: 'interview_in_progress', createdAt: job.createdAt, rounds: [], parseJobs: [],
      resume: { material: material('resume1', 'resume-current.txt'), parseJobs: [] },
      materials: [{ kind: 'assessment', material: material('report1', 'assessment-first.txt') }, { kind: 'assessment', material: material('report2', 'assessment-second.txt', 'failed') }],
      stages: ['overview', 'rubric', 'plan', 'schedule', 'brief', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: true })) };
    await page.route('**/interview/api/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/jobs')) return r.fulfill({ json: [job] });
      if (p.endsWith('/tasks')) return r.fulfill({ json: [task] });
      if (p.endsWith('/tasks/task')) return r.fulfill({ json: task });
      if (p.endsWith('/debrief')) return r.fulfill({ json: { totalCards: 0, cards: [], mustHaveTotal: 0 } });
      return r.fulfill({ json: [] });
    });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Task list', exact: true }).click();
    await page.getByRole('table').getByText('Synthetic candidate', { exact: true }).click();
    await page.waitForURL(/\/project\/task\/live$/);
    await page.goto(`${base}project/task/overview`, { waitUntil: 'domcontentloaded' });
    const files = page.getByTestId('source-material');
    await files.nth(2).waitFor();
    assert.equal(await files.count(), 3);
    assert.match(await files.allTextContents().then(v => v.join('\n')), /resume-current\.txt.*resume1/);
    assert.match(await files.nth(2).innerText(), /assessment-second\.txt.*\nUnreadable/);
    assert.ok((await files.allTextContents()).every(v => v.includes('Source and version not recorded')));
    task.resume = null;
    task.materials = [];
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Not provided', { exact: true }).first().waitFor();
    assert.equal(await files.count(), 0);
    console.log('PASS #303 in-progress task opens Live; #242 named individual materials, read failures and missing files');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
