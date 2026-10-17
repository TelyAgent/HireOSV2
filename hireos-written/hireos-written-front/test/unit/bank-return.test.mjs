// #369 -- the Question Bank's search, filters and preview live in the URL and come back on the way back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bankRestore, bankSearch, readBankFilters, rememberBank } from "../../src/utils/bankReturn.ts";

test("#369 AC-2: filters round-trip through the URL, defaults left out", () => {
  const filters = { q: "Q-0001", role: "高级 AI 产品经理", competency: "Workflow设计与流程建模", selected: "q-1" };
  const search = bankSearch(filters);
  assert.deepEqual(readBankFilters(new URLSearchParams(search)), filters);
  assert.equal(bankSearch({ q: "", role: "all", competency: "all", selected: "" }), "");
  assert.deepEqual(readBankFilters(new URLSearchParams("")), { q: "", role: "all", competency: "all", selected: "" });
});

test("#369 AC-2/AC-3: a bare visit restores the last filters; a link with its own filters keeps them", () => {
  rememberBank("");
  assert.equal(bankRestore(""), null, "nothing used yet: the defaults");
  rememberBank("?q=Q-0001&role=PM");
  assert.equal(bankRestore(""), "?q=Q-0001&role=PM", "back through the main navigation");
  assert.equal(bankRestore("?role=Other"), null, "a link's own filters win");
});
