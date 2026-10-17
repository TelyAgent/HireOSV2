const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    let writes = 0;
    let failSave = false;
    const entry = { card: { id: 'card', requirement: 'Recovery', cardPriority: 'P0', weight: 100 }, score: null, note: '', aiScore: 2, aiRationale: 'AI original rationale' };
    const rounds = [{ id: 'round', sequence: 1, name: 'Round 1', status: 'completed', completedAt: '2026-10-17T00:00:00Z', interviewer: null }];
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    await page.route('**/interview/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      let json = [];
      if (path.endsWith('/tasks/project')) json = {
        id: 'project', job: { id: 'job', title: 'Engineer' }, candidate: { id: 'candidate', name: 'Test candidate' }, rounds, materials: [], parseJobs: [], resume: null,
        stages: ['overview', 'rubric', 'plan', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: false })),
      };
      if (path.endsWith('/rounds')) json = rounds;
      if (path.endsWith('/summary')) json = { generation: null };
      if (path.endsWith('/scores')) json = { generation: null, entries: [entry] };
      if (path.endsWith('/scores/card')) {
        writes++;
        if (failSave) return route.fulfill({ status: 503, json: { code: 'SAVE_UNAVAILABLE' } });
        Object.assign(entry, route.request().postDataJSON());
        json = entry;
      }
      return route.fulfill({ json });
    });
    await page.goto(`${base}project/project/review`);
    await page.getByText(/Interview completed/).waitFor();
    assert.equal(await page.getByText(/submitted/i).count(), 0);
    const reason = page.getByRole('textbox', { name: 'Human score reason' });
    const save = page.getByRole('button', { name: 'Save score', exact: true });
    await page.getByRole('button', { name: '4', exact: true }).click();
    for (const value of ['', '   ', '\n\t']) {
      await reason.fill(value);
      assert.equal(await save.isDisabled(), true);
      assert.equal(await reason.getAttribute('aria-invalid'), 'true');
      await page.getByText('A reason is required for a human score.', { exact: true }).waitFor();
    }
    assert.equal(writes, 0);
    await reason.fill('Recovery demonstrated');
    failSave = true;
    await save.click();
    await page.getByRole('alert').filter({ hasText: 'SAVE_UNAVAILABLE' }).waitFor();
    assert.equal(await reason.inputValue(), 'Recovery demonstrated');
    assert.equal(entry.score, null);
    failSave = false;
    await save.click();
    await page.getByText('Saved', { exact: true }).waitFor();
    assert.equal(entry.score, 4);
    assert.equal(entry.aiScore, 2);
    await page.reload();
    await reason.waitFor();
    assert.equal(await reason.inputValue(), 'Recovery demonstrated');
    await reason.fill('');
    assert.equal(await save.isDisabled(), true);
    await page.getByRole('button', { name: 'Discard', exact: true }).click();
    assert.equal(await reason.inputValue(), 'Recovery demonstrated');
    assert.deepEqual(errors, []);
    console.log('PASS #282 blank/whitespace blocked, valid save, failure retry, reload, discard, AI unchanged');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
