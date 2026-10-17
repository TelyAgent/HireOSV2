const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.SCREENING_TEST_URL || 'http://127.0.0.1:5199/screening/';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const variants = [
      { confidence: 0.8, eligibility: 'eligible', proposalSource: 'ai' },
      { confidence: null, eligibility: 'eligible', proposalSource: 'ai' },
      { confidence: null, eligibility: 'eligible', proposalSource: 'manual' },
      { confidence: 0.9, eligibility: 'not_eligible', proposalSource: 'ai' },
    ];
    await page.route('**/account/api/**', r => r.fulfill({ status: r.request().url().endsWith('/me') ? 401 : 200, json: { loginRequired: false } }));
    await page.route('**/screening/api/**', r => {
      const p = new URL(r.request().url()).pathname;
      if (p.endsWith('/jobs')) return r.fulfill({ json: variants.map((_, i) => ({ id: `j${i}`, title: `Synthetic role ${i}`, status: 'open' })) });
      if (p.endsWith('/candidates/c')) return r.fulfill({ json: {
        candidate: { id: 'c', displayName: 'Synthetic candidate', tags: [] }, resumeVersions: [], applications: [],
        matching: { isMatching: false, lastRun: null },
        recommendations: variants.map((v, i) => ({ ...v, id: `r${i}`, candidateId: 'c', jobId: `j${i}`, status: 'proposed', createdAt: '2026-10-17T00:00:00Z', rationale: 'Relevant evidence', gaps: ['Needs verification'] })),
      } });
      return r.fulfill({ json: [] });
    });
    await page.goto(`${base}candidates/c/jobs`);
    const explanations = page.getByTestId('signal-explanation');
    await explanations.nth(3).waitFor();
    for (let i = 0; i < 4; i++) {
      const summary = explanations.nth(i).locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      assert.equal(await explanations.nth(i).getAttribute('open'), '');
      assert.match(await explanations.nth(i).innerText(), /not a confirmed job link/);
    }
    assert.match(await explanations.nth(0).innerText(), /strength of matching evidence/);
    assert.match(await explanations.nth(1).innerText(), /not enough evidence/);
    assert.match(await explanations.nth(2).innerText(), /A person proposed/);
    assert.match(await explanations.nth(3).innerText(), /conflicts with a role requirement/);
    assert.equal(await page.locator('#rec-r3 [data-testid="confidence"]').count(), 0);
    assert.doesNotMatch(await page.locator('#rec-r0').innerText(), /80%|0\.8/);
    // Halving the CSS viewport reproduces the reflow space at desktop 200% zoom.
    await page.setViewportSize({ width: 683, height: 450 });
    await page.screenshot({ path: '/tmp/hireos-189-narrow.png', fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await explanations.evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth)), true);
    await page.evaluate(() => localStorage.setItem('hireos_screening_prefs', JSON.stringify({ lang: 'zh' })));
    await page.reload();
    await explanations.nth(3).waitFor();
    await explanations.first().locator('summary').click();
    assert.match(await explanations.first().innerText(), /不表示已确认关联、已推进或已录用/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: '/tmp/hireos-189-zh-narrow.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS #189 four signal states, keyboard disclosure and narrow reflow');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
