// #198 -- the job workspace's filters round-trip through the URL (so Back and a refresh keep them) and each one,
// alone or combined, keeps exactly the matching candidates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { NO_FILTERS, isFiltered, matchesFilters, readFilters, writeFilters } from "../../src/lib/workspaceFilters.ts";

const rows = [
  { id: "a", eligibility: "needs_verification", decided: false, source: "email", ownerId: "hr-1", coverage: 0.75 },
  { id: "b", eligibility: "eligible", decided: true, source: "manual_upload", ownerId: "hr-2", coverage: 0.95 },
  { id: "c", eligibility: "eligible", decided: false, source: "email", ownerId: "hr-2", coverage: null },
];
const shown = (filters) => rows.filter((r) => matchesFilters(r, filters)).map((r) => r.id);

test("AC-1: filters survive the URL round trip; unset ones stay out of it, other parameters are kept", () => {
  const filters = { elig: "needs_verification", status: "awaiting", source: "email", owner: "hr-1", minCoverage: 70 };
  const params = writeFilters(new URLSearchParams("tab=x"), filters);
  assert.equal(params.toString(), "tab=x&elig=needs_verification&status=awaiting&source=email&owner=hr-1&cov=70");
  assert.deepEqual(readFilters(params), filters);
  assert.equal(writeFilters(params, NO_FILTERS).toString(), "tab=x");
  assert.deepEqual(readFilters(new URLSearchParams("status=bogus&cov=500")), NO_FILTERS, "nonsense reads as no filter");
});

test("AC-3: each filter alone, combined, and cleared", () => {
  assert.deepEqual(shown({ ...NO_FILTERS, elig: "needs_verification" }), ["a"]);
  assert.deepEqual(shown({ ...NO_FILTERS, status: "decided" }), ["b"]);
  assert.deepEqual(shown({ ...NO_FILTERS, status: "awaiting" }), ["a", "c"]);
  assert.deepEqual(shown({ ...NO_FILTERS, source: "email" }), ["a", "c"]);
  assert.deepEqual(shown({ ...NO_FILTERS, owner: "hr-2" }), ["b", "c"]);
  assert.deepEqual(shown({ ...NO_FILTERS, minCoverage: 90 }), ["b"], "no coverage yet doesn't pass a minimum");
  assert.deepEqual(shown({ ...NO_FILTERS, source: "email", owner: "hr-2" }), ["c"]);
  assert.deepEqual(shown({ ...NO_FILTERS, elig: "eligible", status: "awaiting", minCoverage: 50 }), []);
  assert.deepEqual(shown(NO_FILTERS), ["a", "b", "c"]);
  assert.equal(isFiltered(NO_FILTERS), false);
  assert.equal(isFiltered({ ...NO_FILTERS, minCoverage: 50 }), true);
});
