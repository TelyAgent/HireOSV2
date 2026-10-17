// #378 -- what a criterion's evidence panel says when it has nothing to show.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evidenceState } from "../../src/utils/evidence.ts";

const base = { name: "Design", max: 40, ai: 30, human: null, confidence: "Medium", coverage: "Full", evidence: "", source: "AI evaluation" };

test("#378 AC-3: rationale or excerpts to show, else the reason there are none", () => {
  assert.equal(evidenceState({ ...base, evidence: "Uses a queue." }), "ok");
  assert.equal(evidenceState({ ...base, quotes: [{ questionId: "q", text: "x", lineFrom: 1, lineTo: 1 }] }), "ok");
  assert.equal(evidenceState({ ...base }, "running"), "running");
  assert.equal(evidenceState({ ...base }, "pending"), "running");
  assert.equal(evidenceState({ ...base }, "failed"), "failed");
  assert.equal(evidenceState({ ...base, manual: true, source: "Manual scoring" }), "manual");
  assert.equal(evidenceState({ ...base, source: "Manual scoring" }), "manual", "finalized without an AI evaluation");
  assert.equal(evidenceState({ ...base }), "none");
});
