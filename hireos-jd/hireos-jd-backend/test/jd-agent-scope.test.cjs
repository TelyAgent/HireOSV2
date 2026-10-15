// #98 #103 #104 #106 #107 -- what the JD Copilot answers, refuses and proposes; annual salary math.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixAnnualSalary, workflowGuide, OUT_OF_SCOPE_REPLY } = require('../dist/copilot/jd-agent-scope');
const { DocRewriteService } = require('../dist/copilot/doc-rewrite.service');
const { PromptRegistry } = require('../dist/copilot/prompt-registry');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: ['hr'], kind: 'session' };
const DOC = 'Data Analyst\n- Can write SQL queries.\nCompensation: 15K–22K / month';

/** Fake LLM: answers by system-prompt role, records every call. */
function fakeLlm({ intent = 'answer', answer = 'SQL 指能写查询语句。', rewrite, web } = {}) {
  const calls = [];
  return {
    calls,
    completeJson: async (system, turns) => {
      calls.push({ kind: 'json', system, input: turns[0].content });
      if (system.includes('意图分类器')) return JSON.stringify({ intent });
      if (system.includes('只输出 JSON：{"answer"')) return JSON.stringify({ answer });
      return JSON.stringify(rewrite);
    },
    answerWithWebSearch: async (instructions, input) => {
      calls.push({ kind: 'web', instructions, input });
      return web ?? { text: '上海中级数据分析师月薪约 15K–25K。数据口径：日期未知，样本量未知。', sources: [{ title: 'jobui', url: 'https://www.jobui.com/x' }] };
    },
  };
}
function service(llm) {
  const runs = [];
  const db = { aiRun: { create: async ({ data }) => runs.push(data) } };
  return { svc: new DocRewriteService(db, llm), runs };
}
const ask = (svc, body) =>
  svc.ask(identity, 'job-1', 'internal', { context: { jobTitle: 'Data Analyst', documentText: DOC }, ...body });
const selection = (text) => ({ text, target: { kind: 'ul', items: [text] }, scope: 'items' });

test('#98 AC-1: annual pay is recomputed from the answer\'s own monthly range and bonus months', () => {
  const text = '税前月薪 15K–22K，年终奖 1–2 个月，全年约 16.5万–48.4万元。';
  assert.match(fixAnnualSalary(text), /全年约19\.5万–30\.8万元/);
  const right = '月薪 15K-22K，年终奖 1-2 个月，年薪约 19.5万–30.8万元。';
  assert.equal(fixAnnualSalary(right), right);
  assert.match(fixAnnualSalary('月薪 15K–22K，年薪约 18万–26.4万元。'), /奖金口径未注明，此年薪未经换算核实/);
  assert.equal(fixAnnualSalary('月薪 15K–22K。'), '月薪 15K–22K。');
});

test('#107 AC-1: "explain, don\'t modify" with a selection is answered, never a proposal', async () => {
  const llm = fakeLlm({ intent: 'edit' }); // even a wrong classifier can't turn it into an edit
  const { svc } = service(llm);
  const res = await ask(svc, { message: '请解释这项要求的含义，只回答，不修改文档', selection: selection('Can write SQL queries.') });
  assert.equal(res.kind, 'answer');
  assert.equal(res.contextScope, 'selection');
  assert.ok(!llm.calls.some((c) => c.system?.includes('写作助手')), 'the rewrite prompt is never called');
});

test('#106 AC-1/AC-2: with no selection a JD question is answered from the whole document and the page status', async () => {
  const llm = fakeLlm({ intent: 'answer', answer: '还不能：缺少 Level 和职位概述。' });
  const { svc } = service(llm);
  const res = await svc.ask(identity, 'job-1', 'internal', {
    message: '现在这份 JD 可以提交审批吗？',
    context: { jobTitle: 'Data Analyst', documentText: DOC, readiness: '2 项必填缺失：Level、职位概述；发布按钮不可用' },
  });
  assert.deepEqual([res.kind, res.contextScope], ['answer', 'document']);
  const answerCall = llm.calls.find((c) => c.system?.includes('只输出 JSON：{"answer"'));
  assert.match(answerCall.input, /Can write SQL queries/);
  assert.match(answerCall.input, /发布按钮不可用/);
  assert.match(answerCall.system, /提交审批.*尚未上线/);
});

