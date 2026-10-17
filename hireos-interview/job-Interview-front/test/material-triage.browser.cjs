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
    const task = { id: 'task', job: { id: 'job', title: 'Synthetic', jdText: '' }, candidate: { name: 'Synthetic' }, rounds: [], stages: [], createdAt: '2026-10-17T00:00:00Z', materials: ['a', 'b'].map(id => ({ kind: 'other', material: { id, name: `Unclassified ${id}`, text: 'Original content', readStatus: 'available' } })) };
    let writes = 0, fail = false, reportReads = 0;
    await page.route('**/interview/api/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/materials/triage')) {
        writes++;
        if (fail) return r.fulfill({ status: 409, json: { code: 'MATERIAL_ALREADY_CLASSIFIED' } });
        const body = r.request().postDataJSON();
        const item = task.materials.find(m => m.material.id === body.materialId);
        item.kind = body.kind; item.triagedBy = 'actual-classifier'; item.triagedAt = '2026-10-17T00:00:00Z';
        return r.fulfill({ json: { replayed: false, ...item } });
      }
      if (p.endsWith('/screening-reports')) { reportReads++; return r.fulfill({ json: { revision: 0, needsResolution: false, reports: task.materials.filter(m => m.kind === 'screening').map(m => ({ ...m.material, state: 'current' })), history: [] } }); }
      if (p.endsWith('/debrief')) return r.fulfill({ json: { totalCards: 0, mustHaveTotal: 0, cards: [] } });
      if (p.endsWith('/tasks/task')) return r.fulfill({ json: task });
      return r.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:8080/interview/project/task/overview', { waitUntil: 'domcontentloaded' });
    const item = page.getByTestId('triage-a');
    await item.getByText('Unassigned · needs triage').waitFor();
    assert.equal(await page.getByTestId('source-material').count(), 0);
    await item.getByRole('button', { name: 'Triage', exact: true }).click();
    assert.deepEqual(await item.locator('option').evaluateAll(nodes => nodes.map(n => n.value)), ['', 'screening', 'assessment']);
    await item.getByRole('combobox').selectOption('assessment');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Collapse navigation/i }).click();
    await item.scrollIntoViewIfNeeded();
    assert.equal(await item.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    await item.screenshot({ path: '../../evidence/2026-10-17-queue50/247-triage-selection.png' });
    await page.setViewportSize({ width: 1366, height: 900 });
    await item.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(writes, 0);
    await item.getByRole('button', { name: 'Triage', exact: true }).click();
    fail = true;
    await item.getByRole('button', { name: 'Confirm classification' }).click();
    await item.getByRole('alert').waitFor();
    assert.equal(await item.getByRole('combobox').inputValue(), 'assessment');
    fail = false;
    await item.getByRole('button', { name: 'Confirm classification' }).click();
    await item.waitFor({ state: 'hidden' });
    await page.getByTestId('source-material').getByText('Unclassified a', { exact: true }).waitFor();
    assert.match(await page.getByTestId('source-material').innerText(), /actual-classifier/);
    const previousReads = reportReads;
    const second = page.getByTestId('triage-b');
    await second.getByRole('button', { name: 'Triage', exact: true }).click();
    await second.getByRole('combobox').selectOption('screening');
    await second.getByRole('button', { name: 'Confirm classification' }).click();
    await page.getByTestId('screening-reports').getByText('Unclassified b · Current', { exact: true }).waitFor();
    assert.ok(reportReads > previousReads);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('No attachments need triage', { exact: true }).waitFor();
    assert.equal(await page.getByTestId('source-material').count(), 2);
    await page.getByTestId('material-triage').screenshot({ path: '../../evidence/2026-10-17-queue50/247-triage.png' });
    assert.equal(writes, 3); assert.deepEqual(errors, []);
    console.log('PASS #247 unassigned exclusion, two permitted types, cancel, conflict/input retention, category refresh, screening refresh, audit and reload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
