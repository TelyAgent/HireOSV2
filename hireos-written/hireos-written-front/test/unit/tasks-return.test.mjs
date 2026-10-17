// #408 -- My Tasks keeps its filter and view in the URL and remembers them for the way back from a task.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastTasksScroll, readTasksParams, rememberTasksView, tasksHref, tasksSearch } from "../../src/utils/tasksReturn.ts";

const FILTERS = ["all", "pending_test", "test_sent"];

test("#408 AC-1: the filter and view round-trip through the URL; defaults stay out of it", () => {
  assert.equal(tasksSearch("all", "list", "all"), "");
  assert.equal(tasksSearch("pending_test", "list", "all"), "?status=pending_test");
  assert.equal(tasksSearch("pending_test", "cluster", "all"), "?status=pending_test&view=cluster");
  assert.deepEqual(readTasksParams(new URLSearchParams("status=pending_test&view=cluster"), FILTERS, "all"), { filter: "pending_test", view: "cluster" });
});

test("#408 AC-2: unknown values fall back to All tasks in the list view", () => {
  assert.deepEqual(readTasksParams(new URLSearchParams("status=nope&view=grid"), FILTERS, "all"), { filter: "all", view: "list" });
  assert.deepEqual(readTasksParams(new URLSearchParams(""), FILTERS, "all"), { filter: "all", view: "list" });
});

test("#408 AC-1: the breadcrumb back goes to the list as it was left, with its scroll position", () => {
  rememberTasksView("?status=pending_test", 640);
  assert.equal(tasksHref(), "/tasks?status=pending_test");
  assert.equal(lastTasksScroll(), 640);
});
