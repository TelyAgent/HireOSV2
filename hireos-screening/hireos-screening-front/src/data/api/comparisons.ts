import { db, getApplication } from "../db";
import type { ComparisonSet, ComparisonSnapshot } from "../fixtures/comparisons";
import type { PersonId } from "../fixtures/people";
import type { Application } from "../fixtures/applications";
import { uid } from "../../lib/daysAgo";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

/** Creates a new comparison set for a job's linked candidates. The backend
 * requires every application to share the given job and at least one member;
 * a meaningful comparison (see ComparePage) needs at least two. */
export async function createComparison(jobId: string, purpose: string, applicationIds: string[]): Promise<ComparisonSet> {
  if (isRealApi()) {
    return apiFetch<ComparisonSet>("/comparisons", {
      method: "POST",
      body: JSON.stringify({ jobId, purpose, applicationIds }),
    });
  }
  await delay();
  const id = uid("cmp");
  const cmp: ComparisonSet = {
    id,
    jobId,
    purpose,
    memberIds: applicationIds,
    owner: "emma",
    collaborators: [],
    snapshots: [],
    annotations: [],
  };
  db.comparisons[id] = cmp;
  return cmp;
}

export async function getComparison(id: string): Promise<ComparisonSet> {
  if (isRealApi()) {
    const cmp = await apiFetch<ComparisonSet>(`/comparisons/${id}`);
    await Promise.all(
      cmp.memberIds.map(async (applicationId) => {
        const detail = await apiFetch<{
          application: Application;
          evaluation: (typeof db.evaluations)[string] | null;
          concerns: (typeof db.concerns)[string];
          verificationItems: (typeof db.verificationItems)[string][];
          humanAssessments: (typeof db.humanAssessments)[string];
          decision: (typeof db.decisions)[string] | null;
        }>(`/applications/${applicationId}/screening`);
        const [candidateDetail, job] = await Promise.all([
          apiFetch<{ candidate: (typeof db.candidates)[string]; resumeVersions: (typeof db.resumeVersions)[string] }>(
            `/candidates/${detail.application.candidateId}`,
          ),
          apiFetch<(typeof db.jobs)[string]>(`/jobs/${detail.application.jobId}`),
        ]);
        db.candidates[candidateDetail.candidate.id] = candidateDetail.candidate;
        db.resumeVersions[candidateDetail.candidate.id] = candidateDetail.resumeVersions;
        db.jobs[job.id] = job;
        const existingApplication = db.applications.findIndex((item) => item.id === detail.application.id);
        if (existingApplication >= 0) db.applications[existingApplication] = detail.application;
        else db.applications.push(detail.application);
        if (detail.evaluation) db.evaluations[applicationId] = detail.evaluation;
        db.concerns[applicationId] = detail.concerns;
        for (const item of detail.verificationItems) db.verificationItems[item.id] = item;
        db.humanAssessments[applicationId] = detail.humanAssessments;
        if (detail.decision) db.decisions[applicationId] = detail.decision;
      }),
    );
    db.comparisons[id] = cmp;
    return cmp;
  }
  await delay();
  const cmp = db.comparisons[id];
  if (!cmp) throw new ApiError("NOT_FOUND", `Comparison ${id} not found`);
  return cmp;
}

export async function addCandidateToComparison(id: string, applicationId: string): Promise<ComparisonSet> {
  if (isRealApi()) {
    const cmp = await apiFetch<ComparisonSet>(`/comparisons/${id}/members`, {
      method: "POST",
      body: JSON.stringify({ applicationId }),
    });
    db.comparisons[id] = cmp;
    return cmp;
  }
  const cmp = db.comparisons[id];
  if (!cmp) throw new ApiError("NOT_FOUND", `Comparison ${id} not found`);
  if (!getApplication(applicationId)) throw new ApiError("NOT_FOUND", `Application ${applicationId} not found`);
  await delay();
  if (!cmp.memberIds.includes(applicationId)) cmp.memberIds.push(applicationId);
  return cmp;
}

/** Refreshing only ever adds a new snapshot — it never mutates or discards a
 * prior one, so "what changed" stays auditable. */
export async function refreshComparison(id: string): Promise<ComparisonSnapshot> {
  if (isRealApi()) {
    const snapshot = await apiFetch<ComparisonSnapshot>(`/comparisons/${id}/refresh`, { method: "POST" });
    const cmp = await apiFetch<ComparisonSet>(`/comparisons/${id}`);
    db.comparisons[id] = cmp;
    return snapshot;
  }
  const cmp = db.comparisons[id];
  if (!cmp) throw new ApiError("NOT_FOUND", `Comparison ${id} not found`);
  await delay(700);
  const nextVersion = cmp.snapshots.length + 1;
  for (const s of cmp.snapshots) s.freshness = "stale";
  const snapshot: ComparisonSnapshot = {
    id: uid("cmp-snap"),
    version: nextVersion,
    generatedAt: new Date().toISOString(),
    mode: "current_summary",
    freshness: "current",
    note: "Refreshed snapshot.",
  };
  cmp.snapshots.push(snapshot);
  return snapshot;
}

export async function addAnnotation(id: string, targetId: string, body: string, author: PersonId): Promise<ComparisonSet> {
  if (isRealApi()) {
    await apiFetch(`/comparisons/${id}/annotations`, {
      method: "POST",
      body: JSON.stringify({ targetId, body }),
    });
    const cmp = await apiFetch<ComparisonSet>(`/comparisons/${id}`);
    db.comparisons[id] = cmp;
    return cmp;
  }
  const cmp = db.comparisons[id];
  if (!cmp) throw new ApiError("NOT_FOUND", `Comparison ${id} not found`);
  await delay();
  cmp.annotations.push({ id: uid("ann"), author, targetId, body, createdAt: new Date().toISOString() });
  return cmp;
}

export interface ExportComparisonInput {
  format: "png" | "pdf";
  applicationIds?: string[];
}
export async function exportComparison(id: string, input: ExportComparisonInput): Promise<{ exportedCount: number }> {
  if (isRealApi()) {
    return apiFetch<{ exportedCount: number }>(`/comparisons/${id}/exports`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  const cmp = db.comparisons[id];
  if (!cmp) throw new ApiError("NOT_FOUND", `Comparison ${id} not found`);
  await delay(600);
  const count = input.format === "png" ? (input.applicationIds?.length ?? cmp.memberIds.length) : cmp.memberIds.length;
  return { exportedCount: count };
}
