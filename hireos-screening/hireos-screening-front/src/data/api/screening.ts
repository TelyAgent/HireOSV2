import { db, getApplication, getJob, getCandidate, getConcerns } from "../db";
import type { Application } from "../fixtures/applications";
import type { Evaluation, DimensionScore } from "../fixtures/evaluations";
import type { Concern } from "../fixtures/concerns";
import type { VerificationItem } from "../fixtures/verificationItems";
import type { HumanAssessment } from "../fixtures/humanAssessments";
import type { PersonId } from "../fixtures/people";
import { uid } from "../../lib/daysAgo";
import { computeAggregate, aggregateEligibility, seededRandom, quickEligibilityCheck } from "../../lib/scoring";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export interface ApplicationDetail {
  application: Application;
  evaluation: Evaluation | null;
  concerns: Concern[];
  verificationItems: VerificationItem[];
  humanAssessments: HumanAssessment[];
  decision: (typeof db.decisions)[string] | null;
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetail> {
  if (isRealApi()) {
    const detail = await apiFetch<ApplicationDetail>(`/applications/${id}/screening`);
    const [candidateDetail, job] = await Promise.all([
      apiFetch<{
        candidate: (typeof db.candidates)[string];
        resumeVersions: (typeof db.resumeVersions)[string];
        applications: Application[];
        recommendations: (typeof db.recommendations)[number][];
      }>(`/candidates/${detail.application.candidateId}`),
      apiFetch<(typeof db.jobs)[string]>(`/jobs/${detail.application.jobId}`),
    ]);
    db.candidates[candidateDetail.candidate.id] = candidateDetail.candidate;
    db.resumeVersions[candidateDetail.candidate.id] = candidateDetail.resumeVersions;
    db.jobs[job.id] = job;
    const existingApplication = db.applications.findIndex((item) => item.id === detail.application.id);
    if (existingApplication >= 0) db.applications[existingApplication] = detail.application;
    else db.applications.push(detail.application);
    if (detail.evaluation) db.evaluations[id] = detail.evaluation;
    db.concerns[id] = detail.concerns;
    for (const item of detail.verificationItems) db.verificationItems[item.id] = item;
    db.humanAssessments[id] = detail.humanAssessments;
    if (detail.decision) db.decisions[id] = detail.decision;
    return detail;
  }
  await delay();
  const application = getApplication(id);
  if (!application) throw new ApiError("NOT_FOUND", `Application ${id} not found`);
  const verificationItems = Object.values(db.verificationItems).filter((v) => v.applicationId === id);
  return {
    application,
    evaluation: db.evaluations[id] || null,
    concerns: getConcerns(id),
    verificationItems,
    humanAssessments: db.humanAssessments[id] || [],
    decision: db.decisions[id] || null,
  };
}

export interface ApplicationWithNames extends Application {
  candidateName?: string;
  jobTitle?: string;
}

/** Confirmed candidates for one job -- the "Linked candidates" table on the
 * screening workspace. An application can exist with no evaluation yet
 * (screening not run); callers must render that as "Not run", not omit it. */
export async function listApplicationsForJob(jobId: string): Promise<ApplicationWithNames[]> {
  if (isRealApi()) {
    return apiFetch<ApplicationWithNames[]>(`/applications?jobId=${encodeURIComponent(jobId)}`);
  }
  await delay();
  return db.applications
    .filter((a) => a.jobId === jobId)
    .map((a) => ({ ...a, candidateName: getCandidate(a.candidateId)?.displayName, jobTitle: getJob(a.jobId)?.title }));
}

/** Simulated AI-assisted screening — deterministic per application so the
 * same candidate+job always yields the same demo result. Coverage-gated:
 * below the 70% coverage threshold, `overall` stays `null` rather than a
 * fabricated number (PRD: Unknown must never become zero or a guess). */
function generateEvaluation(applicationId: string): Evaluation {
  const application = getApplication(applicationId);
  if (!application) throw new ApiError("NOT_FOUND", `Application ${applicationId} not found`);
  const job = getJob(application.jobId);
  const candidate = getCandidate(application.candidateId);
  if (!job || !candidate) throw new ApiError("NOT_FOUND", "Job or candidate not found");
  const rand = seededRandom(applicationId);

  const dims: DimensionScore[] = job.dimensions.map((d) => {
    const evaluated = rand() > 0.12; // occasionally simulate "not enough material to evaluate"
    const score = evaluated ? Math.round(35 + rand() * 60) : null;
    return {
      id: d.id,
      name: d.name,
      weight: d.weight,
      status: evaluated ? "evaluated" : "unknown",
      score,
      confidence: evaluated ? Math.round((0.4 + rand() * 0.5) * 100) / 100 : null,
      reason: evaluated
        ? `Simulated evaluation against "${d.rubric}" using available resume and application material.`
        : `Not enough material available to evaluate "${d.rubric}".`,
      supporting: [],
      counter: [],
    };
  });

  const agg = computeAggregate(dims);
  const eligResults = job.requirements
    .filter((r) => r.hard)
    .map((r) => ({
      requirementId: r.id,
      status: quickEligibilityCheck(candidate, job) === "needs_verification" ? ("unknown" as const) : ("met" as const),
      reason: r.kind === "authorization" ? "Derived from work-authorization field on file." : "Assumed met — no explicit conflicting evidence found.",
      evidence: [] as string[],
    }));

  return {
    id: uid("eval"),
    applicationId,
    status: "completed",
    evaluationMode: "ai_assisted",
    aiStatus: "available",
    eligibilityStatus: aggregateEligibility(eligResults),
    eligibilityResults: eligResults,
    overall: agg.overall,
    coverage: agg.coverage,
    confidence: 0.6,
    evaluationStatus: agg.overall == null ? "insufficient_evidence" : "evaluated",
    dimensionScores: dims,
    modelVersion: "screen-eval-v2.3.1 (sample)",
    completedAt: new Date().toISOString(),
    freshness: "current",
  };
}

export async function runScreening(applicationId: string): Promise<Evaluation> {
  if (isRealApi()) {
    const evaluation = await apiFetch<Evaluation>(`/applications/${applicationId}/screen`, { method: "POST" });
    db.evaluations[applicationId] = evaluation;
    return evaluation;
  }
  await delay(1200);
  const evaluation = generateEvaluation(applicationId);
  db.evaluations[applicationId] = evaluation;
  const application = getApplication(applicationId);
  if (application) application.screeningStatus = "review_pending";
  return evaluation;
}

/** Refresh creates a new snapshot — the prior result is kept in history in
 * spirit (we don't currently persist prior snapshots in this mock layer,
 * only the freshness-cleared current one), never silently overwritten in a
 * way that hides what changed. */
export async function refreshEvaluation(applicationId: string): Promise<Evaluation> {
  if (isRealApi()) {
    const current = await apiFetch<ApplicationDetail>(`/applications/${applicationId}/screening`);
    if (!current.evaluation) throw new ApiError("NOT_FOUND", "No evaluation exists to refresh");
    const evaluation = await apiFetch<Evaluation>(`/evaluations/${current.evaluation.id}/refresh`, { method: "POST" });
    db.evaluations[applicationId] = evaluation;
    return evaluation;
  }
  await delay(900);
  const evaluation = generateEvaluation(applicationId);
  db.evaluations[applicationId] = evaluation;
  return evaluation;
}

export interface SaveHumanOverrideInput {
  dimensionId: string;
  dimensionName: string;
  score: number;
  reason: string;
  by: PersonId;
}
export async function saveHumanOverride(applicationId: string, input: SaveHumanOverrideInput): Promise<HumanAssessment> {
  if (isRealApi()) {
    const current = await apiFetch<ApplicationDetail>(`/applications/${applicationId}/screening`);
    if (!current.evaluation) throw new ApiError("NOT_FOUND", "No evaluation exists to override");
    return apiFetch<HumanAssessment>(`/evaluations/${current.evaluation.id}/human-assessments`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }
  if (input.score < 0 || input.score > 100) throw new ApiError("INVALID_SCORE", "Enter a score between 0 and 100");
  if (!input.reason.trim()) throw new ApiError("REASON_REQUIRED", "A reason is required");
  await delay();
  const record: HumanAssessment = { dimensionId: input.dimensionId, dimensionName: input.dimensionName, score: input.score, reason: input.reason, by: input.by, at: new Date().toISOString() };
  const list = db.humanAssessments[applicationId] || (db.humanAssessments[applicationId] = []);
  const existingIdx = list.findIndex((h) => h.dimensionId === input.dimensionId);
  if (existingIdx >= 0) list[existingIdx] = record;
  else list.push(record);
  return record;
}

export type ConcernResolution = "dismissed" | "confirmed" | "accepted_risk";
export async function resolveConcern(applicationId: string, concernId: string, resolution: ConcernResolution): Promise<Concern> {
  if (isRealApi()) {
    return apiFetch<Concern>(`/concerns/${concernId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    });
  }
  const list = db.concerns[applicationId];
  const concern = list?.find((c) => c.id === concernId);
  if (!concern) throw new ApiError("NOT_FOUND", `Concern ${concernId} not found`);
  await delay();
  concern.status = resolution;
  return concern;
}

export async function assignVerificationItemToMe(itemId: string, userId: PersonId): Promise<VerificationItem> {
  if (isRealApi()) {
    return apiFetch<VerificationItem>(`/verification-items/${itemId}/assign`, { method: "POST" });
  }
  const item = db.verificationItems[itemId];
  if (!item) throw new ApiError("NOT_FOUND", `Verification item ${itemId} not found`);
  await delay();
  item.status = "assigned";
  item.owner = userId;
  return item;
}

export async function resolveVerificationItem(itemId: string, outcome: "met" | "not_met", resolvedBy: PersonId): Promise<VerificationItem> {
  if (isRealApi()) {
    return apiFetch<VerificationItem>(`/verification-items/${itemId}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
  }
  const item = db.verificationItems[itemId];
  if (!item) throw new ApiError("NOT_FOUND", `Verification item ${itemId} not found`);
  await delay();
  item.status = "resolved";
  item.outcome = outcome;
  item.resolvedBy = resolvedBy;
  item.resolvedAt = new Date().toISOString();
  return item;
}
