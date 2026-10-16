// #172 (review on PR #345) -- "Show more" pages by offset, one bounded page at a time, and appends without repeats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PAGE_SIZE, appendPage, nextPage } from "../../src/features/library/paging.ts";

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