test('#106 AC-3 / #107 AC-2: a market question goes to research with sources, not a same-as-original proposal', async () => {
  const llm = fakeLlm({ intent: 'research' });
  const { svc, runs } = service(llm);
  const res = await ask(svc, { message: '这个岗位在上海的市场薪资是多少？', selection: selection('Compensation: 15K–22K / month') });
  assert.equal(res.kind, 'answer');
  assert.equal(res.intent, 'research');
  assert.equal(res.sources.length, 1);
  assert.match(llm.calls.find((c) => c.kind === 'web').instructions, /数据口径/);
  assert.deepEqual(runs.map((r) => r.capabilityCode), ['jd_doc_research']);
});

test('#107 AC-2: an edit that comes back identical is "no change", not a proposal', async () => {
  const llm = fakeLlm({ intent: 'edit', rewrite: { items: ['Can write SQL queries.'], explain: '原文已经清楚。', reason: '' } });
  const { svc } = service(llm);
  const res = await ask(svc, { message: '改得更专业一点', selection: selection('Can write SQL queries.') });
  assert.deepEqual(res, { kind: 'no_change', explain: '原文已经清楚。' });
});

test('#107 AC-3: a real edit still returns the proposal', async () => {
  const llm = fakeLlm({ intent: 'edit', rewrite: { items: ['Writes complex SQL (joins, window functions).'], explain: '更具体', reason: '' } });
  const { svc } = service(llm);
  const res = await ask(svc, { message: '改得更具体', selection: selection('Can write SQL queries.') });
  assert.equal(res.kind, 'edit');
  assert.deepEqual(res.items, ['Writes complex SQL (joins, window functions).']);
});

test('#106: an edit with nothing selected asks for a target instead of guessing', async () => {
  const { svc } = service(fakeLlm({ intent: 'edit' }));
  assert.deepEqual(await ask(svc, { message: '把要求改得更具体' }), { kind: 'needs_target' });
});

test('#104 AC-1/AC-2: off-topic gets the scope reply, with no web search and no AI run', async () => {
  const llm = fakeLlm({ intent: 'off_topic' });
  const { svc, runs } = service(llm);
  const res = await ask(svc, { message: '今天天气怎么样？' });
  assert.equal(res.text, OUT_OF_SCOPE_REPLY);
  assert.match(res.text, /超出了职位工作区的范围/);
  assert.ok(!llm.calls.some((c) => c.kind === 'web'));
  assert.equal(runs.length, 0);
});

test('#103 AC-1/AC-3: "submit, approve and publish it" explains the HireOS flow and never acts', async () => {
  const llm = fakeLlm({ intent: 'action' });
  const { svc, runs } = service(llm);
  const res = await ask(svc, { message: '帮我提交审批、批准并发布这个职位' });
  assert.match(res.text, /不能代你提交审批、批准或发布/);
  assert.match(res.text, /尚未上线/);
  assert.doesNotMatch(res.text, /ATS|HR 系统|无法.*创建/);
  assert.equal(runs.length, 0);
  assert.match(workflowGuide(), /新建职位.*用此草稿创建职位/);
  assert.match(workflowGuide('1 项必填缺失'), /当前的检查结果：1 项必填缺失/);
});

test('#103 #104: the global Agent\'s chat prompt carries the same scope and HireOS facts', () => {
  const prompt = new PromptRegistry().jdIntakeSystemPrompt;
  assert.match(prompt, /HireOS 可以创建职位/);
  assert.match(prompt, /不要让用户去其他 ATS/);
  assert.match(prompt, /超出了职位工作区的范围/);
});

test('#106: the status context the page sends (up to 6000 chars) is accepted', async () => {
  const { svc } = service(fakeLlm({ intent: 'answer' }));
  const res = await svc.ask(identity, 'job-1', 'internal', { message: '能提交吗？', context: { documentText: DOC, readiness: 'x'.repeat(6000) } });
  assert.equal(res.kind, 'answer');
});
