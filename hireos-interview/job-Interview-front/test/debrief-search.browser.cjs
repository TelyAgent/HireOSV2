const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/account/api/**', route => route.fulfill({ json: { loginRequired: false }, status: route.request().url().endsWith('/me') ? 401 : 200 }));
    const jobs = [ { id: 'job', title: 'Platform engineer' }, { id: 'empty', title: 'Research engineer' } ].map(j => ({ ...j, recruitingStatus: 'open', createdAt: '2026-10-01T00:00:00Z' }));
    const rows = ['Alice', 'Bob'].map(name => ({ id: name, jobId: 'job', job: jobs[0], status: 'draft', candidate: { id: name, name }, rounds: [], resume: null, createdAt: jobs[0].createdAt }));
    await page.route('**/interview/api/jobs', route => route.fulfill({ json: jobs }));
    await page.route('**/interview/api/tasks', route => route.fulfill({ json: rows }));
    await page.goto(base);
    const search = page.getByRole('searchbox', { name: 'Search projects or candidates', exact: true });
    const table = page.getByRole('table');
    await page.getByRole('button', { name: 'Draft (3)', exact: true }).waitFor();
    for (const mode of ['Task list', 'Cluster by JD']) {
      await page.getByRole('button', { name: mode, exact: true }).click();
      await search.fill('  ALICE  ');
      if (mode === 'Cluster by JD') await table.getByRole('button', { name: 'Expand', exact: true }).click();
      await table.getByText('Alice', { exact: true }).waitFor();
      assert.equal(await table.getByText('Bob', { exact: true }).count(), 0);
      await search.fill('platform');
      await table.getByText('Bob', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Published (0)', exact: true }).click();
      await table.getByText('No matching projects.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Draft (3)', exact: true }).click();
      await table.getByText('Alice', { exact: true }).waitFor();
      await search.fill('not-found');
      await table.getByText('No matching projects.', { exact: true }).waitFor();
      await search.fill('');
      await table.getByText('Bob', { exact: true }).waitFor();
    }
    await search.fill('research');
    await table.getByText('Research engineer', { exact: true }).waitFor();
    assert.equal(await table.getByText('Platform engineer', { exact: true }).count(), 0);
    console.log('PASS #314: candidate/job search, case/whitespace, both views, combined filter, no matches, clear, JD-only');
    const more = page.getByRole('button', { name: /More statistics \(9\)/i });
    assert.equal(await more.getAttribute('aria-expanded'), 'false');
    await more.focus();
    await page.keyboard.press('Enter');
    const supplementary = page.getByRole('region', { name: 'Supplementary metrics (6)', exact: true });
    const trends = page.getByRole('region', { name: 'Trends & additional stats (3)', exact: true });
    await supplementary.waitFor();
    assert.equal(await supplementary.getByTestId('home-metric').count(), 6);
    assert.equal(await trends.getByTestId('home-metric').count(), 3);

    const roundScores = [2, 4, null].map((score, index) => ({ roundId: `r${index + 1}`, sequence: index + 1, name: `Round ${index + 1}`, interviewer: index === 2 ? null : { id: `i${index}`, name: `Reviewer ${index + 1}` }, score, note: ['No recovery plan', 'Recovery demonstrated', 'Need more evidence'][index], updatedAt: '2026-10-17T00:00:00Z', aiEvidence: index === 2 ? null : { segmentId: `line${index + 1}`, quote: `Original source ${index + 1}` } }));
    await page.route('**/interview/api/tasks/project', route => route.fulfill({ json: {
      id: 'project', status: 'draft', job: jobs[0], candidate: { id: 'Alice', name: 'Alice' }, rounds: [], materials: [], parseJobs: [], resume: null,
      stages: ['overview', 'rubric', 'plan', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, done: false, unlocked: true })),
    } }));
    await page.route('**/interview/api/tasks/project/debrief', route => route.fulfill({ json: {
      bar: 3, totalCards: 1, scoredCount: 1, mustHaveTotal: 1, mustHaveMet: 1, evaluatedWeightPct: 100, overall: 'pass', unknownCards: [], mismatches: [], unresolved: [], generation: null,
      cards: [{ id: 'card', requirement: 'Reliability', cardPriority: 'P0', weight: 100, score: 4, note: 'Recovery demonstrated', round: { sequence: 2, name: 'Round 2' }, ai: null, roundScores }],
    } }));
    await page.goto(`${base}project/project/debrief`);
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.reload();
      await page.getByRole('button', { name: /Reliability/ }).click();
      for (const [index, score] of [2, 4, 'Unknown'].entries()) {
        const record = page.getByRole('region', { name: `Round ${index + 1} human record` });
        await record.getByText(`Human score: ${score}`, { exact: true }).waitFor();
        await record.getByText(roundScores[index].note, { exact: true }).waitFor();
        await record.getByText(`Interviewer: ${index === 2 ? 'Not recorded' : `Reviewer ${index + 1}`}`, { exact: true }).waitFor();
        if (index < 2) await record.getByText(`Original source ${index + 1}`, { exact: true }).waitFor();
        else await record.getByText('No source citation recorded.', { exact: true }).waitFor();
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS #324: both conflicting opinions, Unknown, named interviewers, per-round citations, refresh, desktop/mobile');
    await page.goto(base);
    await supplementary.waitFor();
    assert.equal(await more.getAttribute('aria-expanded'), 'true');
    await more.click();
    assert.equal(await supplementary.count(), 0);
    assert.equal(await trends.count(), 0);
    await page.reload();
    assert.equal(await more.getAttribute('aria-expanded'), 'false');
    console.log('PASS #306: 6 supplementary + 3 trend metrics, keyboard expand, return home, collapse, reload');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
