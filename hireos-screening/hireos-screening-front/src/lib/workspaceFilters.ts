/**
 * The job workspace's linked-candidate filters (#198), kept in the page's URL so the browser's Back, a refresh
 * and a shared link all show the same list. Unset filters stay out of the URL.
 */
export type WorkspaceFilters = {
  /** Eligibility status, or "all". */
  elig: string;
  /** The person's status: decided, awaiting a decision, or "all". */
  status: "all" | "decided" | "awaiting";
  /** Latest résumé source, or "all". */
  source: string;
  /** Candidate owner, or "all". */
  owner: string;
  /** Lowest coverage shown, in percent (0 = no limit). */
  minCoverage: number;
};

export const NO_FILTERS: WorkspaceFilters = { elig: "all", status: "all", source: "all", owner: "all", minCoverage: 0 };

const KEYS = { elig: "elig", status: "status", source: "source", owner: "owner", minCoverage: "cov" } as const;

export function readFilters(params: URLSearchParams): WorkspaceFilters {
  const status = params.get(KEYS.status);
  const coverage = Number(params.get(KEYS.minCoverage));
  return {
    elig: params.get(KEYS.elig) || "all",
    status: status === "decided" || status === "awaiting" ? status : "all",
    source: params.get(KEYS.source) || "all",
    owner: params.get(KEYS.owner) || "all",
    minCoverage: Number.isFinite(coverage) && coverage > 0 && coverage <= 100 ? Math.round(coverage) : 0,
  };
}

/** The URL's query with these filters written into it, other parameters kept. */
export function writeFilters(params: URLSearchParams, filters: WorkspaceFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const [field, key] of Object.entries(KEYS) as Array<[keyof WorkspaceFilters, string]>) {
    const value = filters[field];
    if (value === NO_FILTERS[field]) next.delete(key);
    else next.set(key, String(value));
  }
  return next;
}

export function isFiltered(filters: WorkspaceFilters): boolean {
  return (Object.keys(NO_FILTERS) as Array<keyof WorkspaceFilters>).some((field) => filters[field] !== NO_FILTERS[field]);
}

export type FilterableRow = { eligibility?: string; decided: boolean; source?: string; ownerId?: string; coverage?: number | null };

export function matchesFilters(row: FilterableRow, filters: WorkspaceFilters): boolean {
  if (filters.elig !== "all" && row.eligibility !== filters.elig) return false;
  if (filters.status === "decided" && !row.decided) return false;
  if (filters.status === "awaiting" && row.decided) return false;
  if (filters.source !== "all" && row.source !== filters.source) return false;
  if (filters.owner !== "all" && row.ownerId !== filters.owner) return false;
  if (filters.minCoverage > 0 && (row.coverage == null || row.coverage * 100 < filters.minCoverage)) return false;
  return true;
}
