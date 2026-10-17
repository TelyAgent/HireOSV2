/**
 * The Question Bank's search, filters and selected question (#369). They live in the URL; the last ones are
 * kept for the session, so coming back -- through the main navigation or a question's breadcrumb -- opens
 * the bank as it was left. A link that carries its own filters wins; "Clear filters" goes back to all.
 * No imports, so it can be tested as is.
 */
export type BankFilters = { q: string; role: string; competency: string; selected: string };

const KEYS = ["q", "role", "competency", "selected"] as const;
let last = "";

export function readBankFilters(params: URLSearchParams): BankFilters {
  return {
    q: params.get("q") ?? "",
    role: params.get("role") || "all",
    competency: params.get("competency") || "all",
    selected: params.get("selected") ?? "",
  };
}

/** The URL search for these filters, defaults left out. */
export function bankSearch(filters: BankFilters) {
  const params = new URLSearchParams();
  for (const key of KEYS) {
    const value = filters[key];
    if (value && value !== "all") params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function rememberBank(search: string) {
  last = search;
}

/**
 * What a visit to the bank should show: its own filters when the URL has any, else the ones last used this
 * session (null when there is nothing to restore).
 */
export function bankRestore(currentSearch: string): string | null {
  if (currentSearch && currentSearch !== "?") return null;
  return last || null;
}
