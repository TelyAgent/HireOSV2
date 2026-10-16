// #232 -- the JD writing/review assistant keeps two languages apart: what goes into the document follows the
// document; what explains it to the user follows the interface. A caller without the interface language gets
// explanations in Chinese, as before.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DocAiService, languageRules } = require('../dist/copilot/doc-ai.service');

const identity = { workspaceId: 'ws-1', actorId: 'hr-1', roles: [] };
const blocks = [{ id: 'b1', kind: 'p', level: 'public', section: 'Responsibilities', text: '负责建设实时数据管道。' }];
function service(answer) {
  const prompts = [];
  const llm = { completeJson: async (system, messages) => { prompts.push({ system, user: messages[0].content }); return JSON.stringify(answer); } };
  const db = { aiRun: { create: async () => ({}) }, jobDocument: { findUnique: async () => ({ revision: 1, blocks }), update: async () => ({}), updateMany: async () => ({ count: 1 }) } };
  return { svc: new DocAiService(db, llm), prompts };
}
const section = (context) => ({ mode: 'draft', itemId: 'C1', label: 'Responsibilities', hint: 'Write the duties', list: true, context, blocks });

test('#232 AC-1/AC-2: English interface + Chinese document — content in Chinese, explanations in English, no "use Chinese" for explain', async () => {
  const { svc, prompts } = service({ items: ['负责建设和维护实时数据管道。'], explain: 'Drafted the duties from the existing paragraph.', toConfirm: [] });
  await svc.section(identity, 'job-1', section({ language: 'zh', uiLanguage: 'en' }));
  const { system } = prompts[0];
  assert.match(system, /写进文档的内容（items、suggestion）用中文/);
  assert.match(system, /explain: string — 一句话说明你写了什么 \/ 改了什么（用英文）/);
  assert.doesNotMatch(system, /（用中文）/);
});

test('#232 AC-1: Chinese interface + English document — content in English, review reason/summary in Chinese', async () => {
  const { svc, prompts } = service({ verdict: 'ready', summary: '整体清晰。', items: [] });
  await svc.analyze(identity, 'job-1', 'external', { context: { language: 'en', uiLanguage: 'zh' }, blocks });
  const { system } = prompts[0];
  assert.match(system, /reason、summary 是给用户看的说明，用中文/);
  assert.match(system, /写进文档的内容（items、suggestion）用英文/);
  assert.doesNotMatch(system, /suggestion 的语言与文档一致。'/);
});

test('#232 AC-3: without the interface language, explanations stay Chinese; the user\'s document is never sent to be translated', () => {
  assert.equal(languageRules({ language: 'en' }).explanation, '中文');
  assert.equal(languageRules({}).explanation, '中文');
  assert.match(languageRules({ language: 'en', uiLanguage: 'en' }).content, /不要翻译文档原文/);
});
