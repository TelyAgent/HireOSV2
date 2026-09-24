// Interview domain model for data handed off from the Resume Screening subsystem.
//
// Per the platform PRD (docs/HireOS_Command_Interview_PRD_v1.5.md, Section 3/9) and the
// Interview Interface Spec (job-Interview-front/docs/HireOS_Command_Interview_Interface_Spec_v1.0.md,
// Section 3 "Entity Model & Data Ownership"):
//   - Job (JD) has a stable id and is owned by JD Management.
//   - Candidate/Resume is owned by the shared Candidate domain.
//   - Application = one Candidate + one Job (+ Workspace) — Interview calls this an
//     "Interview Project" / task. A Job can have many Applications (one per matched résumé);
//     a Job with zero Applications is still a valid JD-only draft (HOME-G01).
// Interview does not own Job/Candidate/Resume data — it only holds references (jobId,
// candidateId) plus its own task status, rounds and screening handoff snapshot.

export type JobId = string;
export type CandidateId = string;
export type TaskId = string;

export type RecruitingStatus = "open" | "paused" | "closed" | "unknown";

export interface Job {
  id: JobId;
  title: string;
  department: string;
  location: string;
  level: string;
  recruitingStatus: RecruitingStatus;
  /** When this JD was received by Interview (JD Management hand-off / import time). */
  createdAt: string;
}

export interface Resume {
  id: string;
  fileName: string;
  uploadedAt: string;
}

export interface Candidate {
  id: CandidateId;
  name: string;
  email: string;
  resume?: Resume;
}

export type TaskStatus =
  | "draft"
  | "requirements_ready"
  | "planning"
  | "ready_to_schedule"
  | "interview_in_progress"
  | "evidence_requested"
  | "awaiting_confirmation"
  | "package_published"
  | "on_hold"
  | "not_proceeding";

export type Tone = "ok" | "warn" | "bad" | "unknown";

export const TASK_STATUS_META: Record<TaskStatus, { en: string; zh: string; tone: Tone }> = {
  draft: { en: "Draft", zh: "草稿", tone: "unknown" },
  requirements_ready: { en: "Requirements ready", zh: "要求待确认", tone: "unknown" },
  planning: { en: "Planning", zh: "规划中", tone: "unknown" },
  ready_to_schedule: { en: "Ready to schedule", zh: "待排期", tone: "unknown" },
  interview_in_progress: { en: "Interview in progress", zh: "面试进行中", tone: "warn" },
  evidence_requested: { en: "Evidence requested", zh: "待补充证据", tone: "warn" },
  awaiting_confirmation: { en: "Awaiting confirmation", zh: "待确认", tone: "warn" },
  package_published: { en: "Package published", zh: "已发布", tone: "ok" },
  on_hold: { en: "On hold", zh: "暂停中", tone: "unknown" },
  not_proceeding: { en: "Not proceeding", zh: "不再继续", tone: "bad" },
};

/** Coarse bucket used by the homepage quick filters (All / Draft / Published / Needs confirmation). */
export function taskFilterBucket(status: TaskStatus): "Draft" | "Published" | "Needs my confirmation" | "Other" {
  if (status === "draft" || status === "requirements_ready" || status === "planning") return "Draft";
  if (status === "package_published") return "Published";
  if (status === "awaiting_confirmation") return "Needs my confirmation";
  return "Other";
}

export type ScreeningRecommendation = "strong_match" | "match" | "weak_match";

/** Snapshot of what Resume Screening handed off when this résumé was matched to this JD. */
export interface ScreeningHandoff {
  matchScore: number; // 0-100
  recommendation: ScreeningRecommendation;
  handedOffAt: string;
}

/**
 * A unique (Job, Candidate) pairing — the Application/Interview Project ("task") that
 * everything else in this module hangs off of. One résumé can only produce one task per JD;
 * matching the same résumé against N JDs produces N separate tasks.
 */
export interface InterviewTask {
  id: TaskId;
  jobId: JobId;
  candidateId: CandidateId;
  status: TaskStatus;
  roundsCompleted: number;
  roundsPlanned: number;
  /** Overrides the computed "x / y rounds completed" text for states like "Follow-up required". */
  progressNote?: { en: string; zh: string };
  /** Most recent round's label + interviewer, for the cluster-view candidate row. */
  currentRound?: { label: { en: string; zh: string }; interviewer: string } | null;
  screening: ScreeningHandoff;
  createdAt: string;
}
