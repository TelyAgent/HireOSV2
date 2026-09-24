import { db } from "../db";
import { uid, daysAgo } from "../../lib/daysAgo";
import type { Candidate } from "../fixtures/candidates";
import type { DuplicateReview, DuplicateResolutionOutcome } from "../fixtures/duplicateReviews";
import type { PersonId } from "../fixtures/people";
import { ApiError, apiFetch, apiUpload, delay, isRealApi } from "./shared";
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
}
export interface ImportBatch {
  id: string;
  operationId?: string;
  createdAt: string;
  status: "processing" | "completed" | "partial" | "failed" | "cancelled";
  items: ImportItemResult[];
}

const SUPPORTED_EXT = ["pdf", "docx", "txt"];
const MAX_SIZE_KB = 25 * 1024;

function normalizeName(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/\bresume\b|\bcv\b|v\d+/gi, "")
    .trim()
    .toLowerCase();
}

/** Best-effort fuzzy match against existing candidates by normalized-name
 * substring overlap — a simplified stand-in for the prototype's
 * Levenshtein-based `classifyUploadedFile` heuristic. */
function classifyOne(fileName: string, sizeKB: number): { outcome: ImportOutcome; candidateId?: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (sizeKB > MAX_SIZE_KB) return { outcome: "too_large" };
  if (!SUPPORTED_EXT.includes(ext)) return { outcome: "unsupported_type" };

  const norm = normalizeName(fileName);
  for (const candidate of Object.values(db.candidates)) {
    const versions = db.resumeVersions[candidate.id] || [];
    for (const v of versions) {
      if (v.fileName.toLowerCase() === fileName.toLowerCase()) return { outcome: "exact_file", candidateId: candidate.id };
    }
    const candNorm = candidate.displayName.toLowerCase().replace(/\s+/g, " ");
    if (norm && candNorm && (norm.includes(candNorm) || candNorm.includes(norm))) {
      // Same apparent person by name — treat as a possible duplicate needing review,
      // never auto-merged (PRD: identity is not merged automatically).
      return { outcome: "possible_same_person", candidateId: candidate.id };
    }
  }
  return { outcome: "new_candidate" };
}

export type UploadFileInput = File;
type MockUploadFileInput = { fileName: string; sizeKB: number };

export async function runImportBatch(files: UploadFileInput[]): Promise<ImportBatch> {
  if (isRealApi()) {
    return apiUpload<ImportBatch>("/imports", files, "files", {
      "Idempotency-Key": `resume-import-${safeRandomUUID()}`,
    });
  }
  return runMockImportBatch(files.map((file) => ({ fileName: file.name, sizeKB: Math.max(1, Math.round(file.size / 1024)) })));
}

export async function retryImportItem(id: string): Promise<ImportBatch> {
  if (isRealApi()) return apiFetch<ImportBatch>(`/import-items/${id}/retry`, { method: "POST" });
  await delay(800);
  throw new ApiError("ITEM_NOT_RETRYABLE", "This import item cannot be retried.");
}

/** Re-fetches a batch's current state. Real uploads finish candidate creation
 * asynchronously (see the import chain plan's Phase 1), so the batch returned
 * by `runImportBatch` may still show items as "processing" — callers should
 * poll this until `status` is no longer "processing". */
export async function getImportBatch(id: string): Promise<ImportBatch> {
  if (isRealApi()) return apiFetch<ImportBatch>(`/imports/${id}`);
  throw new ApiError("NOT_SUPPORTED", "Batch polling is only available against the real API.");
}

export async function cancelImportBatch(id: string): Promise<ImportBatch> {
  if (isRealApi()) return apiFetch<ImportBatch>(`/imports/${id}/cancel`, { method: "POST" });
  throw new ApiError("NOT_SUPPORTED", "Batch cancellation is only available against the real API.");
}

