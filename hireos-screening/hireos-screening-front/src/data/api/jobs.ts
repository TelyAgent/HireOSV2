import { db } from "../db";
import type { Job, Dimension, Requirement } from "../fixtures/jobs";
import { ApiError, apiFetch, apiUpload } from "./shared";

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
 * screening can only run against a confirmed version. Existing evaluations and
 * matches are NOT recomputed: re-matching the library is an explicit, background
 * action (`runJobMatch`) so tweaking and re-confirming criteria stays instant. */
export async function confirmJobCriteria(id: string, confirmedBy: "emma" | "daniel" | "morgan" = "daniel"): Promise<Job> {
  const job = await apiFetch<Job>(`/jobs/${id}/criteria/confirm`, { method: "POST", body: JSON.stringify({ confirmedBy }) });
  db.jobs[job.id] = job;
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

/** Evaluated against the job but not suggested or linked (below threshold, or dismissed). */
export interface BelowThresholdCandidate {
  candidateId: string;
  candidateName: string;
  reason: "below_threshold" | "dismissed";
  /** 0–100 overall match score. */
  score?: number;
  rationale: string;
  gaps: string[];
  evaluatedAt: string;
}
export async function listJobBelowThreshold(id: string): Promise<BelowThresholdCandidate[]> {
  return apiFetch(`/jobs/${id}/below-threshold`);
}

/** Queues a background re-match of the resume library against this job's confirmed
 * criteria; returns immediately. New suggestions appear as each candidate finishes. */
export async function runJobMatch(id: string): Promise<{ status: "queued"; candidatesQueued: number; alreadyPending: number }> {
  return apiFetch(`/jobs/${id}/match`, { method: "POST" });
}

/** "New job": pasted JD text -> a draft job in JD + Core Record that Screening uses right away. */
export interface JdPreview {
  title: string;
  team: string | null;
  location: string | null;
  /** This JD already created a job; creating would open it. */
  duplicateOf: { coreJobId: string; title: string } | null;
}

/** "New job", step one: AI reads the JD and suggests title, team and location; nothing is created (#178). */
export async function previewJobFromJd(text: string): Promise<JdPreview> {
  return apiFetch<JdPreview>("/jobs/quick-start/preview", { method: "POST", body: JSON.stringify({ text }) });
}

/** Step two: create the job with the title and team the recruiter confirmed (both required). */
export async function quickStartJob(input: { text: string; title: string; team: string }, idempotencyKey: string): Promise<{ job: Job; duplicate: boolean }> {
  const result = await apiFetch<{ job: Job; duplicate: boolean }>("/jobs/quick-start", {
    method: "POST",
    headers: { "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
  db.jobs[result.job.id] = result.job;
  return result;
}

/** Text of a JD file, to fill the paste box (the file itself is not kept). */
export async function readJdFile(file: File): Promise<{ name: string; text: string; errorCode: string | null }> {
  if (file.size > 10 * 1024 * 1024) throw new ApiError("FILE_TOO_LARGE");
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new ApiError("UNSUPPORTED_FILE_TYPE");
  return apiUpload("/jobs/jd-file", [file], "file");
}
