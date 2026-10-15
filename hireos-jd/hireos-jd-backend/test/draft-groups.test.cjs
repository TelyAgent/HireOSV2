// #86 -- requirements a manual JD writes in groups keep their group in the draft, so the document can show it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fieldsToDraftContent } = require('../dist/copilot/draft-mapping');
const { jdFieldsSchema } = require('../dist/copilot/types');

const fields = {
  title: 'AI应用算法工程师',
  responsibilities: ['需求与问题定义', '数据飞轮与治理'],
  mustHave: ['计算机相关专业', '有顶会论文加分', '熟悉 RAG', '能搭建评测'],
  mustHaveGroups: ['1.基础条件', '1.基础条件', '2.专业能力', '2.专业能力'],
  niceToHave: ['开源贡献'],
};

test('#86 AC-1: each requirement carries the group it was written under, in order', () => {
  assert.equal(jdFieldsSchema.safeParse(fields).success, true);
  const { requirements } = fieldsToDraftContent(fields);
  assert.deepEqual(
    requirements.map((r) => [r.label, r.priority, r.group]),
    [
      ['计算机相关专业', 'must_have', '1.基础条件'],
      ['有顶会论文加分', 'must_have', '1.基础条件'],
      ['熟悉 RAG', 'must_have', '2.专业能力'],
      ['能搭建评测', 'must_have', '2.专业能力'],
      ['开源贡献', 'preferred', undefined],
    ],
  );
});

test('#86 AC-3: ungrouped requirements are unchanged; groups that do not line up with the items are ignored', () => {
  const plain = fieldsToDraftContent({ mustHave: ['Node.js', 'SQL'] }).requirements;
  assert.deepEqual(plain.map((r) => Object.keys(r).includes('group')), [false, false]);
  const mismatched = fieldsToDraftContent({ mustHave: ['Node.js', 'SQL'], mustHaveGroups: ['Basics'] }).requirements;
  assert.deepEqual(mismatched.map((r) => r.group), [undefined, undefined]);
  const partly = fieldsToDraftContent({ mustHave: ['Node.js', 'SQL'], mustHaveGroups: ['', 'Skills'] }).requirements;
  assert.deepEqual(partly.map((r) => r.group), [undefined, 'Skills']);
});
