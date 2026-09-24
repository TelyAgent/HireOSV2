import { db, getApplicationsForCandidate, getRecsForCandidate, getCandidate } from "../db";
import type { Candidate } from "../fixtures/candidates";
import type { Application } from "../fixtures/applications";
import type { CandidateJobRecommendation } from "../fixtures/recommendations";
import type { JobDiscoveryRun } from "../fixtures/jobDiscovery";
import { uid, daysAgo } from "../../lib/daysAgo";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";
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
  if (isRealApi()) {
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
  await delay();
  const candidate = getCandidate(id);
  if (!candidate) throw new ApiError("NOT_FOUND", `Candidate ${id} not found`);
  const run = db.jobDiscovery[id] || { status: "not_started" as const, lastRunAt: null, jobsScanned: 0 };
  return {
    candidate,
    resumeVersions: db.resumeVersions[id] || [],
    applications: getApplicationsForCandidate(id),
    recommendations: getRecsForCandidate(id),
    jobDiscovery: { ...run, isMatching: run.status === "running" },
  };
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
  if (isRealApi()) {
    return apiFetch<Candidate>(`/candidates/${candidateId}/profile`, { method: "PATCH", body: JSON.stringify(input) });
  }
  const candidate = getCandidate(candidateId);
  if (!candidate) throw new ApiError("NOT_FOUND", `Candidate ${candidateId} not found`);
  if (!input.reason.trim()) throw new ApiError("REASON_REQUIRED", "A reason is required");
  await delay();
  if (input.location) candidate.contact.location = { value: input.location, status: "known" };
  if (input.compensationMin != null && input.compensationMax != null) {
    candidate.compensationExpectation = {
      min: input.compensationMin,
      max: input.compensationMax,
      currency: "USD",
      period: "year",
      basis: "gross",
      status: "known",
    };
    candidate.missingFields = candidate.missingFields.filter((f) => f !== "compensation_expectation");
  }
  for (const app of getApplicationsForCandidate(candidateId)) {
    const evaluation = db.evaluations[app.id];
    if (evaluation) evaluation.freshness = "stale";
  }
  db.audit.unshift({ id: uid("aud"), at: new Date().toISOString(), actor: candidate.owner, action: "Manual correction", object: candidate.displayName });
  return candidate;
}

/** Only a human LinkDecision.confirm creates or reuses an Application — this
 * is the sole path that turns a proposal into a real recruiting case. */
export async function confirmJobLink(recommendationId: string, opts: { reason?: string; confirmedBy: "emma" | "daniel" | "morgan" }): Promise<Application> {
  if (isRealApi()) {
    return apiFetch<Application>(`/recommendations/${recommendationId}/confirm-link`, {
      method: "POST",
      body: JSON.stringify({ reason: opts.reason }),
    });
  }
  const rec = db.recommendations.find((r) => r.id === recommendationId);
  if (!rec) throw new ApiError("NOT_FOUND", `Recommendation ${recommendationId} not found`);
  await delay();
  let application = db.applications.find((a) => a.candidateId === rec.candidateId && a.jobId === rec.jobId);
  if (!application) {
    application = {
      id: uid("app"),
      candidateId: rec.candidateId,
      jobId: rec.jobId,
      cycleId: "cycle-1",
      status: "active",
      screeningStatus: "not_started",
      origin: "sourced",
      linkedAt: new Date().toISOString(),
      linkedBy: opts.confirmedBy,
      linkReason: opts.reason || "",
    };
    db.applications.push(application);
  }
  rec.status = "confirmed";
  rec.applicationRef = application.id;
  db.tasks.push({
    id: uid("task"),
    type: "screening_review",
    title: `Review screening: ${getCandidate(rec.candidateId)?.displayName} — ${db.jobs[rec.jobId]?.title}`,
    subjectLabel: "Linked, screening not yet run.",
    module: "Screening",
    assignee: opts.confirmedBy,
    priority: "normal",
    status: "open",
    createdAt: new Date().toISOString(),
    linkRoute: `/applications/${application.id}`,
    candidateId: rec.candidateId,
    jobId: rec.jobId,
  });
  return application;
}

export async function dismissRecommendation(recommendationId: string): Promise<void> {
  if (isRealApi()) {
    await apiFetch(`/recommendations/${recommendationId}/dismiss`, { method: "POST" });
    return;
  }
  const rec = db.recommendations.find((r) => r.id === recommendationId);
  if (!rec) throw new ApiError("NOT_FOUND", `Recommendation ${recommendationId} not found`);
  await delay();
  rec.status = "dismissed";
}

export async function deferRecommendation(recommendationId: string): Promise<void> {
  if (isRealApi()) {
    await apiFetch(`/recommendations/${recommendationId}/defer`, { method: "POST" });
    return;
  }
  const rec = db.recommendations.find((r) => r.id === recommendationId);
  if (!rec) throw new ApiError("NOT_FOUND", `Recommendation ${recommendationId} not found`);
  await delay();
  rec.status = "deferred";
}

export async function addManualRecommendation(candidateId: string, jobId: string): Promise<CandidateJobRecommendation> {
  if (isRealApi()) {
    return apiFetch<CandidateJobRecommendation>(`/candidates/${candidateId}/jobs/${jobId}/recommend`, { method: "POST" });
  }
  if (!getCandidate(candidateId)) throw new ApiError("NOT_FOUND", `Candidate ${candidateId} not found`);
  if (!db.jobs[jobId]) throw new ApiError("NOT_FOUND", `Job ${jobId} not found`);
  await delay();
  const rec: CandidateJobRecommendation = {
    id: uid("rec"),
    candidateId,
    jobId,
    status: "proposed",
    createdAt: daysAgo(0),
    confidence: 0.5,
    rationale: "Added manually by a recruiter or hiring manager.",
    gaps: [],
    proposalSource: "manual",
  };
  db.recommendations.push(rec);
  return rec;
}

export interface JobRecommendation extends CandidateJobRecommendation {
  candidateName?: string;
}

/** Pending AI proposals for one job -- the "Suggested candidates" list on the
 * screening workspace. Only "proposed" recommendations are returned; once a
 * recruiter confirms, dismisses, or defers one it belongs in a different view. */
export async function getJobRecommendations(jobId: string): Promise<JobRecommendation[]> {
  if (isRealApi()) {
    return apiFetch<JobRecommendation[]>(`/jobs/${jobId}/recommendations`);
  }
  await delay();
  return db.recommendations
    .filter((r) => r.jobId === jobId && r.status === "proposed")
    .map((r) => ({ ...r, candidateName: getCandidate(r.candidateId)?.displayName }));
}
