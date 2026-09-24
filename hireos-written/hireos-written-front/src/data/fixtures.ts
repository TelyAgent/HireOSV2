/**
 * Seed fixture data, ported from docs/hireos-assessment-prototype.html's
 * `freshSeed()`. No backend exists yet for this subsystem (hireos-written,
 * PORTS.md reserves 3008) — every page reads from this in-memory data until
 * one is built. IDs, statuses and cross-references are kept exactly as in
 * the prototype so page logic (status badges, filters, evidence links)
 * ports over unchanged.
 */

export const DEMO_CLOCK_BASE = "2026-09-11T08:00:00Z";
export const TZ = "Asia/Shanghai";

export interface CoreCandidate {
  id: string;
  name: string;
  email: string;
  userId: string;
  profileVersion: string;
  profileNote?: string;
}

export interface CoreJob {
  id: string;
  title: string;
  roleVersionId?: string;
  jobRefId?: string | null;
  sourceUrl?: string | null;
  workspaceId: string;
  qualityNote?: string;
  duplicateOf?: string;
}

export interface CoreApplication {
  id: string;
  candidateId: string;
  jobId: string;
  cycleId: string;
  status: string;
}

export interface CoreFile {
  id: string;
  name: string;
  versions: { ver: number; status: string; size: string; checksum: string }[];
}

export const CORE_CANDIDATES: Record<string, CoreCandidate> = {};

export const CORE_JOBS: Record<string, CoreJob> = {};

export const CORE_APPLICATIONS: Record<string, CoreApplication> = {};

export const CORE_FILES: Record<string, CoreFile> = {};

export const PROJECT = { id: "prj_fin", name: "Finance Operations Hiring", jobId: "core_job_fin", status: "active", requiredCase: "q_fin001", optionalCase: "q_fin002", secondaryRole: "Strategic Investment Associate" };

export interface Competency { name: string; fraction: number }
export interface Question {
  id: string; code: string; title: string; type: string; roles: string[]; competencies: Competency[];
  difficulty: string; estMinutes: number; language: string; version: number;
  status: "published" | "draft_review" | "internal_only" | "concept";
  author: string; favorite: boolean;
  prompt: string; materials: string[]; deliverables: string[];
  /** Every hand-authored bank question has one; an AI-generated question (see AssessmentQuestionDrawer)
   * doesn't get one at creation time — there's no internal answer key to write until someone reviews it. */
  rubricNote?: string;
  usageCount: number; seenByCount: number; pendingFractionIssue?: boolean;
}

// Filled at runtime only: real plan items (data/realPlanItemsMerge.ts) and AI-generated questions.
export const QUESTIONS: Record<string, Question> = {};

export interface Round { id: string; position: number; title: string; planItemIds: string[]; releaseCondition: string; dependsOnRoundIds?: string[]; deadlineAt: string | null; status: string }
export interface Case {
  id: string; candidateId: string; applicationId: string; label: string; planItems: string[]; status: string;
  ownership: { hrOwner: string | null; hiringManager: string | null; reviewAssignee: string | null };
  roundMode: "single" | "multiple"; rounds: Round[];
  /** Set when an assessment question is added to a case after its result was already released —
   * flags the candidate's task as needing another look (pending_submission) until the new round
   * clears. Only ever written by the "add assessment question" drawer. */
  supplementalPending?: boolean;
}

export const CASES: Record<string, Case> = {};

// ScreeningSelectionContext: candidates Screening already matched/scored for this role,
// handed off for HR/HM to pick from — not yet linked to any Assessment Case. Selecting
// one reuses that screening artifact rather than re-uploading a résumé.
export interface ScreeningPoolEntry { candidateId: string; name: string; email: string; jobId: string; screeningResultRef: string; screeningArtifactRef: string; recommendation: string; screeningScore: number; screenedAt: string }
export const SCREENING_POOL: ScreeningPoolEntry[] = [];

export interface PlanItem {
  id: string; caseId: string; questionId: string; kind: "required" | "optional"; status: string;
  /** Per-candidate override of the question's prompt text — set by the "Edit question" drawer (a
   * later phase); never changes the shared Question Bank preset. */
  customPrompt?: string | null;
}
export const PLANS: Record<string, PlanItem> = {};

export interface Invitation {
  id: string; caseId: string; questionIds: string[]; mode: "timed" | "deadline_only"; durationMin?: number; deadline: string;
  status: string; acceptedAt: string | null; startedAt: string | null; disclosurePolicy: string; note?: string;
  /** Set only when this invitation was created via hireos-written-backend's real /cases/:id/invitations
   * endpoint — the public candidate-facing form at /apply/:token is only reachable for these. */
  token?: string;
}
export const INVITATIONS: Record<string, Invitation> = {};

