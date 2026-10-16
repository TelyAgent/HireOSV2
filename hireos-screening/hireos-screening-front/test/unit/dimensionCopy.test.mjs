// #180 -- work authorization isn't a screening factor: the default compensation & location wording names
// salary and work location only, new drafts start from it, and older confirmed wording is flagged, not rewritten.
import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPENSATION_LOCATION_RUBRIC, LEGACY_COMPENSATION_LOCATION_RUBRIC, currentRubric, mentionsAuthorization } from "../../src/features/jobs/dimensionCopy.ts";
import { ZH } from "../../src/data/i18n.ts";

test("#180 AC-1: the default wording no longer claims authorization, in English and Chinese", () => {
  assert.equal(mentionsAuthorization(COMPENSATION_LOCATION_RUBRIC), false);
  assert.ok(!mentionsAuthorization(ZH[COMPENSATION_LOCATION_RUBRIC]));
  assert.match(ZH[COMPENSATION_LOCATION_RUBRIC], /薪资期望.*工作地点/);
});

test("#180 AC-1/AC-2: a new draft starts from the current wording; custom wording is kept; old wording is flagged", () => {
  assert.equal(currentRubric(LEGACY_COMPENSATION_LOCATION_RUBRIC), COMPENSATION_LOCATION_RUBRIC);
  assert.equal(currentRubric("Salary within the approved band."), "Salary within the approved band.");
  assert.ok(mentionsAuthorization(LEGACY_COMPENSATION_LOCATION_RUBRIC));
  assert.ok(ZH["Work authorization isn't used in screening — only salary expectation and work location are assessed."]);
});
