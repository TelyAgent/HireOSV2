import { applyServerState, db } from "../db";
import type { Evidence } from "../fixtures/evidence";
import type { Application } from "../fixtures/applications";
import type { Evaluation } from "../fixtures/evaluations";
import type { Concern } from "../fixtures/concerns";
import type { VerificationItem } from "../fixtures/verificationItems";
import type { HumanAssessment } from "../fixtures/humanAssessments";
import type { PersonId } from "../fixtures/people";
import { apiFetch } from "./shared";

export interface ApplicationDetail {
  application: Application;
  evaluation: Evaluation | null;
  concerns: Concern[];
  verificationItems: VerificationItem[];
  humanAssessments: HumanAssessment[];
  decision: (typeof db.decisions)[string] | null;
  /** Earlier decisions that were withdrawn (issue #23), newest first. */
  withdrawnDecisions?: (typeof db.decisions)[string][];
  /** Every evaluation snapshot, newest first (#19). */
  history?: EvaluationSnapshot[];
  /** A screening run for this application is still in progress on the server. */
  screeningInProgress?: boolean;
}

export async function getApplicationDetail(id: string): Promise<ApplicationDetail> {
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
  // The evidence behind each dimension, so its drawer can show the excerpts (#192).
  for (const item of (detail.evaluation as { evidence?: Evidence[] } | null)?.evidence ?? []) db.evidence[item.id] = item;
  db.concerns[id] = detail.concerns;
  for (const item of detail.verificationItems) db.verificationItems[item.id] = item;
  db.humanAssessments[id] = detail.humanAssessments;
  if (detail.decision) db.decisions[id] = detail.decision;
  else delete db.decisions[id];
  return detail;
}

export interface ApplicationWithNames extends Application {
  candidateName?: string;
  jobTitle?: string;
}

/** Confirmed candidates for one job -- the "Linked candidates" table on the
 * screening workspace. An application can exist with no evaluation yet
 * (screening not run); callers must render that as "Not run", not omit it. */
export async function listApplicationsForJob(jobId: string): Promise<ApplicationWithNames[]> {
  return apiFetch<ApplicationWithNames[]>(`/applications?jobId=${encodeURIComponent(jobId)}`);
}

/** One row of the snapshot history (#19). */
export interface EvaluationSnapshot {
  id: string;
  version: number;
  overall: number | null;
  coverage: number;
  completedAt: string;
  modelVersion: string | null;
  evaluationMode: Evaluation["evaluationMode"];
  aiStatus: Evaluation["aiStatus"];
  freshness: Evaluation["freshness"];
}

/** A run's result: `reused` when the inputs were unchanged and the previous snapshot stands (#19). */
export type ScreeningRunResult = Evaluation & { reused?: boolean; snapshotCount?: number };

/** Full snapshots (dimension scores included), newest first. */
export async function listEvaluations(applicationId: string): Promise<Evaluation[]> {
  return apiFetch<Evaluation[]>(`/applications/${applicationId}/evaluations`);
}

export async function runScreening(applicationId: string): Promise<ScreeningRunResult> {
  const evaluation = await apiFetch<ScreeningRunResult>(`/applications/${applicationId}/screen`, { method: "POST" });
  db.evaluations[applicationId] = evaluation;
  return evaluation;
}

export async function refreshEvaluation(applicationId: string): Promise<ScreeningRunResult> {
  const current = await apiFetch<ApplicationDetail>(`/applications/${applicationId}/screening`);
  if (!current.evaluation) throw new Error("No evaluation exists to refresh");
  const evaluation = await apiFetch<ScreeningRunResult>(`/evaluations/${current.evaluation.id}/refresh`, { method: "POST" });
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
  const current = await apiFetch<ApplicationDetail>(`/applications/${applicationId}/screening`);
  if (!current.evaluation) throw new Error("No evaluation exists to override");
  return apiFetch<HumanAssessment>(`/evaluations/${current.evaluation.id}/human-assessments`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type ConcernResolution = "dismissed" | "confirmed" | "accepted_risk";
/** Handling a concern needs a note; references to the candidate's material are optional (#193). */
export async function resolveConcern(
  applicationId: string,
  concernId: string,
  input: { resolution: ConcernResolution; note: string; evidenceRefs?: Array<{ materialId: string; label?: string }> },
): Promise<Concern> {
  const concern = await apiFetch<Concern>(`/concerns/${concernId}/resolve`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  applyServerState({ applicationId, concern });
  return concern;
}

/** A handled concern back to open, with a note; its history is kept (#193 AC-4). */
export async function reopenConcern(applicationId: string, concernId: string, note: string): Promise<Concern> {
  const concern = await apiFetch<Concern>(`/concerns/${concernId}/reopen`, { method: "POST", body: JSON.stringify({ note }) });
  applyServerState({ applicationId, concern });
  return concern;
}

export async function assignVerificationItemToMe(itemId: string, userId: PersonId): Promise<VerificationItem> {
  void userId; // server infers the assignee from the authenticated session, not this param
  const item = await apiFetch<VerificationItem>(`/verification-items/${itemId}/assign`, { method: "POST" });
  applyServerState({ applicationId: item.applicationId, verificationItem: item });
  return item;
}

export async function resolveVerificationItem(itemId: string, outcome: "met" | "not_met", resolvedBy: PersonId): Promise<VerificationItem> {
  void resolvedBy; // server records the authenticated actor
  const item = await apiFetch<VerificationItem>(`/verification-items/${itemId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome }),
  });
  applyServerState({ applicationId: item.applicationId, verificationItem: item });
  return item;
}
