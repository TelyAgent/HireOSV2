// #206 #208 -- the round-changes panel tells "first snapshot" from "no change since vN", words each change in the
// interface language, and every system string on the comparison page has a Chinese translation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { describeChange, purposeLabel, roundChangesView } from "../../src/lib/snapshotChanges.ts";
import { ZH } from "../../src/data/i18n.ts";
import { DIMENSION_POOL } from "../../src/data/fixtures/jobs.ts";

const zh = (s) => ZH[s] ?? s;
const en = (s) => s;

test("#206 AC-1: v1 is the first snapshot; a later one without changes says so instead", () => {
  assert.deepEqual(roundChangesView({ version: 1, changesSinceLast: null }, en), { state: "first" });
  assert.deepEqual(roundChangesView({ version: 1, changesSinceLast: [] }, en), { state: "first" }, "older snapshots stored [] on the first");
  assert.deepEqual(roundChangesView({ version: 2, changesSinceLast: [] }, en), { state: "unchanged", previousVersion: 1 });
});

test("#206 AC-2: each change of a later snapshot is listed; old English sentences are kept as they are", () => {
  const view = roundChangesView({ version: 3, changesSinceLast: [
    { kind: "dimension", applicationId: "a", candidateName: "Ann", dimension: "Skills", from: 80, to: 65 },
    { kind: "rank", applicationId: "a", candidateName: "Ann", from: 1, to: null },
    "Ben added to the comparison.",
  ] }, en);
  assert.deepEqual(view, { state: "changed", lines: ["Ann: Skills score 80 → 65.", "Ann: rank 1 → unranked.", "Ben added to the comparison."] });
});

test("#208 AC-1/AC-2: the same changes read in Chinese, names and user text untouched", () => {
  assert.equal(describeChange({ kind: "dimension", applicationId: "a", candidateName: "Ann", dimension: "Compensation & Location Fit", from: 50, to: 70 }, zh), "Ann：薪酬与地点匹配 得分 50 → 70。");
  assert.equal(describeChange({ kind: "eligibility", applicationId: "b", candidateName: "王小明", from: "needs_verification", to: "not_eligible" }, zh), "王小明：资格状态 需要核实 → 不符合条件。");
  assert.equal(describeChange({ kind: "added", applicationId: "c", candidateName: "Cai" }, zh), "Cai 加入了对比。");
  assert.equal(purposeLabel("Shortlist review — Backend Engineer", zh), "候选名单评审 — Backend Engineer");
  assert.equal(purposeLabel("My own purpose", zh), "My own purpose");
});

test("#208 AC-3: every built-in dimension name, change template and snapshot note has a Chinese translation", () => {
  const templates = ["{name} was added to the comparison.", "{name} was removed from the comparison.", "{name}: overall score {from} → {to}.",
    "{name}: rank {from} → {to}.", "{name}: eligibility {from} → {to}.", "{name}: {dimension} score {from} → {to}.", "unknown", "unranked",
    "No change since v{n}: the same members, scores and ranks.", "Generated from the current screening evaluation baseline.", "Shortlist review"];
  const missing = [...DIMENSION_POOL, ...templates].filter((key) => !ZH[key]);
  assert.deepEqual(missing, []);
});
