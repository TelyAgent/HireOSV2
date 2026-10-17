// #214 -- a recorded decision's process state never reads "Approved": recorded, awaiting an exception, handed off,
// queued, failed and withdrawn are told apart, in both languages, separately from the outcome.
import { test } from "node:test";
import assert from "node:assert/strict";
import { decisionStateLabel } from "../../src/lib/decisionState.ts";
import { ZH } from "../../src/data/i18n.ts";

const cases = [
  [{ status: "approved", nextStepTarget: "record_only", handoffStatus: "none" }, "Decision recorded", "决策已记录"], // Hold / Reject
  [{ status: "pending_approval" }, "Awaiting exception approval", "待例外审批"],
  [{ status: "approved", nextStepTarget: "move_to_interview", handoffStatus: "sent" }, "Handed off to Interview", "已交接至面试"],
  [{ status: "approved", nextStepTarget: "send_assessment", handoffStatus: "queued" }, "Handoff to Written Test queued", "等待交接至笔试"],
  [{ status: "approved", nextStepTarget: "move_to_interview", handoffStatus: "failed" }, "Handoff failed — retrying stopped", "交接失败，已停止自动重试"],
  [{ status: "withdrawn", nextStepTarget: "move_to_interview" }, "Withdrawn", "已撤回"],
  [{ status: "approved" }, "Decision recorded", "决策已记录"], // an older payload without handoffStatus
];

test("#214 AC-1/AC-2/AC-4: each state has its own label and none says Approved", () => {
  for (const [decision, en, zh] of cases) {
    const key = decisionStateLabel(decision);
    assert.equal(key, en, JSON.stringify(decision));
    assert.equal(ZH[key], zh, `zh for ${key}`);
    assert.doesNotMatch(key, /approved/i);
  }
});
