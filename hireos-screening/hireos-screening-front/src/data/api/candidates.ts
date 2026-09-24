import { db } from "../db";
import type { Candidate } from "../fixtures/candidates";
import type { Application } from "../fixtures/applications";
import type { CandidateJobRecommendation } from "../fixtures/recommendations";
import type { JobDiscoveryRun } from "../fixtures/jobDiscovery";
import { apiFetch } from "./shared";
import { listJobs } from "./jobs";

export interface CandidateDetail {
  candidate: Candidate;
  resumeVersions: (typeof db.resumeVersions)[string];
  applications: Application[];
  recommendations: CandidateJobRecommendation[];
  jobDiscovery: JobDiscoveryRun & { isMatching: boolean };
}

interface RawMatchingStatus {
  isMatching: boolean;
  lastRun: { status: string; jobsScanned: number; reason: { message?: string } | null; lastRunAt: string; completedAt: string | null } | null;
}

function toJobDiscovery(matching: RawMatchingStatus): JobDiscoveryRun & { isMatching: boolean } {
  return {
    status: matching.isMatching ? "running" : ((matching.lastRun?.status as JobDiscoveryRun["status"]) ?? "not_started"),
    lastRunAt: matching.lastRun?.lastRunAt ?? null,
    jobsScanned: matching.lastRun?.jobsScanned ?? 0,
    reason: matching.lastRun?.reason?.message,
    isMatching: matching.isMatching,
  };
}

export async function getCandidateDetail(id: string): Promise<CandidateDetail> {
  const [detail] = await Promise.all([
    apiFetch<{
      candidate: Candidate;
      resumeVersions: (typeof db.resumeVersions)[string];
      applications: Application[];
      recommendations: CandidateJobRecommendation[];
      matching: RawMatchingStatus;
    }>(`/candidates/${id}`),
    listJobs(),
  ]);
  return { ...detail, jobDiscovery: toJobDiscovery(detail.matching) };
}

export interface CorrectProfileInput {
  location?: string;
  compensationMin?: number;
  compensationMax?: number;
  reason: string;
}

/** Corrections create a new profile snapshot conceptually and mark related
 * evaluations stale — they never rewrite the original source material. */
export async function correctProfile(candidateId: string, input: CorrectProfileInput): Promise<Candidate> {
  return apiFetch<Candidate>(`/candidates/${candidateId}/profile`, { method: "PATCH", body: JSON.stringify(input) });
}

/** Only a human LinkDecision.confirm creates or reuses an Application — this
 * is the sole path that turns a proposal into a real recruiting case. */
export async function confirmJobLink(recommendationId: string, opts: { reason?: string; confirmedBy: "emma" | "daniel" | "morgan" }): Promise<Application> {
  return apiFetch<Application>(`/recommendations/${recommendationId}/confirm-link`, {
    method: "POST",
    body: JSON.stringify({ reason: opts.reason }),
  });
}

export async function dismissRecommendation(recommendationId: string): Promise<void> {
  await apiFetch(`/recommendations/${recommendationId}/dismiss`, { method: "POST" });
}

export async function deferRecommendation(recommendationId: string): Promise<void> {
  await apiFetch(`/recommendations/${recommendationId}/defer`, { method: "POST" });
}

export async function addManualRecommendation(candidateId: string, jobId: string): Promise<CandidateJobRecommendation> {
  return apiFetch<CandidateJobRecommendation>(`/candidates/${candidateId}/jobs/${jobId}/recommend`, { method: "POST" });
}

export interface JobRecommendation extends CandidateJobRecommendation {
  candidateName?: string;
}

/** Pending AI proposals for one job -- the "Suggested candidates" list on the
 * screening workspace. Only "proposed" recommendations are returned; once a
 * recruiter confirms, dismisses, or defers one it belongs in a different view. */
export async function getJobRecommendations(jobId: string): Promise<JobRecommendation[]> {
  return apiFetch<JobRecommendation[]>(`/jobs/${jobId}/recommendations`);
}