export interface Attempt { id: string; caseId: string; questionId: string; round: number; status: string; submittedAt?: string; fileRef: string; receivedAt: string; processedAt?: string; missing?: string[] }
export const ATTEMPTS: Record<string, Attempt> = {};

export interface Criterion { name: string; max: number; ai: number; human: number | null; confidence: string; coverage: string; overridden?: boolean; overrideReason?: string; evidence: string; source: string }
export interface Evaluation { id: string; attemptId: string; status: "ai_draft" | "final"; finalizedBy: string | null; finalizedAt: string | null; criteria: Criterion[] }
export const EVALUATIONS: Record<string, Evaluation> = {};

export interface Result { id: string; caseId: string; evaluationId: string; overall: number; status: string; releaseId: string | null }
export const RESULTS: Record<string, Result> = {};

export interface Release {
  id: string; caseId: string; overall: number; showScore: boolean; outcomeText: string; feedbackText: string; nextStepText: string; publishedAt: string;
  /** Set once "Request revision" is confirmed — mirrors the prototype's release.nextAction. */
  nextAction?: "revision";
}
export const RELEASES: Record<string, Release> = {};

export interface Comparison { id: string; caseIds: string[]; mode: string; createdAt: string; note: string }
export const COMPARISONS: Record<string, Comparison> = {};

// A revision round requested after a Release (see ReleasePage's "Request revision" flow).
// Empty in the seed — none of the demo cases has an open revision yet; RevisionPage
// handles the "not yet requested" state explicitly.
export interface Revision { id: string; caseId: string; round: number; status: string; acceptedAt: string | null; revisionHint?: string }
export const REVISIONS: Record<string, Revision> = {};

export interface Mail { id: string; from: string; subject: string; receivedAt: string; authStatus: string; threadStatus: string; matchReason: string; classification: string; caseId: string | null; attachments: string[]; missing?: string[] }
export const MAIL: Record<string, Mail> = {};

export interface Task { id: string; title: string; type: string; assignee: string | null; queue?: string; status: string; waitingReason?: string; waitingUntil?: string; dueAt: string; link: string; sourceRef: string }
// Filled only with real tasks from hireos-written-backend at runtime (see data/realTasksMerge.ts).
export const TASKS: Record<string, Task> = {};

export interface DeliveryStep { label: string; state: "done" | "pending"; at: string | null }
export interface Delivery { id: string; caseId: string; target: string; status: string; timeline: DeliveryStep[] }
export const DELIVERIES: Record<string, Delivery> = {};

export const FILES_LIST: string[] = [];
export interface FileConnection { id: string; name: string; kind: string; scope: string; status: string; lastSync: string }
export const FILE_CONNECTIONS: FileConnection[] = [];

export const ACTIVITY: { at: string; text: string }[] = [];

export interface AiModelTask { task: string; primary: string; fallback: string; budget: string; status: "ok" | "fallback_active"; note?: string }
export const AI_MODEL_TASKS: AiModelTask[] = [
  { task: "question_generate", primary: "Claude Opus 4.6", fallback: "Claude Sonnet 4.5", budget: "$40 / week", status: "ok" },
  { task: "quality_review", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$10 / week", status: "ok" },
  { task: "evidence_map", primary: "Claude Sonnet 4.5", fallback: "Claude Haiku 4.5", budget: "$25 / week", status: "ok" },
  { task: "rubric_evaluate", primary: "Claude Opus 4.6", fallback: "Claude Sonnet 4.5", budget: "$60 / week", status: "fallback_active", note: "Primary model timed out on 2026-09-11 06:10 UTC — approved fallback engaged automatically." },
  { task: "feedback_draft", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$15 / week", status: "ok" },
  { task: "candidate_compare", primary: "Claude Sonnet 4.5", fallback: "—", budget: "$10 / week", status: "ok" },
];

/** Demo clock — resolves to a fixed base instant + an offset the "advance clock" demo tool adds. */
export function nowISO(clockOffsetMin: number): string {
  const base = new Date(DEMO_CLOCK_BASE).getTime() + clockOffsetMin * 60000;
  return new Date(base).toISOString();
}
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: TZ });
}
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: TZ });
}
export function timeAgo(iso: string, clockOffsetMin: number): string {
  if (!iso) return "—";
  const diff = new Date(nowISO(clockOffsetMin)).getTime() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.round(hrs / 24) + "d ago";
}
