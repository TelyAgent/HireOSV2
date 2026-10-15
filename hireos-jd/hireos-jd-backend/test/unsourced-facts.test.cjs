// #95 -- AI section drafts never write years of experience or pay the job's data doesn't contain.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { separateUnsourced } = require('../dist/copilot/unsourced-facts');
const { DocAiService } = require('../dist/copilot/doc-ai.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const SEED = 'Review product data weekly and share findings\nCan write SQL queries';

test('list items with unsourced years or pay move to "to confirm"; sourced ones stay', () => {
  const { items, toConfirm } = separateUnsourced(
    ['Writes complex SQL queries', '3 年及以上数据分析经验', 'At least 2 years in analytics', 'Salary 15K–22K', 'Shares weekly findings with the team'],
    true,
    SEED,
  );
  assert.deepEqual(items, ['Writes complex SQL queries', 'Shares weekly findings with the team']);
  assert.deepEqual(toConfirm, ['3 年及以上数据分析经验', 'At least 2 years in analytics', 'Salary 15K–22K']);
  assert.deepEqual(separateUnsourced(['5 年以上经验'], true, '要求 5 年以上经验').items, ['5 年以上经验'], 'given years stay');
});

test('in a paragraph only the sentence carrying an unsourced figure moves', () => {
  const { items, toConfirm } = separateUnsourced(['You will review product data weekly. You need 3+ years of experience. You share findings.'], false, SEED);
  assert.equal(items.length, 1);
  assert.doesNotMatch(items[0], /3\+ years/);
  assert.match(items[0], /review product data weekly/);
  assert.deepEqual(toConfirm, ['You need 3+ years of experience.']);
});

test('#95 AC-1/AC-3: two runs on the minimal seed never write unsourced years or pay; the model’s own suggestions come back as toConfirm', async () => {
  const outputs = [
    { items: ['Review product data weekly and share findings', 'Write SQL queries for weekly reports', '1 年以上数据分析经验'], explain: 'x', toConfirm: ['Spreadsheet software'] },
    { items: ['Review product data every week', 'Mid-level 薪资 20K–30K', 'Use SQL to pull data'], explain: 'y', toConfirm: [] },
  ];
  let n = 0;
  const llm = { completeJson: async () => JSON.stringify(outputs[n++]) };
  const svc = new DocAiService({ aiRun: { create: async () => ({}) } }, llm);
  const body = {
    mode: 'draft', itemId: 'D1', label: 'Requirements', hint: 'h', list: true, current: [],
    context: { jobTitle: 'Data Analyst' },
    blocks: [{ id: 'b1', kind: 'ul', level: 'public', section: 'Responsibilities', text: SEED }],
  };
  const first = await svc.section(identity, 'job-1', body);
  const second = await svc.section(identity, 'job-1', body);
  for (const res of [first, second]) {
    assert.ok(res.items.every((x) => !/\d+\s*(年|years?)|\d+\s*[kK万]/.test(x)), JSON.stringify(res.items));
  }
  assert.deepEqual(first.toConfirm, ['1 年以上数据分析经验', 'Spreadsheet software']);
  assert.deepEqual(second.toConfirm, ['Mid-level 薪资 20K–30K']);
});
