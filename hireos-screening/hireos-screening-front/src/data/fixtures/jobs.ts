import type { PersonId } from "./people";

export interface CompRange {
  min: number | null;
  max: number | null;
  currency: string;
  period: "year" | "month" | "hour";
  basis: "gross" | "net" | "unknown";
}

export interface Dimension {
  id: string;
  name: string;
  weight: number;
  rubric: string;
}

export type RequirementPriority = "must_have" | "nice_to_have";
export type RequirementKind = "authorization" | "experience" | "skill" | "other";
export interface Requirement {
  id: string;
  label: string;
  dimension: string;
  priority: RequirementPriority;
  hard: boolean;
  kind: RequirementKind;
}

export type JobStatus = "draft" | "open" | "closed" | "paused";
export type CriteriaStatus = "draft" | "confirmed";

export interface WorkflowPolicy {
  assessmentDisposition: "required" | "optional";
  decisionApprovalsRequired: number;
  exceptionApprovalRoles: PersonId[];
}

export interface Job {
  id: string;
  title: string;
  team: string;
  location: string;
  employmentType: string;
  seniority: string;
  status: JobStatus;
  closedAt?: string;
  pausedAt?: string;
  pausedReason?: string;
  hiringManager: PersonId;
  recruiter: PersonId;
  criteriaStatus: CriteriaStatus;
  criteriaVersion: number;
  confirmedBy?: PersonId;
  confirmedAt?: string;
  compRange: CompRange;
  responsibilities: string[];
  requirements: Requirement[];
  dimensions: Dimension[];
  workflowPolicy?: WorkflowPolicy;
  openings: number;
  applicantCount: number;
  assessmentRequired?: boolean;
}

/** Canonical dimension pool per PRD §5.3 — used to populate the "add dimension" picker. */
export const DIMENSION_POOL = [
  "Skills",
  "Relevant Experience",
  "Seniority",
  "Industry",
  "Company Context",
  "Role Similarity",
  "Scope & Ownership",
  "Achievement",
  "Startup / 0→1",
  "Leadership",
  "Location",
  "Compensation",
  "Compensation & Location Fit",
  "Education",
  "Language",
];