async function runMockImportBatch(files: { fileName: string; sizeKB: number }[]): Promise<ImportBatch> {
  const batchId = uid("batch");
  const batch: ImportBatch = { id: batchId, createdAt: new Date().toISOString(), status: "processing", items: [] };
  await delay(200);
  for (const f of files) {
    await delay(250);
    const classification = classifyOne(f.fileName, f.sizeKB);
    const itemId = uid("imp");
    let outcome = classification.outcome;

    // Simulate an occasional unreadable scan, matching the prototype's
    // "duplicate check incomplete" edge case — never claim "no duplicate" on parse failure.
    if (outcome === "new_candidate" && /scan/i.test(f.fileName)) outcome = "parse_failed";

    let candidateId = classification.candidateId;
    if (outcome === "new_candidate") {
      candidateId = uid("cand-import");
      const candidate: Candidate = {
        id: candidateId,
        displayName: normalizeName(f.fileName).replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown Candidate",
        identityStatus: "provisional",
        contact: { email: "", phone: "", location: { value: "", status: "unknown" } },
        workAuth: { value: "", status: "unknown" },
        tags: [],
        owner: "emma",
        createdAt: daysAgo(0),
        lastMatchedAt: null,
        retention: "standard-24mo",
        libraryStatus: "available",
        compensationExpectation: null,
        missingFields: ["compensation_expectation", "work_authorization"],
        employment: [],
        skills: [],
        education: [],
      };
      db.candidates[candidateId] = candidate;
      db.jobDiscovery[candidateId] = { status: "not_started", lastRunAt: null, jobsScanned: 0 };
      db.resumeVersions[candidateId] = [{ id: uid("rv"), version: 1, fileName: f.fileName, uploadedAt: new Date().toISOString(), source: "Manual upload", parseStatus: "succeeded", isLatest: true }];
    }

    let duplicateReviewId: string | undefined;
    if ((outcome === "possible_same_person" || outcome === "new_resume_version") && candidateId) {
      duplicateReviewId = uid("dup");
      db.duplicateReviews[duplicateReviewId] = {
        id: duplicateReviewId,
        kind: outcome,
        status: "open",
        uploaded: { fileName: f.fileName, uploadedAt: new Date().toISOString(), source: "Manual upload", uploadedBy: "emma", name: normalizeName(f.fileName) },
        existing: { candidateId, fileName: (db.resumeVersions[candidateId]?.[0]?.fileName) || f.fileName, uploadedAt: db.candidates[candidateId]?.createdAt || daysAgo(0), source: db.resumeVersions[candidateId]?.[0]?.source || "Manual upload" },
        basis: outcome === "possible_same_person" ? ["Similar name found in Resume Library", "Contact details differ or are unknown"] : ["Same candidate, newer upload"],
      };
    }

    if (outcome === "quarantined" || outcome === "parse_failed") {
      db.activity.unshift({ id: uid("act"), op: "Upload", actor: "emma", target: `${f.fileName} — ${outcome === "quarantined" ? "quarantined" : "parse failed"}`, status: "failed", at: new Date().toISOString() });
    }

    batch.items.push({ id: itemId, fileName: f.fileName, sizeKB: f.sizeKB, outcome, candidateId, duplicateReviewId });
  }
  batch.status = batch.items.every((i) => i.outcome === "new_candidate" || i.outcome === "exact_file") ? "completed" : "partial";
  db.activity.unshift({ id: uid("act"), op: "Upload", actor: "emma", target: `Batch of ${files.length} file(s)`, status: batch.status === "completed" ? "succeeded" : "partial", at: new Date().toISOString() });
  return batch;
}

const SAMPLE_BATCH_FILES: MockUploadFileInput[] = [
  { fileName: "sample_new_candidate_resume.pdf", sizeKB: 180 },
  { fileName: "alex_morgan_recruiting.pdf", sizeKB: 175 },
  { fileName: "candidate_notes_draft.tmp", sizeKB: 20 },
  { fileName: "scanned_resume.pdf", sizeKB: 240 },
];
export async function simulateSampleBatch(): Promise<ImportBatch> {
  return runMockImportBatch(SAMPLE_BATCH_FILES);
}

