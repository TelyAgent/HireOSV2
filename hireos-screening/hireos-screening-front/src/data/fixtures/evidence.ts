export type EvidenceKind = "documented_fact" | "candidate_claim" | "third_party_claim";
export type EvidenceLocator =
  | { type: "pdf"; page: number; section: string }
  | { type: "text"; section: string }
  | { type: "manual"; noteId: string };

export interface Evidence {
  id: string;
  candidateId: string;
  sourceLabel: string;
  kind: EvidenceKind;
  statement: string;
  locator: EvidenceLocator;
  verification: "unverified" | "verified";
  confidence: number;
  availability: "available" | "restricted";
  restrictedReason?: string;
}
