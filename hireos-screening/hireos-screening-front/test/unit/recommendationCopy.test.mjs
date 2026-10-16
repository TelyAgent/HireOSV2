// #181 #182 #184 -- recommendation statuses read the same everywhere, in both languages: a stale one says a
// newer run replaced it and shows no confidence; a recommendation the résumé rules out shows no confidence either.
import { test } from "node:test";
import assert from "node:assert/strict";
import { recommendationStatus, staleReason, showsConfidence, isActionable, RECOMMENDATION_STATUS } from "../../src/features/recommendations/recommendationCopy.ts";
import { ZH } from "../../src/data/i18n.ts";

test("#182 AC-1/AC-2: a stale recommendation reads as expired and replaced, never as pending, and can't be acted on", () => {
  const stale = { status: "stale", staleReason: "Replaced by a newer discovery run." };
  assert.equal(recommendationStatus(stale).label, "Expired — replaced by a newer match");
  assert.equal(staleReason(stale), "A newer matching run replaced this recommendation.");
  assert.equal(showsConfidence(stale), false);
  assert.equal(isActionable(stale), false);
  assert.equal(isActionable({ status: "proposed" }), true);
});

test("#181 AC-2: a not-eligible recommendation shows no confidence level", () => {
  assert.equal(showsConfidence({ status: "proposed", eligibility: "not_eligible" }), false);
  assert.equal(showsConfidence({ status: "proposed", eligibility: "eligible" }), true);
  assert.equal(showsConfidence({ status: "proposed" }), true, "unknown eligibility is not a conflict");
});

test("#184 AC-1/AC-2: statuses, the stale reason and the no-match reasons have Chinese text", () => {
  for (const { label } of Object.values(RECOMMENDATION_STATUS)) assert.ok(ZH[label], label);
  for (const key of ["A newer matching run replaced this recommendation.", "No current open role met the matching threshold.", "The AI matcher could not complete this run. Retry matching.", "No open jobs are available.", "Not eligible"]) {
    assert.ok(ZH[key], key);
    assert.doesNotMatch(ZH[key], /[A-Za-z]{4,}/, `${key} is translated`);
  }
});