export interface UnifiedIntakeRow {
  at: string;
  label: string;
  source: string;
  status: string;
  candidateId?: string;
  candidateName?: string;
}
export async function getUnifiedIntake(): Promise<UnifiedIntakeRow[]> {
  if (isRealApi()) return apiFetch<UnifiedIntakeRow[]>("/intake");
  await delay();
  const rows: UnifiedIntakeRow[] = [];
  for (const [candidateId, versions] of Object.entries(db.resumeVersions)) {
    const candidate = db.candidates[candidateId];
    for (const v of versions) {
      rows.push({ at: v.uploadedAt, label: v.fileName, source: v.source, status: candidate ? "Processed" : "Pending duplicate review", candidateId });
    }
  }
  for (const review of Object.values(db.duplicateReviews)) {
    if (review.status === "open")
      rows.push({ at: review.uploaded.uploadedAt, label: review.uploaded.fileName, source: review.uploaded.source, status: "Pending duplicate review", candidateId: review.existing.candidateId });
  }
  return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

export async function getDuplicateReview(id: string): Promise<DuplicateReview> {
  if (isRealApi()) return apiFetch<DuplicateReview>(`/duplicates/${id}`);
  await delay();
  const review = db.duplicateReviews[id];
  if (!review) throw new ApiError("NOT_FOUND", `Duplicate review ${id} not found`);
  return review;
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
  if (isRealApi()) {
    return apiFetch<DuplicateReview>(`/duplicates/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ outcome, note: opts.note }),
    });
  }
  const review = db.duplicateReviews[id];
  if (!review) throw new ApiError("NOT_FOUND", `Duplicate review ${id} not found`);
  await delay(500);
  review.status = outcome === "defer" ? "open" : "resolved";
  review.resolutionOutcome = outcome;
  review.resolutionLabel = RESOLUTION_LABEL[outcome];
  review.resolutionBy = opts.resolvedBy;
  review.resolutionAt = new Date().toISOString();

  const candidateName = db.candidates[review.existing.candidateId]?.displayName ?? review.uploaded.name;
  review.resolutionNote =
    opts.note ??
    (outcome === "same_person_new_version"
      ? `New resume version saved for ${candidateName}. Existing screening results are now marked stale until refreshed.`
      : outcome === "different_person"
        ? "Kept as a separate candidate. No records were merged."
        : outcome === "reuse_file"
          ? "File content reused from the existing record. This upload is kept in history as an additional source."
          : "Deferred — more information requested before resolving.");

  if (outcome === "defer") return review;

  if (outcome === "same_person_new_version" && review.existing.candidateId) {
    const candidateId = review.existing.candidateId;
    const versions = db.resumeVersions[candidateId] || (db.resumeVersions[candidateId] = []);
    for (const v of versions) v.isLatest = false;
    versions.push({ id: uid("rv"), version: versions.length + 1, fileName: review.uploaded.fileName, uploadedAt: review.uploaded.uploadedAt, source: review.uploaded.source, parseStatus: "succeeded", isLatest: true, changeNote: review.changeSummary });
    for (const app of db.applications.filter((a) => a.candidateId === candidateId)) {
      const evaluation = db.evaluations[app.id];
      if (evaluation) evaluation.freshness = "stale";
    }
  }

  const relatedTask = db.tasks.find((t) => t.type === "duplicate_review" && t.linkRoute === `/duplicates/${id}` && t.status !== "completed");
  if (relatedTask) {
    relatedTask.status = "completed";
    relatedTask.completedAt = new Date().toISOString();
  }
  return review;
}

export async function retryParse(id: string): Promise<DuplicateReview> {
  const review = db.duplicateReviews[id];
  if (!review) throw new ApiError("NOT_FOUND", `Duplicate review ${id} not found`);
  await delay(800);
  // Deterministic demo outcome: still unreadable, matching the prototype's
  // "still unreadable — try a higher-quality scan" edge case.
  return review;
}
