/**
 * Where My Tasks was left (#408): its filter and view live in the URL, and the last URL and scroll position are
 * kept here, so a breadcrumb back from a task opens the list as it was rather than reset to All tasks.
 * No imports, so it can be tested as is.
 */
let lastSearch = "";
let lastScrollY = 0;

export function rememberTasksView(search: string, scrollY: number) {
  lastSearch = search;
  lastScrollY = scrollY;
}

/** The My Tasks link that returns to the list as it was left. */
export function tasksHref() {
  return `/tasks${lastSearch}`;
}

export function lastTasksScroll() {
  return lastScrollY;
}

const VIEWS = ["list", "cluster"] as const;
export type TasksView = (typeof VIEWS)[number];

/** The filter and view in a My Tasks URL; anything unknown falls back to the defaults (All tasks, list). */
export function readTasksParams<F extends string>(params: URLSearchParams, filters: readonly F[], fallback: F): { filter: F; view: TasksView } {
  const status = params.get("status");
  const view = params.get("view");
  return {
    filter: status && (filters as readonly string[]).includes(status) ? (status as F) : fallback,
    view: view && (VIEWS as readonly string[]).includes(view) ? (view as TasksView) : "list",
  };
}

/** The URL search for a filter and view, defaults left out so the plain /tasks link stays the default. */
export function tasksSearch(filter: string, view: TasksView, fallback: string) {
  const params = new URLSearchParams();
  if (filter !== fallback) params.set("status", filter);
  if (view !== "list") params.set("view", view);
  const text = params.toString();
  return text ? `?${text}` : "";
}
