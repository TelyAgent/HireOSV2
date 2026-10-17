const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.INTERVIEW_TEST_URL || 'http://127.0.0.1:5197/interview/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.route('**/account/api/**', r => r.fulfill({ json: { loginRequired: false }, status: r.request().url().endsWith('/me') ? 401 : 200 }));
    const round = { id: 'round', sequence: 1, name: 'Round 1', status: 'Planned', scheduledAt: '2026-10-17T00:00:00Z', completedAt: null, interviewer: null };
    const job = { id: 'job', title: 'Synthetic engineer', jdText: 'APIs' };
    const task = { id: 'task', job, candidate: { id: 'c', name: 'Synthetic candidate' }, status: 'interview_in_progress', rounds: [round], materials: [], parseJobs: [], resume: null,
      stages: ['overview', 'rubric', 'plan', 'schedule', 'brief', 'live', 'review', 'debrief', 'decision', 'package'].map(stage => ({ stage, unlocked: true, done: true })) };
    const questions = [1, 2].map(n => ({ id: `q${n}`, cardId: `c${n}`, situationPrompt: `Situation ${n}`, taskPrompt: 'Task?', actionPrompt: 'Action?', resultPrompt: 'Result?', mandatory: true, card: { requirement: `Capability ${n}`, competencyTags: 'API', cardPriority: 'P0', expectedEvidence: 'Example' } }));
    const skipped = new Map(); let failSkip = true; let failDecision = false; let failRecommendation = false;
    const citations = [{ segmentId: 'c1', sourceJobId: 'generation1', generatedAt: '2026-10-17T00:00:00Z', quote: 'Human score: 3', snapshot: 'Capability 1\nHuman score: 3\nOriginal evidence note' }];
    let decision = { decision: 'hold', decisionAt: '2026-10-17T00:00:00Z', decisionReason: null, decisionBy: null, decisionVersion: null, conclusion: 'Synthetic summary', suggestedDecision: null, generation: null, citations };
    const record = { session: { id: 'session', taskId: 'task', round: 1 }, note: { content: '', version: 0, updatedAt: null }, transcript: { status: 'unavailable', code: 'RTMS_NOT_CONNECTED' } };
    await page.route('**/interview/api/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/tasks/task')) return r.fulfill({ json: task });
      if (p.endsWith('/rounds')) return r.fulfill({ json: [round] });
      if (p.endsWith('/host/status')) return r.fulfill({ json: { connected: false } });
      if (p.endsWith('/interview-sessions') || p.endsWith('/record')) return r.fulfill({ json: record });
      if (p.endsWith('/brief-questions')) return r.fulfill({ json: { jobId: job.id, rubricVersionId: 'rubric', generation: null, questions } });
      if (p.endsWith('/skipped-questions')) return r.fulfill({ json: [...skipped.values()] });
      if (p.endsWith('/skip')) {
        if (failSkip) return r.fulfill({ status: 503, json: { code: 'SAVE_UNAVAILABLE' } });
        const q = questions.find(q => p.includes(`/questions/${q.id}/`));
        if (!skipped.has(q.id)) skipped.set(q.id, { id: `skip-${q.id}`, roundId: round.id, questionId: q.id, actorId: 'interviewer-test', skippedAt: '2026-10-17T01:00:00Z', snapshot: q });
        return r.fulfill({ json: skipped.get(q.id) });
      }
      if (p.endsWith('/scores')) return r.fulfill({ json: { generation: null, entries: [] } });
      if (p.endsWith('/recommendation')) {
        if (failRecommendation) return r.fulfill({ status: 503, json: { code: 'RECOMMENDATION_UNAVAILABLE' } });
        const input = r.request().postDataJSON();
        assert.ok(input.recommendation === null || input.reason.trim());
        round.recommendation = input.recommendation; round.recommendationReason = input.recommendation ? input.reason.trim() : null;
        return r.fulfill({ json: round });
      }
      if (p.endsWith('/summary')) return r.fulfill({ json: { generation: null } });
      if (p.endsWith('/decision')) {
        if (r.request().method() === 'PATCH') {
          if (failDecision) return r.fulfill({ status: 503, json: { code: 'SAVE_UNAVAILABLE' } });
          const input = r.request().postDataJSON();
          assert.equal(input.version, decision.decisionVersion ?? 0);
          decision = { ...decision, decision: input.decision, decisionReason: input.reason.trim(), decisionBy: 'reviewer-test', decisionAt: '2026-10-17T02:00:00Z', decisionVersion: (decision.decisionVersion ?? 0) + 1 };
        }
        return r.fulfill({ json: decision });
      }
      return r.fulfill({ json: [] });
    });
    await page.goto(`${base}project/task/live`);
    await page.getByText('Situation 1', { exact: true }).waitFor();
    const skip = page.getByRole('button', { name: 'Skip', exact: true });
    await skip.click();
    await page.getByRole('alert').filter({ hasText: 'Could not save skip' }).waitFor();
    assert.equal(skipped.size, 0);
    failSkip = false;
    await skip.click();
    await page.getByText('Situation 2', { exact: true }).waitFor();
    assert.equal(await skip.isEnabled(), true, 'last question can be skipped');
    await skip.click();
    await page.getByText('Not asked', { exact: true }).waitFor();
    await skip.click();
    assert.equal(skipped.size, 2);
    await page.reload();
    await page.getByText('Situation 1', { exact: true }).waitFor();
    await page.getByText('Not asked', { exact: true }).waitFor();
    round.status = 'completed'; round.completedAt = '2026-10-17T02:00:00Z';
    await page.goto(`${base}project/task/review`);
    const records = page.getByRole('region', { name: 'Questions not asked' });
    await records.getByText('Situation 1', { exact: true }).waitFor();
    await records.getByText('Situation 2', { exact: true }).waitFor();
    assert.match(await records.innerText(), /interviewer-test/);
    await page.screenshot({ path: '../../evidence/2026-10-17-queue50/question-skips-review.png', fullPage: true });
    const recReason = page.getByRole('textbox', { name: 'Recommendation reason', exact: true });
    const advance = page.getByRole('button', { name: 'Advance', exact: true });
    assert.equal(await advance.isDisabled(), true);
    await recReason.fill('  '); assert.equal(await advance.isDisabled(), true);
    await recReason.fill('Clear examples from this round'); await advance.click();
    await page.getByText('Saved reason: Clear examples from this round', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Round 2', exact: true }).click();
    await page.getByText('No real round linked.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Round 1', exact: true }).click();
    await recReason.waitFor();
    assert.equal(await recReason.inputValue(), 'Clear examples from this round', 'switching rounds uses the saved record');
    await page.reload(); await recReason.waitFor();
    assert.equal(await recReason.inputValue(), 'Clear examples from this round');
    failRecommendation = true;
    await recReason.fill('Additional supporting example');
    await page.getByRole('button', { name: 'Save recommendation reason' }).click();
    await page.getByRole('alert').filter({ hasText: 'RECOMMENDATION_UNAVAILABLE' }).waitFor();
    assert.equal(await recReason.inputValue(), 'Additional supporting example');
    assert.equal(round.recommendationReason, 'Clear examples from this round');
    failRecommendation = false;
    await page.getByRole('button', { name: 'Save recommendation reason' }).click();
    await page.getByText('Saved reason: Additional supporting example', { exact: true }).waitFor();
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.screenshot({ path: '../../evidence/2026-10-17-queue50/recommendation-reason.png', fullPage: true });
    await advance.click();
    await page.waitForFunction(() => document.querySelector('textarea[id^="recommendation-reason-"]')?.value === '');
    assert.equal(round.recommendation, null); assert.equal(round.recommendationReason, null);
    round.recommendation = 'hold'; round.recommendationReason = null;
    await page.reload(); await page.getByText('Saved reason: Not recorded', { exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${base}project/task/decision`);
    await page.getByText('Recorded by: Not recorded', { exact: true }).waitFor();
    const reason = page.getByRole('textbox', { name: 'Human decision reason' });
    await reason.fill('Additional work sample required');
    await page.getByRole('button', { name: 'Save reason', exact: true }).click();
    await page.getByText('Decision version: 1', { exact: true }).waitFor();
    await page.reload();
    await reason.waitFor();
    assert.equal(await reason.inputValue(), 'Additional work sample required');
    await page.getByText('View cited snapshot 1', { exact: true }).click();
    await page.locator('details[open] pre').waitFor();
    assert.match(await page.locator('details[open]').innerText(), /Original evidence note/);
    assert.match(await page.locator('details[open]').innerText(), /not the current score/);
    failDecision = true;
    await reason.fill('Retained unsaved reason');
    await page.getByRole('button', { name: 'Save reason', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'SAVE_UNAVAILABLE' }).waitFor();
    assert.equal(await reason.inputValue(), 'Retained unsaved reason');
    assert.equal(decision.decisionVersion, 1);
    failDecision = false;
    await page.getByRole('button', { name: 'Save reason', exact: true }).click();
    await page.getByText('Decision version: 2', { exact: true }).waitFor();
    await page.screenshot({ path: '../../evidence/2026-10-17-queue50/decision-audit-snapshot.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS #335 skip failure/retry, middle/last/repeated skip, Live refresh and Review; #296 legacy audit, reason save/reload, version, failure retention and cited snapshot; #287 required reason, reload, edit, failed save/retry, cancel and legacy (mock APIs)');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
