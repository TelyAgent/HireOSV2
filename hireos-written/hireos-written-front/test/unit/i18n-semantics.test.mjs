// #354 #355 #356 -- message pairs whose Chinese said something the English doesn't: who is notified, what the AI
// score is not, and what the candidate's result never contains.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ZH } from "../../src/data/i18n.ts";

test("#354: the person who acts triggers it; the original assignee is the one notified, and stays on record", () => {
  const zh = ZH["Startup Team Access: any valid employee can open and directly work these tasks — no claiming or manager approval required. The original assignee stays on record and is notified when you act."];
  assert.match(zh, /原负责人仍会保留在记录中/);
  assert.match(zh, /你执行操作时，系统会通知原负责人/);
  assert.doesNotMatch(zh, /你操作时会收到通知/);
});

test("#355: the AI overall is a draft and not a hiring probability — no promise that it doesn't count", () => {
  const zh = ZH["Draft only, not a hiring probability"];
  assert.match(zh, /草稿/);
  assert.match(zh, /不代表录用概率/);
  assert.doesNotMatch(zh, /不计入最终结果/);
});

test("#356: every 'internal answer key' message says reference answer, never rubric/scoring criteria", () => {
  const keys = Object.keys(ZH).filter((k) => /internal answer key/i.test(k));
  assert.equal(keys.length, 4);
  for (const key of keys) {
    assert.match(ZH[key], /内部参考答案/, key);
    assert.doesNotMatch(ZH[key], /评分标准/, key);
  }
  // The ranking and reviewer-notes limits stay, punctuation kept.
  assert.equal(ZH["Never includes: internal ranking, reviewer notes, or the internal answer key."], "绝不包含：内部排名、评审备注或内部参考答案。");
  assert.equal(ZH["Never includes internal ranking, reviewer notes, or the internal answer key."], "不包含内部排名、评审备注或内部参考答案。");
});
