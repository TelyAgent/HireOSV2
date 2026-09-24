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

/** Evidence items referenced by EVALUATIONS' dimensionScores.supporting/counter. */
export const EVIDENCE: Record<string, Evidence> = {
  "ev-alex-1": { id: "ev-alex-1", candidateId: "cand-alex", sourceLabel: "alex_morgan_resume_v2.pdf", kind: "documented_fact", statement: "Led migration of the monolith checkout service to a service-oriented architecture serving 40M requests/day.", locator: { type: "pdf", page: 1, section: "Experience — Northwind Systems" }, verification: "unverified", confidence: 0.8, availability: "available" },
  "ev-alex-2": { id: "ev-alex-2", candidateId: "cand-alex", sourceLabel: "alex_morgan_resume_v2.pdf", kind: "documented_fact", statement: "6+ years across two backend engineering roles (Fenwick Data, Northwind Systems).", locator: { type: "pdf", page: 1, section: "Experience" }, verification: "unverified", confidence: 0.85, availability: "available" },
  "ev-alex-3": { id: "ev-alex-3", candidateId: "cand-alex", sourceLabel: "alex_morgan_resume_v2.pdf", kind: "candidate_claim", statement: "Owned end-to-end reduction of checkout p99 latency from 820ms to 210ms.", locator: { type: "pdf", page: 1, section: "Experience — Northwind Systems" }, verification: "unverified", confidence: 0.6, availability: "available" },
  "ev-alex-4": { id: "ev-alex-4", candidateId: "cand-alex", sourceLabel: "Cover note", kind: "candidate_claim", statement: "Cover note is clearly structured and specific about technical scope and impact.", locator: { type: "text", section: "Cover note" }, verification: "unverified", confidence: 0.5, availability: "available" },

  "ev-jordan-1": { id: "ev-jordan-1", candidateId: "cand-jordan", sourceLabel: "jordan_lee_resume.pdf", kind: "candidate_claim", statement: "Describes building the full analytics platform stack solo, including infra, data model and rollout.", locator: { type: "pdf", page: 1, section: "Experience — Solo Ventures" }, verification: "unverified", confidence: 0.55, availability: "available" },
  "ev-jordan-2": { id: "ev-jordan-2", candidateId: "cand-jordan", sourceLabel: "jordan_lee_resume.pdf", kind: "documented_fact", statement: "5 years across Founding Engineer (2022–2024) and Software Engineer (2019–2021) roles.", locator: { type: "pdf", page: 1, section: "Experience" }, verification: "unverified", confidence: 0.75, availability: "available" },
  "ev-jordan-3": { id: "ev-jordan-3", candidateId: "cand-jordan", sourceLabel: "jordan_lee_resume.pdf", kind: "candidate_claim", statement: "Built and shipped an internal analytics platform from scratch as the sole engineer — 0 to production in 4 months.", locator: { type: "pdf", page: 1, section: "Experience — Solo Ventures" }, verification: "unverified", confidence: 0.7, availability: "available" },
  "ev-jordan-4": { id: "ev-jordan-4", candidateId: "cand-jordan", sourceLabel: "Cover note", kind: "candidate_claim", statement: "Cover note is well organized; limited detail on cross-functional collaboration.", locator: { type: "text", section: "Cover note" }, verification: "unverified", confidence: 0.5, availability: "available" },
  "ev-jordan-5": { id: "ev-jordan-5", candidateId: "cand-jordan", sourceLabel: "Application form", kind: "documented_fact", statement: "Stated compensation expectation: $150,000–$175,000/yr, Seattle, WA.", locator: { type: "text", section: "Application form" }, verification: "unverified", confidence: 0.9, availability: "available" },

  "ev-casey-1": { id: "ev-casey-1", candidateId: "cand-casey", sourceLabel: "casey_chen_resume.docx", kind: "documented_fact", statement: "4 years as a Software Engineer at Harborline Tech on the order-management platform.", locator: { type: "text", section: "Experience" }, verification: "unverified", confidence: 0.6, availability: "available" },
  "ev-casey-2": { id: "ev-casey-2", candidateId: "cand-casey", sourceLabel: "casey_chen_resume.docx", kind: "candidate_claim", statement: '"Contributed to backend services for the order-management platform" — scope of individual ownership is not specified.', locator: { type: "text", section: "Experience" }, verification: "unverified", confidence: 0.4, availability: "available" },
  "ev-casey-3": { id: "ev-casey-3", candidateId: "cand-casey", sourceLabel: "Reference: former manager (phone, notes on file)", kind: "third_party_claim", statement: '"Casey consistently presented complex technical tradeoffs to non-technical stakeholders clearly and was requested by name for exec reviews."', locator: { type: "manual", noteId: "ref-note-casey-1" }, verification: "verified", confidence: 0.8, availability: "available" },

  "ev-riley-1": { id: "ev-riley-1", candidateId: "cand-riley", sourceLabel: "riley_thompson_resume.pdf", kind: "documented_fact", statement: "Owns the inventory-sync service at Cobalt Logic (99.95% uptime, per resume).", locator: { type: "pdf", page: 1, section: "Experience — Cobalt Logic" }, verification: "unverified", confidence: 0.65, availability: "available" },

  "ev-morganb-1": { id: "ev-morganb-1", candidateId: "cand-morganb", sourceLabel: "morgan_blake_resume.pdf", kind: "documented_fact", statement: "3 years maintaining internal tooling services at Ferrous Cloud.", locator: { type: "pdf", page: 1, section: "Experience" }, verification: "unverified", confidence: 0.6, availability: "available" },
  "ev-morganb-2": { id: "ev-morganb-2", candidateId: "cand-morganb", sourceLabel: "Recruiter compliance note", kind: "documented_fact", statement: "Candidate confirmed by phone that continued US employment requires H-1B visa transfer; this requisition’s budget does not include sponsorship.", locator: { type: "manual", noteId: "note-morganb-1" }, verification: "verified", confidence: 0.9, availability: "restricted", restrictedReason: "Contains work-authorization detail; visible to authorized HR/HM roles only." },
};
