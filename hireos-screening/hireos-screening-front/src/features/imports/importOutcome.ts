import type { ImportItemResult, ImportOutcome } from "../../data/api/imports";
import type { BadgeTone } from "../../components/ui/Primitives";

export const OUTCOME_BADGE: Record<ImportOutcome, { tone: BadgeTone; label: string }> = {
  exact_file: { tone: "neutral", label: "Already exists — reused" },
  new_resume_version: { tone: "warning", label: "Newer version — review needed" },
  possible_same_person: { tone: "warning", label: "Possible duplicate — review needed" },
  new_candidate: { tone: "success", label: "Added to library" },
  quarantined: { tone: "danger", label: "Quarantined" },
  parse_failed: { tone: "danger", label: "Parse failed" },
  too_large: { tone: "danger", label: "File too large" },
  unsupported_type: { tone: "danger", label: "Unsupported file type" },
};

export const OUTCOME_DETAIL: Record<ImportOutcome, string> = {
  exact_file: "Identical to a file already on record — content reused, this upload logged as a new source.",
  new_resume_version: "Same contact details as the existing candidate, newer content — needs confirmation.",
  possible_same_person: "Name matches an existing candidate, contact details differ — identity unclear.",
  new_candidate: "New candidate, no conflicts — added to the Resume Library. No job selected.",
  quarantined: "Isolated for security review — not sent to parsing or AI.",
  parse_failed:
    "Could not extract readable text from this scan. Duplicate check could not run — this is shown as incomplete, not “no duplicates found.”",
  too_large: "File exceeds the 20 MB limit. Not uploaded.",
  unsupported_type: "Unsupported file type. Only PDF, DOCX and TXT are accepted. Not uploaded.",
};

/**
 * Why a file failed, by its error code (#162 #163 #165 #166): what happened and what to do next. Never the raw
 * code or a server phrase like "Bad Request Exception". `reselect`: choosing another file is the way forward.
 */
export const FILE_ERROR: Record<string, { label: string; detail: string; reselect: boolean }> = {
  EMPTY_FILE: { label: "Empty file", detail: "The file is empty. Choose a file with content.", reselect: true },
  UNSUPPORTED_FILE_TYPE: {
    label: "Unsupported file type",
    detail: "Only PDF, DOCX and TXT files are accepted. Choose another file.",
    reselect: true,
  },
  FILE_TOO_LARGE: { label: "File too large", detail: "The file is too large. Choose a smaller file.", reselect: true },
  FILE_UNREADABLE: {
    label: "File damaged",
    detail: "The file is damaged or can't be parsed. Choose the file again, or another copy of it.",
    reselect: true,
  },
  OCR_REQUIRED: {
    label: "Scan without readable text",
    detail: "This PDF is a scan with no readable text. Upload a version with selectable text, or paste the text instead.",
    reselect: true,
  },
  NO_EXTRACTABLE_TEXT: { label: "No readable text", detail: "No readable text was found in this file. Choose another file.", reselect: true },
  DOCUMENT_TOO_LONG: { label: "Document too long", detail: "The document has too much text to process. Upload a shorter version.", reselect: true },
  PDF_TOO_MANY_PAGES: {
    label: "More than 10 pages",
    detail: "This PDF has more than 10 pages, the limit for a résumé. Shorten it, then choose it again.",
    reselect: true,
  },
  PDF_ENCRYPTED: {
    label: "Quarantined — password-protected",
    detail: "This PDF is password-protected, so it was isolated and not parsed or sent to AI. Remove the password, then upload it again.",
    reselect: true,
  },
};

/** Scan findings that isolate a file (see the backend's SecurityScanService). */
const QUARANTINE_FINDING = {
  label: "Quarantined",
  detail: "This file contains executable or active content, so it was isolated and not parsed or sent to AI. Upload a clean copy.",
  reselect: true,
};
const QUARANTINE_CODES = new Set(["EXECUTABLE_SIGNATURE_DETECTED", "SCRIPT_SHEBANG_DETECTED", "PDF_ACTIVE_CONTENT_DETECTED", "OFFICE_MACRO_DETECTED", "SECURITY_QUARANTINED"]);

export function formatFileSize(sizeKB: number): string {
  return sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
}

const STAGE_LABEL: Record<string, string> = {
  received: "Received — queued for validation",
  validating: "Validating file",
  stored: "File stored",
  extracting: "Extracting text",
  candidate_creation: "Creating candidate record",
};

const DUPLICATE_RESOLUTION_DETAIL: Record<string, { tone: BadgeTone; label: string; detail: string }> = {
  duplicate_resolved_same_person_new_version: {
    tone: "success",
    label: "Merged as new version",
    detail: "Reviewer confirmed this is the same person — saved as a new resume version.",
  },
  duplicate_resolved_different_person: {
    tone: "success",
    label: "Kept as different person",
    detail: "Reviewer confirmed this is a different person — added as a separate candidate.",
  },
  duplicate_resolved_reuse_file: {
    tone: "neutral",
    label: "Reused existing file",
    detail: "Reviewer confirmed this content is already on record — no new version created.",
  },
};

/** A real upload only reaches its final outcome once the async candidate-creation
 * job (or a human duplicate-review decision) completes — the item's `status`/`stage`
 * always reflect current truth, `outcome` is a snapshot that can still be "processing".
 * This resolves display state from `status` first, falling back to the static
 * outcome tables above only once the item is in a genuinely terminal state. */
export function describeItem(item: ImportItemResult): { tone: BadgeTone; label: string; detail: string; reselect?: boolean } {
  if (item.status === "processing") {
    return {
      tone: "neutral",
      label: "Processing…",
      detail: (item.stage && STAGE_LABEL[item.stage]) || "Processing…",
    };
  }
  if (item.status === "cancelled") {
    return { tone: "neutral", label: "Cancelled", detail: "This item was cancelled before it finished processing." };
  }
  if (item.outcome && DUPLICATE_RESOLUTION_DETAIL[item.outcome]) {
    return DUPLICATE_RESOLUTION_DETAIL[item.outcome];
  }
  // A failed or isolated file: its specific reason first, so e.g. a damaged PDF isn't called a scan (#165).
  const failure = item.errorCode && (FILE_ERROR[item.errorCode] ?? (QUARANTINE_CODES.has(item.errorCode) ? QUARANTINE_FINDING : null));
  if (failure && (item.status === "failed" || item.outcome === "quarantined" || item.outcome === "parse_failed")) {
    return { tone: "danger", ...failure };
  }
  const badge = OUTCOME_BADGE[item.outcome as ImportOutcome];
  if (badge) {
    return { ...badge, detail: OUTCOME_DETAIL[item.outcome as ImportOutcome] };
  }
  if (item.status === "failed") {
    // An unknown failure still reads as one, without an internal code (#166).
    return { tone: "danger", label: "Import failed", detail: "This file could not be imported. Try again, or choose another file." };
  }
  return { tone: "neutral", label: item.status || item.outcome, detail: item.errorMessage || item.status || item.outcome };
}
