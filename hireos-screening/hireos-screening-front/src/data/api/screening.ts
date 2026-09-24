import { db } from "../db";
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
  db.concerns[id] = detail.concerns;
  for (const item of detail.verificationItems) db.verificationItems[item.id] = item;
  db.humanAssessments[id] = detail.humanAssessments;
  if (detail.decision) db.decisions[id] = detail.decision;
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

export async function runScreening(applicationId: string): Promise<Evaluation> {
  const evaluation = await apiFetch<Evaluation>(`/applications/${applicationId}/screen`, { method: "POST" });
  db.evaluations[applicationId] = evaluation;
  return evaluation;
}

export async function refreshEvaluation(applicationId: string): Promise<Evaluation> {
  const current = await apiFetch<ApplicationDetail>(`/applications/${applicationId}/screening`);
  if (!current.evaluation) throw new Error("No evaluation exists to refresh");
  const evaluation = await apiFetch<Evaluation>(`/evaluations/${current.evaluation.id}/refresh`, { method: "POST" });
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
export async function resolveConcern(applicationId: string, concernId: string, resolution: ConcernResolution): Promise<Concern> {
  return apiFetch<Concern>(`/concerns/${concernId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolution }),
  });
}

export async function assignVerificationItemToMe(itemId: string, userId: PersonId): Promise<VerificationItem> {
  void userId; // server infers the assignee from the authenticated session, not this param
  return apiFetch<VerificationItem>(`/verification-items/${itemId}/assign`, { method: "POST" });
}

export async function resolveVerificationItem(itemId: string, outcome: "met" | "not_met", resolvedBy: PersonId): Promise<VerificationItem> {
  return apiFetch<VerificationItem>(`/verification-items/${itemId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome }),
  });
}
