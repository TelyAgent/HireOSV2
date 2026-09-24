import { daysAgo } from "../../lib/daysAgo";
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

export const JOB_A_DIMENSIONS: Dimension[] = [
  {
    id: "dim-tech",
    name: "Technical Depth & Systems Design",
    weight: 0.3,
    rubric: "Depth of hands-on technical contribution, architecture judgement, and systems tradeoffs.",
  },
  {
    id: "dim-exp",
    name: "Relevant Experience",
    weight: 0.25,
    rubric: "How closely prior roles map to backend engineering at this scope.",
  },
  {
    id: "dim-own",
    name: "Ownership & 0→1 Delivery",
    weight: 0.2,
    rubric: "Evidence of driving work from ambiguity to shipped outcomes with limited resources.",
  },
  {
    id: "dim-comm",
    name: "Communication & Collaboration",
    weight: 0.15,
    rubric: "Clarity of written/verbal communication and cross-functional collaboration evidence.",
  },
  {
    id: "dim-comp",
    name: "Compensation & Location Fit",
    weight: 0.1,
    rubric: "Whether compensation expectation and location/work authorization align with role constraints.",
  },
];

/** Neutral starting point for newly created jobs — deliberately not biased
 * toward any function. Must be reviewed/adjusted per role before confirming. */
export const DEFAULT_NEUTRAL_DIMENSIONS: Dimension[] = [
  {
    id: "dim-skills",
    name: "Skills",
    weight: 0.25,
    rubric: "How closely the candidate's stated skills match the core skills this role requires.",
  },
  {
    id: "dim-relexp",
    name: "Relevant Experience",
    weight: 0.25,
    rubric: "How closely prior roles and responsibilities map to what this role actually does.",
  },
  {
    id: "dim-seniority",
    name: "Seniority",
    weight: 0.25,
    rubric: "Whether the candidate's level of experience matches the seniority this role calls for.",
  },
  {
    id: "dim-complocation",
    name: "Compensation & Location Fit",
    weight: 0.25,
    rubric: "Whether compensation expectation and location/work authorization align with role constraints.",
  },
];

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

