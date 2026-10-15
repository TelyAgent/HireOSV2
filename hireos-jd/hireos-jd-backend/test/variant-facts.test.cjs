// #71 -- the three title variants share one set of job facts, at generation and after a refine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { FACT_FIELDS, pickFacts, pinFacts } = require('../dist/copilot/variant-facts');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const db = { copilotConversation: { findFirst: async () => ({ id: 'c1', phase: 'intake' }) }, aiRun: { create: async () => ({}) } };
const prose = (style) => ({ roleSummary: `${style} summary`, responsibilities: [`${style} duty 1`, `${style} duty 2`], mustHave: [`${style} skill 1`, `${style} skill 2`] });

/** Every call answers with a different location / work mode / headcount, like the inconsistent live output. */
function driftingLlm(places) {
  const calls = [];
  let n = 0;
  return {
    calls,
    completeJson: async (system, turns) => {
      const input = turns.map((t) => t.content).join('\n');
      calls.push(input);
      if (system.includes('意图分类器')) return JSON.stringify({ intent: 'edit' });
      const place = places[n++ % places.length];
      return JSON.stringify({
        reply: 'ok', phase: 'ready_to_confirm', missingFields: [],
        fields: { title: 'Finance Manager', department: `Finance ${place}`, location: place, employmentType: n % 2 ? 'Full-time' : 'Contract', headcount: n, ...prose(`v${n}`) },
      });
    },
  };
}
const svc = (llm) => new CopilotService(db, llm, { jdAutotakeSystemPrompt: 'autotake' }, {}, {});
const facts = (v) => FACT_FIELDS.map((k) => JSON.stringify(v.fields[k]));

test('#71 AC-1: one "Finance Manager" run → A/B/C share every job fact; styles still differ; two runs both hold', async () => {
  for (const places of [['上海', '远程', '北京'], ['中国大陆', '深圳', '远程（中国大陆）']]) {
    const llm = driftingLlm(places);
    const { variants } = await svc(llm).titleVariants(identity, 'c1', { title: 'Finance Manager' });
    assert.equal(variants.length, 3);
    assert.deepEqual(facts(variants[1]), facts(variants[0]));
    assert.deepEqual(facts(variants[2]), facts(variants[0]));
    assert.equal(variants[0].fields.location, places[0]);
    assert.notEqual(variants[1].fields.roleSummary, variants[0].fields.roleSummary, 'prose stays each style’s own');
    assert.doesNotMatch(llm.calls[0], /以下职位事实已经确定/, 'the first version settles the facts');
    assert.match(llm.calls[1], new RegExp(`"location":"${places[0].replace(/[()（）]/g, '.')}"`), 'later versions are told the facts');
  }
});

test('#71 AC-2: refining with B selected → B is refined first, all three end with B’s work mode and location', async () => {
  const start = ['A', 'B', 'C'].map((k, i) => ({ key: k, label: k, description: '', fields: { title: 'Finance Manager', location: ['上海', '上海', '北京'][i], headcount: 1, ...prose(k) } }));
  const llm = driftingLlm(['远程', '远程（中国大陆）', '远程（中国大陆）']);
  const { variants } = await svc(llm).refineVariants(identity, 'c1', { note: 'make it remote', primary: 1, variants: start });
  assert.equal(variants[1].fields.location, '远程', 'B was refined first and settled the facts');
  assert.deepEqual(variants.map((v) => v.fields.location), ['远程', '远程', '远程']);
  assert.deepEqual(facts(variants[0]), facts(variants[1]));
  assert.deepEqual(facts(variants[2]), facts(variants[1]));
  assert.deepEqual(variants.map((v) => v.key), ['A', 'B', 'C'], 'order and identity kept');
});

test('pinFacts copies exactly the reference facts — a fact the reference lacks is removed', () => {
  const pinned = pinFacts({ title: 'X', location: 'Remote', publicCompensation: { min: 1, max: 2, currency: 'CNY', period: 'month' }, roleSummary: 's' }, { title: 'Y', location: 'Shanghai' });
  assert.deepEqual(pinned, { title: 'Y', location: 'Shanghai', roleSummary: 's' });
  assert.deepEqual(pickFacts({ title: 'Y', roleSummary: 's', headcount: 2 }), { title: 'Y', headcount: 2 });
});
