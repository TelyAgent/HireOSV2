import { db, getJob } from "../db";
import type { Job, Dimension, Requirement } from "../fixtures/jobs";
import { DEFAULT_NEUTRAL_DIMENSIONS } from "../fixtures/jobs";
import type { CandidateJobRecommendation } from "../fixtures/recommendations";
import { uid, daysAgo } from "../../lib/daysAgo";
import { candidateMatchesDirection, seededRandom } from "../../lib/scoring";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export async function listJobs(): Promise<Job[]> {
  if (isRealApi()) {
    const jobs = await apiFetch<Job[]>("/jobs");
    for (const job of jobs) db.jobs[job.id] = job;
    return jobs;
  }
  await delay();
  return Object.values(db.jobs);
}

export async function getJobDetail(id: string): Promise<Job> {
  if (isRealApi()) {
    const job = await apiFetch<Job>(`/jobs/${id}`);
    db.jobs[job.id] = job;
    return job;
  }
  await delay();
  const job = getJob(id);
  if (!job) throw new ApiError("NOT_FOUND", `Job ${id} not found`);
  return job;
}

export interface CreateDraftJobInput {
  title: string;
  team?: string;
  jdText?: string;
}
export async function createDraftJob(input: CreateDraftJobInput): Promise<Job> {
  if (!input.title.trim()) throw new ApiError("TITLE_REQUIRED", "Job title is required");
  if (isRealApi()) {
    const job = await apiFetch<Job>("/jobs", { method: "POST", body: JSON.stringify(input) });
    db.jobs[job.id] = job;
    return job;
  }
  await delay();
  const id = uid("job");
  const job: Job = {
    id,
    title: input.title.trim(),
    team: input.team || "Unassigned",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Unspecified",
    status: "open",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "draft",
    criteriaVersion: 0,
    compRange: { min: null, max: null, currency: "USD", period: "year", basis: "unknown" },
    responsibilities: input.jdText ? [input.jdText.slice(0, 400)] : [],
    requirements: [],
    dimensions: DEFAULT_NEUTRAL_DIMENSIONS.map((d) => ({ ...d })),
    openings: 1,
    applicantCount: 0,
  };
  db.jobs[id] = job;
  return job;
}

export interface UpdateJobCriteriaPatch {
  requirements?: Requirement[];
  dimensions?: Dimension[];
}
export async function updateJobCriteria(id: string, patch: UpdateJobCriteriaPatch): Promise<Job> {
  if (isRealApi()) {
    const job = await apiFetch<Job>(`/jobs/${id}/criteria`, { method: "PATCH", body: JSON.stringify(patch) });
    db.jobs[job.id] = job;
    return job;
  }
  const job = getJob(id);
  if (!job) throw new ApiError("NOT_FOUND", `Job ${id} not found`);
  await delay();
  if (patch.requirements) job.requirements = patch.requirements;
  if (patch.dimensions) job.dimensions = patch.dimensions;
  job.criteriaStatus = "draft";
  return job;
}

/** Confirming locks requirements/weights as the active scoring baseline —
 * screening can only run against a confirmed version. Existing evaluations
 * are NOT silently recomputed; they're left as-is (freshness is handled
 * elsewhere) and a fresh auto-match run is kicked off for the library. */
export async function confirmJobCriteria(id: string, confirmedBy: "emma" | "daniel" | "morgan" = "daniel"): Promise<Job> {
  if (isRealApi()) {
    const job = await apiFetch<Job>(`/jobs/${id}/criteria/confirm`, { method: "POST", body: JSON.stringify({ confirmedBy }) });
    db.jobs[job.id] = job;
    await apiFetch(`/jobs/${id}/match`, { method: "POST" });
    return job;
  }
  const job = getJob(id);
  if (!job) throw new ApiError("NOT_FOUND", `Job ${id} not found`);
  const weightSum = job.dimensions.reduce((s, d) => s + d.weight, 0);
  if (job.dimensions.length < 3 || job.dimensions.length > 8) throw new ApiError("INVALID_DIMENSION_COUNT", "Scoring dimensions must total 3–8");
  if (Math.abs(weightSum - 1) > 0.01) throw new ApiError("WEIGHTS_NOT_100", "Weights must total 100%");
  await delay();
  job.criteriaStatus = "confirmed";
  job.criteriaVersion += 1;
  job.confirmedBy = confirmedBy;
  job.confirmedAt = new Date().toISOString();
  void runJobAutoMatch(id);
  return job;
}

/** Reopens a confirmed version as an editable draft. The confirmed version's
 * requirements/dimensions stay in effect for existing evaluations until the
 * new draft is confirmed — this only flips the editing gate. */
export async function reopenJobCriteriaForEdit(id: string): Promise<Job> {
  if (isRealApi()) {
    const job = await apiFetch<Job>(`/jobs/${id}/criteria/reopen`, { method: "POST" });
    db.jobs[job.id] = job;
    return job;
  }
  const job = getJob(id);
  if (!job) throw new ApiError("NOT_FOUND", `Job ${id} not found`);
  await delay();
  job.criteriaStatus = "draft";
  return job;
}

/** Simulated direction-filtered matching against the Resume Library. Confirms
 * no Application — it only proposes CandidateJobRecommendations, which stay a
 * separate, pre-link population until a human confirms one. */
export async function runJobAutoMatch(jobId: string): Promise<CandidateJobRecommendation[]> {
  const job = getJob(jobId);
  if (!job) throw new ApiError("NOT_FOUND", `Job ${jobId} not found`);
  await delay(600);
  const created: CandidateJobRecommendation[] = [];
  for (const candidate of Object.values(db.candidates)) {
    if (!candidateMatchesDirection(candidate, job)) continue;
    const alreadyProposed = db.recommendations.some((r) => r.candidateId === candidate.id && r.jobId === jobId);
    const alreadyLinked = db.applications.some((a) => a.candidateId === candidate.id && a.jobId === jobId);
    if (alreadyProposed || alreadyLinked) continue;
    const rand = seededRandom(candidate.id + jobId);
    const confidence = Math.round((0.35 + rand() * 0.55) * 100) / 100;
    const rec: CandidateJobRecommendation = {
      id: uid("rec"),
      candidateId: candidate.id,
      jobId,
      status: "proposed",
      createdAt: daysAgo(0),
      confidence,
      rationale: `Keyword overlap between "${job.team}"/"${job.title}" and this candidate's tags suggests a possible fit — review before confirming.`,
      gaps: [],
    };
    db.recommendations.push(rec);
    created.push(rec);
  }
  return created;
}
