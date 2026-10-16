/**
 * Paging the Resume Library (#172, review on PR #345): "Show more" asks for the next page by offset — always
 * one page of PAGE_SIZE, never a growing limit the server would refuse — and appends it without repeats.
 */
export const PAGE_SIZE = 100;

export type Page<T> = { items: T[]; matched: number; total: number };

export function nextPage(shown: number): { offset: number; limit: number } {
  return { offset: shown, limit: PAGE_SIZE };
}

export function appendPage<T, P extends Page<T>>(current: P, next: P, key: (item: T) => string): P {
  const seen = new Set(current.items.map(key));
  return { ...next, items: [...current.items, ...next.items.filter((item) => !seen.has(key(item)))] };
}

/**
 * Only the latest request counts: each start gets a number, and a response whose number is no longer the
 * latest (an earlier search, or a page for a search since replaced) is dropped (#172, review on PR #345).
 */
export function requestGate() {
  let latest = 0;
  return {
    start: () => ++latest,
    isLatest: (id: number) => id === latest,
  };
}

/**
 * "Show more" extends only the list of the search on screen, once its first page is there: while a new search's
 * first page is on its way, or the list belongs to an earlier search, there is nothing to extend (#172 review).
 */
export function canLoadMore(state: { hasList: boolean; loadingMore: boolean; refreshing: boolean; listKey: string | null; filtersKey: string }): boolean {
  return state.hasList && !state.loadingMore && !state.refreshing && state.listKey === state.filtersKey;
}

/** The largest page the server returns. */
export const MAX_PAGE = 500;

/**
 * The requests that bring back what was on screen before opening a candidate: as many candidates as were
 * loaded, in pages the server accepts, so the scroll position lands on the same row (#173, review on PR #345).
 */
export function pagesToRestore(loaded: number): Array<{ offset: number; limit: number }> {
  const want = Math.max(PAGE_SIZE, loaded);
  const pages = [];
  for (let offset = 0; offset < want; offset += MAX_PAGE) pages.push({ offset, limit: Math.min(MAX_PAGE, want - offset) });
  return pages;
}
