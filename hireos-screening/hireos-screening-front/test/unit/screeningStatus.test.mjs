// #187 #194 #196 -- the AI recommendation follows F08 BR-6 with its gates, the same everywhere; the person's
// status is "awaiting next step" until they decide, and a decision that differs from the AI is called out.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recommend, inferRecommendation, scoreBand, CAP_REASON } from "../../src/lib/recommendationRule.ts";
import { humanStatus, decisionDiffersFromAi, AWAITING_NEXT_STEP, DECISION_LABEL } from "../../src/features/screening/humanStatus.ts";
import { ZH } from "../../src/data/i18n.ts";

const high = { severity: "high", status: "open" };

test("#194 AC-4: the five bands follow BR-6", () => {
  assert.deepEqual([90, 85, 84, 70, 69, 50, 49, 30, 29].map(scoreBand), [
    "strong_advance", "strong_advance", "advance", "advance", "review", "review", "hold", "hold", "do_not_advance",
  ]);
});

test("#194 AC-1: a high score with an open high-severity concern and eligibility needing verification is capped at review", () => {
  const r = recommend({ overall: 92, eligibilityStatus: "needs_verification" }, [high]);
  assert.equal(r.outcome, "review");
  assert.deepEqual(r.cappedBy, ["open_high_concern", "needs_verification"]);
  assert.equal(inferRecommendation({ overall: 92, eligibilityStatus: "eligible" }, [high]), "review");
  assert.equal(inferRecommendation({ overall: 92, eligibilityStatus: "needs_verification" }), "review");
  // A cap never raises a lower band.
  assert.equal(inferRecommendation({ overall: 35, eligibilityStatus: "needs_verification" }, [high]), "hold");
});

test("#194 AC-2: once the concern is handled the recommendation follows the score again", () => {
  for (const status of ["confirmed", "dismissed", "accepted_risk"]) {
    assert.equal(inferRecommendation({ overall: 92, eligibilityStatus: "eligible" }, [{ severity: "high", status }]), "strong_advance", status);
  }
  assert.equal(inferRecommendation({ overall: 92, eligibilityStatus: "eligible" }, [{ severity: "medium", status: "open" }]), "strong_advance", "only high / blocker cap it");
});

test("#194 AC-3: not eligible and low coverage come before the score", () => {
  assert.deepEqual(recommend({ overall: 95, eligibilityStatus: "not_eligible" }, [high]), { outcome: "do_not_advance", cappedBy: ["not_eligible"] });
  assert.equal(inferRecommendation({ overall: 95, eligibilityStatus: "eligible", evaluationStatus: "insufficient_evidence" }), "review");
  assert.equal(inferRecommendation({ overall: null, eligibilityStatus: "eligible" }), "review");
  for (const reason of Object.values(CAP_REASON)) assert.ok(ZH[reason], reason);
});

test("#187 AC-1/AC-2: until a person decides, the status is 'awaiting next step', whatever the AI screening did", () => {
  assert.equal(humanStatus(undefined).label, AWAITING_NEXT_STEP);
  assert.equal(humanStatus(null).decided, false);
  assert.equal(humanStatus({ outcome: "advance", withdrawnAt: "2026-10-16" }).label, AWAITING_NEXT_STEP, "a withdrawn decision no longer counts");
  assert.equal(ZH[AWAITING_NEXT_STEP], "等待推进");
  const decided = humanStatus({ outcome: "strong_advance", decidedBy: "emma", decidedAt: "2026-10-16" });
  assert.deepEqual([decided.decided, decided.label], [true, "Strong advance"]);
  for (const label of Object.values(DECISION_LABEL)) assert.ok(ZH[label], label);
});

test("#196 AC-1/AC-2: AI 'do not advance' vs a person's 'strong advance' is called out; agreement or no decision isn't", () => {
  assert.equal(decisionDiffersFromAi("do_not_advance", { outcome: "strong_advance" }), true);
  assert.equal(decisionDiffersFromAi("advance", { outcome: "hold" }), true);
  assert.equal(decisionDiffersFromAi("strong_advance", { outcome: "advance" }), false);
  assert.equal(decisionDiffersFromAi("do_not_advance", null), false, "no decision: nothing is in effect yet");
  assert.equal(decisionDiffersFromAi("do_not_advance", { outcome: "strong_advance", withdrawnAt: "x" }), false);
});

test("#194 (review): every page shows the rule's outcome — not eligible stays 'do not advance' even with thin evidence", async () => {
  const { recommend, recommendationDisplay } = await import("../../src/lib/recommendationRule.ts");
  const show = (ev, concerns = []) => recommendationDisplay(recommend(ev, concerns));
  assert.deepEqual(show({ eligibilityStatus: "not_eligible", evaluationStatus: "insufficient_evidence", overall: null }), { outcome: "do_not_advance", insufficientEvidence: false });
  assert.deepEqual(show({ eligibilityStatus: "eligible", evaluationStatus: "insufficient_evidence", overall: null }), { outcome: "review", insufficientEvidence: true });
  assert.deepEqual(show({ eligibilityStatus: "needs_verification", evaluationStatus: "completed", overall: 90 }), { outcome: "review", insufficientEvidence: false });
  assert.equal(show(null), null);
});
