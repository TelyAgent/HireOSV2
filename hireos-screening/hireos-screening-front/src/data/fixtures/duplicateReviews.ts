import type { PersonId } from "./people";

export type DuplicateKind = "exact_file" | "same_content" | "possible_same_person" | "new_resume_version" | "parse_failed";
export type DuplicateResolutionOutcome = "reuse_file" | "same_person_new_version" | "different_person" | "defer";

export interface DuplicateUploadedSide {
  fileName: string;
  uploadedAt: string;
  source: string;
  uploadedBy: PersonId;
  name: string;
  email?: string;
  phone?: string;
  location?: string;
  /** The résumé version this upload would become if it is the same person. */
  version?: number;
}
export interface DuplicateExistingSide {
  candidateId: string;
  fileName: string;
  uploadedAt: string;
  source: string;
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  version?: number;
  employment?: Array<{ company?: string; title?: string; start?: string; end?: string }>;
  education?: Array<{ statement?: string; school?: string; degree?: string; major?: string; period?: string }>;
}

export type ContactComparison = "same" | "different" | "missing_uploaded" | "missing_existing" | "missing_both";

/** The F03 identity score behind a check (#151): every signal and its points, the total and the policy version. */
export interface DuplicateScoring {
  policyVersion: string;
  total: number;
  band: string;
  signals: Array<{ key: string; points: number; detail: string }>;
  contentSimilarity: number | null;
  contact: { email: ContactComparison; phone: ContactComparison } | null;
}

export interface DuplicateReview {
  id: string;
  kind: DuplicateKind;
  status: "open" | "resolved";
  confidence?: number;
  uploaded: DuplicateUploadedSide;
  existing: DuplicateExistingSide;
  basis: string[];
  /** Absent on checks made before scoring. */
  scoring?: DuplicateScoring | null;
  /** Paragraphs only in the upload / only in the existing résumé. */
  differences?: { added: string[]; removed: string[]; unchanged: number } | null;
  changeSummary?: string;
  resolutionLabel?: string;
  resolutionNote?: string;
  resolutionBy?: PersonId;
  resolutionAt?: string;
  resolutionOutcome?: DuplicateResolutionOutcome;
  /** On a resolve response: someone (or an earlier click) had already decided; this is the outcome that stands. */
  alreadyResolved?: boolean;
}