export const JOBS: Record<string, Job> = {
  "job-a": {
    id: "job-a",
    title: "Senior Backend Engineer",
    team: "Platform Engineering",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Senior",
    status: "open",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "confirmed",
    criteriaVersion: 3,
    confirmedBy: "daniel",
    confirmedAt: daysAgo(21),
    compRange: { min: 165000, max: 205000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: [
      "Own core services powering checkout and payments infrastructure",
      "Design for reliability and scale across a distributed systems footprint",
      "Partner with product and other engineering teams to scope and ship 0→1 initiatives",
    ],
    requirements: [
      { id: "req-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-exp", label: "5+ years professional backend engineering experience", dimension: "dim-exp", priority: "must_have", hard: true, kind: "experience" },
      { id: "req-dist", label: "Experience with distributed systems at meaningful scale", dimension: "dim-tech", priority: "must_have", hard: false, kind: "skill" },
      { id: "req-loc", label: "Comfortable with Pacific-adjacent overlap hours", dimension: "dim-comp", priority: "nice_to_have", hard: false, kind: "other" },
      { id: "req-own", label: "Track record of owning a project from ambiguity to launch", dimension: "dim-own", priority: "nice_to_have", hard: false, kind: "other" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    workflowPolicy: { assessmentDisposition: "required", decisionApprovalsRequired: 1, exceptionApprovalRoles: ["emma", "daniel"] },
    openings: 1,
    applicantCount: 0,
  },
  "job-b": {
    id: "job-b",
    title: "Engineering Lead",
    team: "Platform Engineering",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Lead",
    status: "open",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "confirmed",
    criteriaVersion: 1,
    confirmedBy: "daniel",
    confirmedAt: daysAgo(10),
    compRange: { min: 195000, max: 240000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: [
      "Lead a team of 5–8 backend and platform engineers",
      "Set technical direction across service boundaries",
      "Partner with HM and staff engineers on org-level architecture decisions",
    ],
    requirements: [
      { id: "req-b-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-b-mgmt", label: "2+ years of direct people management experience", dimension: "dim-own", priority: "must_have", hard: true, kind: "experience" },
      { id: "req-b-tech", label: "Strong hands-on technical background in distributed backend systems", dimension: "dim-tech", priority: "must_have", hard: false, kind: "skill" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    workflowPolicy: { assessmentDisposition: "optional", decisionApprovalsRequired: 1, exceptionApprovalRoles: ["emma", "daniel"] },
    openings: 1,
    applicantCount: 0,
  },
  "job-c": {
    id: "job-c",
    title: "Data Platform Engineer",
    team: "Data Infrastructure",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Mid-Senior",
    status: "closed",
    closedAt: daysAgo(6),
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "confirmed",
    criteriaVersion: 1,
    confirmedBy: "daniel",
    confirmedAt: daysAgo(40),
    compRange: { min: 160000, max: 195000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: ["Own data pipeline reliability", "Build self-serve data tooling for analytics teams"],
    requirements: [
      { id: "req-c-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-c-exp", label: "3+ years data engineering experience", dimension: "dim-exp", priority: "must_have", hard: true, kind: "experience" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    openings: 1,
    applicantCount: 0,
  },
  "job-d": {
    id: "job-d",
    title: "Product Manager, Growth",
    team: "Growth",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Senior",
    status: "open",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "draft",
    criteriaVersion: 0,
    compRange: { min: 150000, max: 185000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: [
      "Own the growth roadmap across acquisition, activation and retention experiments",
      "Partner with engineering and design to ship and evaluate weekly experiments",
      "Define and report on north-star growth metrics to leadership",
    ],
    requirements: [
      { id: "req-d-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-d-exp", label: "4+ years of product management experience", dimension: "dim-exp", priority: "must_have", hard: true, kind: "experience" },
      { id: "req-d-data", label: "Comfortable running and interpreting A/B experiments", dimension: "dim-tech", priority: "nice_to_have", hard: false, kind: "skill" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    openings: 2,
    applicantCount: 0,
  },
  "job-e": {
    id: "job-e",
    title: "Site Reliability Engineer",
    team: "Infrastructure",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Mid-Senior",
    status: "paused",
    pausedAt: daysAgo(4),
    pausedReason: "Headcount under budget review — expected to reopen next quarter.",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "confirmed",
    criteriaVersion: 1,
    confirmedBy: "daniel",
    confirmedAt: daysAgo(30),
    compRange: { min: 170000, max: 210000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: ["Own production reliability and on-call tooling", "Drive incident response process and postmortems"],
    requirements: [
      { id: "req-e-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-e-exp", label: "4+ years of SRE / infrastructure experience", dimension: "dim-exp", priority: "must_have", hard: true, kind: "experience" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    openings: 1,
    applicantCount: 0,
  },
  "job-f": {
    id: "job-f",
    title: "Customer Success Manager",
    team: "Customer Success",
    location: "Remote (US)",
    employmentType: "Full-time",
    seniority: "Mid",
    status: "open",
    hiringManager: "daniel",
    recruiter: "emma",
    criteriaStatus: "confirmed",
    criteriaVersion: 1,
    confirmedBy: "daniel",
    confirmedAt: daysAgo(12),
    compRange: { min: 95000, max: 120000, currency: "USD", period: "year", basis: "gross" },
    responsibilities: ["Own a book of enterprise accounts through onboarding and renewal", "Partner with sales on expansion opportunities"],
    requirements: [
      { id: "req-f-auth", label: "Authorized to work in the United States", dimension: "dim-comp", priority: "must_have", hard: true, kind: "authorization" },
      { id: "req-f-exp", label: "3+ years of B2B customer success or account management experience", dimension: "dim-exp", priority: "must_have", hard: true, kind: "experience" },
    ],
    dimensions: JOB_A_DIMENSIONS,
    openings: 1,
    applicantCount: 0,
  },
};
