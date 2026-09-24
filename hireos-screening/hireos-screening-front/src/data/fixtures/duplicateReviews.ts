import { daysAgo, hoursAgo } from "../../lib/daysAgo";
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

export const DUPLICATE_REVIEWS: Record<string, DuplicateReview> = {
  "dup-am-identity": {
    id: "dup-am-identity",
    kind: "possible_same_person",
    status: "open",
    uploaded: {
      fileName: "alex_morgan_recruiting.pdf",
      uploadedAt: hoursAgo(20),
      source: "Manual upload",
      uploadedBy: "emma",
      name: "Alex Morgan",
      email: "alex.morgan.demo@example.com",
      phone: "+1 (512) 555-0142",
      location: "Austin, TX, US",
    },
    existing: {
      candidateId: "cand-am2",
      fileName: "a_morgan_finance_resume.pdf",
      uploadedAt: daysAgo(11),
      source: "Email import",
      name: "Alex Morgan",
      email: "a.morgan.finance@example.com",
      phone: "+1 (415) 555-0199",
      location: "San Francisco, CA, US",
    },
    basis: ["Same display name", "Different email and phone on file", "Different city/state"],
  },
  "dup-am-version": {
    id: "dup-am-version",
    kind: "new_resume_version",
    status: "open",
    uploaded: {
      fileName: "alex_morgan_resume_v2.pdf",
      uploadedAt: daysAgo(2),
      source: "Manual upload",
      uploadedBy: "emma",
      name: "Alex Morgan",
      email: "alex.morgan.demo@example.com",
    },
    existing: { candidateId: "cand-alex", fileName: "alex_morgan_resume.pdf", uploadedAt: daysAgo(19), source: "Manual upload" },
    basis: ["Same name, email and phone as existing candidate", "Content differs — new achievements added", "More recent upload date"],
    changeSummary: "Added detail on the checkout-latency project and clarified ownership of the service migration.",
  },
};
