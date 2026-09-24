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
}

export interface DuplicateReview {
  id: string;
  kind: DuplicateKind;
  status: "open" | "resolved";
  confidence?: number;
  uploaded: DuplicateUploadedSide;
  existing: DuplicateExistingSide;
  basis: string[];
  changeSummary?: string;
  resolutionLabel?: string;
  resolutionNote?: string;
  resolutionBy?: PersonId;
  resolutionAt?: string;
  resolutionOutcome?: DuplicateResolutionOutcome;
}
