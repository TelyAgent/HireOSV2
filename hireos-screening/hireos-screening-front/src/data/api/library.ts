import { db } from "../db";
import type { Candidate } from "../fixtures/candidates";
import type { JobDiscoveryRun } from "../fixtures/jobDiscovery";
import { apiFetch } from "./shared";

export type MatchStatus = "linked" | "pending" | "no_match" | "failed" | "not_matched" | "running";

export interface LibraryEntry {
  candidate: Candidate;
  latestSource: string;
  matchStatus: MatchStatus;
  linkedRoleCount: number;
  pendingRecommendationCount: number;
}

export async function listLibraryEntries(query?: string): Promise<LibraryEntry[]> {
  const suffix = query ? `?q=${encodeURIComponent(query)}` : "";
  return apiFetch<LibraryEntry[]>(`/library${suffix}`);
}

export async function deleteCandidate(candidateId: string): Promise<void> {
  await apiFetch<void>(`/candidates/${candidateId}`, { method: "DELETE" });
}

export async function runMatchAgain(candidateId: string): Promise<JobDiscoveryRun> {
  const result = await apiFetch<JobDiscoveryRun>(`/candidates/${candidateId}/match`, { method: "POST" });
  db.jobDiscovery[candidateId] = result;
  return result;
}
