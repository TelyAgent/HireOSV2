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
  quarantined: "File appears password-protected. Isolated for security review — not sent to parsing or AI.",
  parse_failed:
    "Could not extract readable text from this scan. Duplicate check could not run — this is shown as incomplete, not “no duplicates found.”",
  too_large: "File exceeds the 25 MB limit. Not uploaded.",
  unsupported_type: "Unsupported file type. Only PDF, DOCX and TXT are accepted. Not uploaded.",
};

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
export function describeItem(item: ImportItemResult): { tone: BadgeTone; label: string; detail: string } {
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
  const badge = OUTCOME_BADGE[item.outcome as ImportOutcome];
  if (badge) {
    return { ...badge, detail: OUTCOME_DETAIL[item.outcome as ImportOutcome] };
  }
  if (item.status === "failed") {
    return { tone: "danger", label: item.errorCode || "Failed", detail: item.errorMessage || "This item failed to process." };
  }
  return { tone: "neutral", label: item.status || item.outcome, detail: item.errorMessage || item.status || item.outcome };
}
