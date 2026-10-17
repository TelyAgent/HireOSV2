// #71 -- the three title variants share one set of job facts, at generation and after a refine.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CopilotService } = require('../dist/copilot/copilot.service');
const { FACT_FIELDS, factsFromTitleOnly, pickFacts, pinFacts } = require('../dist/copilot/variant-facts');

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

test('#72 AC-1: title-only input does not confirm department, location, work mode, or pay', async () => {
  for (const places of [['上海', '远程', '北京'], ['中国大陆', '深圳', '远程（中国大陆）']]) {
    const llm = driftingLlm(places);
    const { variants } = await svc(llm).titleVariants(identity, 'c1', { title: 'Finance Manager' });
    assert.equal(variants.length, 3);
    assert.deepEqual(facts(variants[1]), facts(variants[0]));
    assert.deepEqual(facts(variants[2]), facts(variants[0]));
    assert.equal(variants[0].fields.department, undefined);
    assert.equal(variants[0].fields.location, undefined);
    assert.equal(variants[0].fields.employmentType, undefined);
    assert.equal(variants[0].fields.publicCompensation, undefined);
    assert.equal(variants[0].fields.headcount, 1);
    assert.notEqual(variants[1].fields.roleSummary, variants[0].fields.roleSummary, 'prose stays each style’s own');
    assert.doesNotMatch(llm.calls[0], /以下职位事实已经确定/, 'the first version settles the facts');
    assert.match(llm.calls[1], /"title":"Finance Manager"/, 'later versions are told the confirmed title');
    assert.doesNotMatch(llm.calls[1], /"location"|"department"|"employmentType"|"publicCompensation"/, 'later versions are not given unconfirmed facts');
  }
});

test('factsFromTitleOnly keeps only the confirmed title and existing headcount default', () => {
  assert.deepEqual(
    factsFromTitleOnly({ title: 'Finance Manager', department: 'Finance', location: 'Shanghai', employmentType: 'Remote', headcount: 1 }, 'Finance Manager'),
    { title: 'Finance Manager', headcount: 1 },
  );
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

test('#71 AC-3: creating with the selected version stores exactly its facts — read back from the job and its draft', async () => {
  const { randomUUID } = require('node:crypto');
  const conv = { id: 'c1', workspaceId: 'ws-1', jobId: null, phase: 'intake', fields: {}, missingFields: [], stateRevision: 1, createdAt: new Date(), updatedAt: new Date() };
  const messages = [];
  const keys = new Map();
  const memDb = {
    copilotConversation: {
      findFirst: async () => conv,
      update: async ({ data }) => { for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v; return conv; },
      updateMany: async ({ data }) => { for (const [k, v] of Object.entries(data)) if (k !== 'stateRevision') conv[k] = v; return { count: 1 }; },
    },
    copilotMessage: {
      findFirst: async () => messages[messages.length - 1] ?? null,
      findMany: async () => messages,
      create: async ({ data }) => { const m = { id: randomUUID(), createdAt: new Date(), attachments: null, ...data }; messages.push(m); return m; },
    },
    idempotencyKey: { findUnique: async ({ where }) => keys.get(where.workspaceId_operation_key.key) ?? null, create: async ({ data }) => { keys.set(data.key, data); return data; } },
    aiRun: { create: async () => ({}) },
  };
  memDb.$transaction = async (fn) => fn(memDb);
  // Core Record and the JD draft store, as the persisted state a refresh would read again.
  const jobs = new Map();
  const core = { createJob: async (_i, body) => { const job = { id: 'job-1', ...body }; jobs.set(job.id, job); return job; } };
  const draftsById = new Map();
  const drafts = { create: async (_i, jobId, content) => { draftsById.set(jobId, content); return { jobId, ...content }; } };

  const llm = driftingLlm(['上海', '远程', '北京']);
  const service = new CopilotService(memDb, llm, { jdAutotakeSystemPrompt: 'autotake' }, core, drafts);
  const generated = await service.titleVariants(identity, 'c1', { title: 'Finance Manager' });
  const llm2 = driftingLlm(['远程', '远程（中国大陆）', '远程（中国大陆）']);
  const refined = await new CopilotService(memDb, llm2, { jdAutotakeSystemPrompt: 'autotake' }, core, drafts)
    .refineVariants(identity, 'c1', { note: 'make it remote', primary: 1, variants: generated.variants });
  const chosen = refined.variants[1];

  await service.setFields(identity, 'c1', { fields: chosen.fields, label: 'Create job with version B' }, { idempotencyKey: randomUUID() });
  await service.confirmDraft(identity, 'c1', { idempotencyKey: randomUUID() });

  const job = jobs.get('job-1');
  assert.deepEqual(
    [job.title, job.team, job.location, job.employmentType, job.openings],
    [chosen.fields.title, chosen.fields.department, chosen.fields.location, chosen.fields.employmentType, chosen.fields.headcount],
  );
  assert.equal(job.location, '远程');
  const stored = draftsById.get('job-1');
  assert.equal(stored.roleSummary, chosen.fields.roleSummary, 'the chosen version’s own prose, not another style');
  assert.deepEqual(stored.responsibilities, chosen.fields.responsibilities);
});
