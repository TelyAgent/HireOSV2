import type { DuplicateReview, DuplicateResolutionOutcome } from "../fixtures/duplicateReviews";
import type { PersonId } from "../fixtures/people";
import { apiFetch, apiUpload } from "./shared";
import { safeRandomUUID } from "../../lib/uuid";

export type ImportOutcome =
  | "exact_file"
  | "new_resume_version"
  | "possible_same_person"
  | "new_candidate"
  | "quarantined"
  | "parse_failed"
  | "too_large"
  | "unsupported_type";

export interface ImportItemResult {
  id: string;
  fileName: string;
  sizeKB: number;
  outcome: ImportOutcome | string;
  stage?: string;
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
  attemptCount?: number;
  completedAt?: string;
  materialId?: string;
  duplicateOfMaterialId?: string;
  businessConsumeStatus?: string;
  candidateId?: string;
  duplicateReviewId?: string;
  /** Only for batches imported from a job: parse → match → outcome against that job. */
  jobMatch?: JobMatchProgress;
}

export type JobMatchResult =
  | "matched"
  | "no_match"
  | "already_linked"
  | "job_not_open"
  | "criteria_not_confirmed"
  | "not_evaluated"
  | "parse_failed"
  | "match_failed";
export interface JobMatchProgress {
  stage: "parsing" | "matching" | "done";
  result?: JobMatchResult;
  /** 0–100 overall match score. */
  score?: number;
  confidence?: number;
  recommendationStatus?: string;
}

export interface ImportBatch {
  id: string;
  operationId?: string;
  createdAt: string;
  status: "processing" | "completed" | "partial" | "failed" | "cancelled";
  targetJobId?: string;
  items: ImportItemResult[];
}

export type UploadFileInput = File;

/** `jobId`: import started from a job's screening workspace — the backend auto-matches
 * these resumes against that job only, instead of every open job. */
export async function runImportBatch(files: UploadFileInput[], opts?: { jobId?: string }): Promise<ImportBatch> {
  return apiUpload<ImportBatch>("/imports", files, "files", {
    "Idempotency-Key": `resume-import-${safeRandomUUID()}`,
    ...(opts?.jobId ? { "X-Target-Job-Id": opts.jobId } : {}),
  });
}

export async function retryImportItem(id: string): Promise<ImportBatch> {
  return apiFetch<ImportBatch>(`/import-items/${id}/retry`, { method: "POST" });
}

/** Re-fetches a batch's current state. Real uploads finish candidate creation
 * asynchronously (see the import chain plan's Phase 1), so the batch returned
 * by `runImportBatch` may still show items as "processing" — callers should
 * poll this until `status` is no longer "processing". */
export async function getImportBatch(id: string): Promise<ImportBatch> {
  return apiFetch<ImportBatch>(`/imports/${id}`);
}

export async function cancelImportBatch(id: string): Promise<ImportBatch> {
  return apiFetch<ImportBatch>(`/imports/${id}/cancel`, { method: "POST" });
}

export async function getDuplicateReview(id: string): Promise<DuplicateReview> {
  return apiFetch<DuplicateReview>(`/duplicates/${id}`);
}

export const RESOLUTION_LABEL: Record<DuplicateResolutionOutcome, string> = {
  reuse_file: "Reused existing file",
  different_person: "Kept as different person",
  same_person_new_version: "Saved as new version",
  defer: "Deferred",
};

/** The four allowed resolutions from the Interface Spec. Resolving never
 * merges identity automatically — `same_person_new_version` explicitly marks
 * related evaluations stale rather than silently recomputing them. */
export async function resolveDuplicateReview(
  id: string,
  outcome: DuplicateResolutionOutcome,
  opts: { resolvedBy: PersonId; note?: string },
): Promise<DuplicateReview> {
  void opts.resolvedBy; // server derives the resolver from the authenticated session
  return apiFetch<DuplicateReview>(`/duplicates/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ outcome, note: opts.note }),
  });
}
