import { db } from "../db";
import type { Job, Dimension, Requirement } from "../fixtures/jobs";
import { ApiError, apiFetch } from "./shared";

export async function listJobs(): Promise<Job[]> {
  const jobs = await apiFetch<Job[]>("/jobs");
  for (const job of jobs) db.jobs[job.id] = job;
  return jobs;
}

export async function getJobDetail(id: string): Promise<Job> {
  const job = await apiFetch<Job>(`/jobs/${id}`);
  db.jobs[job.id] = job;
  return job;
}

export interface CreateDraftJobInput {
  title: string;
  team?: string;
  jdText?: string;
}
export async function createDraftJob(input: CreateDraftJobInput): Promise<Job> {
  if (!input.title.trim()) throw new ApiError("TITLE_REQUIRED", "Job title is required");
  const job = await apiFetch<Job>("/jobs", { method: "POST", body: JSON.stringify(input) });
  db.jobs[job.id] = job;
  return job;
}

export interface UpdateJobCriteriaPatch {
  requirements?: Requirement[];
  dimensions?: Dimension[];
}
export async function updateJobCriteria(id: string, patch: UpdateJobCriteriaPatch): Promise<Job> {
  const job = await apiFetch<Job>(`/jobs/${id}/criteria`, { method: "PATCH", body: JSON.stringify(patch) });
  db.jobs[job.id] = job;
  return job;
}

/** Confirming locks requirements/weights as the active scoring baseline —
 * screening can only run against a confirmed version. Existing evaluations
 * are NOT silently recomputed; they're left as-is (freshness is handled
 * elsewhere) and a fresh auto-match run is kicked off for the library. */
export async function confirmJobCriteria(id: string, confirmedBy: "emma" | "daniel" | "morgan" = "daniel"): Promise<Job> {
  const job = await apiFetch<Job>(`/jobs/${id}/criteria/confirm`, { method: "POST", body: JSON.stringify({ confirmedBy }) });
  db.jobs[job.id] = job;
  await apiFetch(`/jobs/${id}/match`, { method: "POST" });
  return job;
}

/** Reopens a confirmed version as an editable draft. The confirmed version's
 * requirements/dimensions stay in effect for existing evaluations until the
 * new draft is confirmed — this only flips the editing gate. */
export async function reopenJobCriteriaForEdit(id: string): Promise<Job> {
  const job = await apiFetch<Job>(`/jobs/${id}/criteria/reopen`, { method: "POST" });
  db.jobs[job.id] = job;
  return job;
}
