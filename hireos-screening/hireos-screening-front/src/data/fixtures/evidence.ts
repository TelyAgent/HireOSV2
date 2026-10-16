export type EvidenceKind = "documented_fact" | "candidate_claim" | "third_party_claim";
export type EvidenceLocator =
  | { type: "pdf"; page: number; section: string }
  | { type: "text"; section: string }
  | { type: "manual"; noteId: string };

export interface Evidence {
  id: string;
  candidateId?: string;
  sourceLabel: string;
  kind: EvidenceKind | string;
  statement: string;
  /** Fixture-era locator; real evidence uses `location` below. */
  locator?: EvidenceLocator;
  verification: "unverified" | "verified" | string;
  confidence: number | null;
  availability: "available" | "restricted" | string;
  restrictedReason?: string;
  /** The material the excerpt is from, and its résumé version (#192). */
  materialId?: string;
  resumeVersion?: number;
  /** Where the excerpt sits in that material. */
  location?: { segmentId: string; page: number | null; paragraph: number } | null;
  /** Whether the excerpt was found in the material, or the material can't be read. */
  located?: "located" | "not_located" | "source_unavailable";
}
