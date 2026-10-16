import { db } from "../db";
import type { Candidate } from "../fixtures/candidates";
import type { JobDiscoveryRun } from "../fixtures/jobDiscovery";
import { apiFetch } from "./shared";

/** F04 FR-5 / F06: what matching says about a candidate, separate from how many roles they're linked to. */
export const MATCH_STATUSES = [
  "not_started",
  "running",
  "recommendations",
  "recommendations_handled",
  "no_match",
  "no_open_jobs",
  "insufficient_data",
  "failed",
] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export interface LibraryEntry {
  candidate: Candidate;
  latestSource: string;
  matchStatus: MatchStatus;
  /** Why matching ended as it did, when it says (e.g. no role met the threshold). */
  matchReason?: string;
  linkedRoleCount: number;
  pendingRecommendationCount: number;
}

/** Search and filters (#171 #172); all optional, combined as an intersection. */
export interface LibraryFilters {
  q?: string;
  tag?: string;
  source?: string;
  owner?: string;
  matchStatus?: string;
  addedFrom?: string;
  addedTo?: string;
}

export interface LibraryList {
  /** The first `limit` candidates that match. */
  items: LibraryEntry[];
  /** How many candidates match the search and filters. */
  matched: number;
  /** Everyone in the library, for "N of M". */
  total: number;
  facets: Record<"tags" | "sources" | "owners", Array<{ value: string; count: number }>>;
}

/** One page of the library for the search and filters; `offset` is how many are already shown. */
export async function listLibraryEntries(filters: LibraryFilters = {}, offset = 0, limit = 100): Promise<LibraryList> {
  const params = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]?.trim()));
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const suffix = params.toString() ? `?${params}` : "";
  return apiFetch<LibraryList>(`/library${suffix}`);
}

export async function deleteCandidate(candidateId: string): Promise<void> {
  await apiFetch<void>(`/candidates/${candidateId}`, { method: "DELETE" });
}

export async function runMatchAgain(candidateId: string): Promise<JobDiscoveryRun> {
  const result = await apiFetch<JobDiscoveryRun>(`/candidates/${candidateId}/match`, { method: "POST" });
  db.jobDiscovery[candidateId] = result;
  return result;
}
