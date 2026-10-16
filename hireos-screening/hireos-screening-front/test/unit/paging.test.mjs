// #172 (review on PR #345) -- "Show more" pages by offset, one bounded page at a time, and appends without repeats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE, appendPage, canLoadMore, nextPage, requestGate } from "../../src/features/library/paging.ts";

test("every page request stays within the server's limit, however far the user scrolls", () => {
  for (const shown of [0, 100, 500, 900, 1100]) {
    const { offset, limit } = nextPage(shown);
    assert.equal(offset, shown);
    assert.equal(limit, PAGE_SIZE);
    assert.ok(limit <= 500);
  }
});

test("a page is appended after what is shown, without repeating anyone, with the latest counts", () => {
  const current = { items: [{ id: "a" }, { id: "b" }], matched: 4, total: 9 };
  const next = { items: [{ id: "b" }, { id: "c" }, { id: "d" }], matched: 4, total: 10 };
  const merged = appendPage(current, next, (x) => x.id);
  assert.deepEqual(merged.items.map((x) => x.id), ["a", "b", "c", "d"]);
  assert.deepEqual([merged.matched, merged.total], [4, 10]);
});

test("a late response for an earlier search or page is dropped; only the latest request counts", () => {
  const gate = requestGate();
  const morePage = gate.start(); // "Show more" for the old search
  const newSearch = gate.start(); // the user changes a filter
  assert.equal(gate.isLatest(newSearch), true);
  assert.equal(gate.isLatest(morePage), false, "the old page arriving after the new search is not appended");
  const another = gate.start();
  assert.equal(gate.isLatest(newSearch), false, "nor is a first page overtaken by a later one");
  assert.equal(gate.isLatest(another), true);
});

test("\"Show more\" waits for the new search's first page and never extends a list from an earlier search", () => {
  const base = { hasList: true, loadingMore: false, refreshing: false, listKey: '{"q":"sql"}', filtersKey: '{"q":"sql"}' };
  assert.equal(canLoadMore(base), true);
  assert.equal(canLoadMore({ ...base, refreshing: true }), false, "the new first page is still on its way");
  assert.equal(canLoadMore({ ...base, filtersKey: '{"q":"java"}' }), false, "the list on screen is for the old search");
  assert.equal(canLoadMore({ ...base, loadingMore: true }), false);
  assert.equal(canLoadMore({ ...base, hasList: false }), false);
});
