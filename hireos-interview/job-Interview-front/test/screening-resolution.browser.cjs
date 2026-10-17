const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    const data = { revision: 0, currentId: null, needsResolution: true, history: [], reports: [
      { id: 'a', name: 'First screening report', text: 'Original report remains readable', state: 'unresolved', readStatus: 'available' },
      { id: 'b', name: 'Second screening report', text: 'Second report content', state: 'unresolved', readStatus: 'available' },
    ] };
    let writes = 0, fail = false;
    await page.route('**/interview/api/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/screening-reports/resolve')) {
        writes++;
        const body = r.request().postDataJSON();
        assert.equal(body.expectedRevision, data.revision);
        if (fail) return r.fulfill({ status: 409, json: { code: 'SCREENING_REPORTS_CHANGED' } });
        data.currentId = body.materialId; data.revision++; data.needsResolution = false;
        for (const report of data.reports) report.state = report.id === data.currentId ? 'current' : 'superseded';
        data.history.push({ id: 'resolution', revision: data.revision, selectedMaterialId: data.currentId, actorId: 'actual-reviewer', createdAt: '2026-10-17T00:00:00Z' });
        return r.fulfill({ json: { replayed: false, revision: data.revision } });
      }
      if (p.endsWith('/screening-reports')) return r.fulfill({ json: data });
      if (p.endsWith('/debrief')) return r.fulfill({ json: { totalCards: 0, mustHaveTotal: 0, cards: [] } });
      if (p.endsWith('/tasks/task')) return r.fulfill({ json: { id: 'task', job: { id: 'job', title: 'Synthetic', jdText: '' }, candidate: { name: 'Synthetic' }, rounds: [], stages: [], materials: [], createdAt: '2026-10-17T00:00:00Z' } });
      return r.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:8080/interview/project/task/overview', { waitUntil: 'domcontentloaded' });
    const panel = page.getByTestId('screening-reports');
    await panel.getByText('Duplicate · needs resolution', { exact: true }).waitFor();
    await panel.getByRole('button', { name: 'Resolve', exact: true }).click();
    await panel.getByRole('radio', { name: 'Second screening report' }).check();
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(writes, 0);
    await panel.getByRole('button', { name: 'Resolve', exact: true }).click();
    await panel.getByRole('radio', { name: 'Second screening report' }).check();
    fail = true;
    await panel.getByRole('button', { name: 'Confirm current report' }).click();
    await panel.getByRole('alert').waitFor();
    assert.equal(await panel.getByRole('radio', { name: 'Second screening report' }).isChecked(), true);
    fail = false;
    await panel.getByRole('button', { name: 'Reload reports' }).click();
    await panel.getByRole('alert').waitFor({ state: 'hidden' });
    await panel.getByRole('button', { name: 'Confirm current report' }).click();
    await panel.getByText('Second screening report · Current', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByText('First screening report · Superseded', { exact: true }).click();
    await panel.getByText('Original report remains readable', { exact: true }).waitFor();
    await panel.getByText('Resolution history', { exact: true }).click();
    assert.match(await panel.innerText(), /actual-reviewer/);
    await panel.screenshot({ path: '../../evidence/2026-10-17-queue50/246-resolution.png' });
    data.reports.push({ id: 'c', name: 'New attachment', text: 'New content', state: 'unresolved', readStatus: 'available' }); data.revision++; data.needsResolution = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await panel.getByText('Duplicate · needs resolution', { exact: true }).waitFor();
    await panel.getByText('Second screening report · Current', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Collapse navigation/i }).click();
    await panel.scrollIntoViewIfNeeded();
    assert.equal(await panel.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    assert.equal(writes, 2); assert.deepEqual(errors, []);
    console.log('PASS #246 duplicate selection, cancel, conflict/input retention, reload, history, retained content, new attachment and narrow panel');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
