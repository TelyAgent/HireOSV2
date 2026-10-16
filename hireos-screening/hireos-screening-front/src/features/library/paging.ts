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
