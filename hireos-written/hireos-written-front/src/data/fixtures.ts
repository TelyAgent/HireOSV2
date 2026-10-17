import { formatDate, formatDateTime, relativeTime, type DisplayLang } from "../utils/calendar";
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
  usageCount: number | null; seenByCount: number | null; pendingFractionIssue?: boolean;
  /** Set on a question that only exists for one candidate's plan (AI-generated in the plan drawer, or
   * the per-case copy of a real PlanItem) -- it lives in QUESTIONS so plan/send/submission helpers can
   * resolve it, but it is never part of the reusable Question Bank. */
  caseScoped?: boolean;
}

/** The reusable Question Bank -- QUESTIONS minus per-candidate, case-scoped questions. */
export function bankQuestions(): Question[] {
  return Object.values(QUESTIONS).filter((q) => !q.caseScoped);
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
  /** Real cases only (hireos-written-backend Case): set once testing ended / was handed to Interview. */
  closeReason?: "passed" | "rejected" | "withdrawn" | null;
  closedAt?: string | null;
  handedOffAt?: string | null;
  interviewTaskId?: string | null;
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

export interface Attempt { id: string; caseId: string; questionId: string; round: number; /** Real cases: the round's invitation (#48). */ invitationId?: string; status: string; submittedAt?: string; fileRef: string; receivedAt: string; processedAt?: string; missing?: string[] }
export const ATTEMPTS: Record<string, Attempt> = {};

export interface Criterion {
  name: string; max: number; ai: number; human: number | null; confidence: string; coverage: string; overridden?: boolean; overrideReason?: string; evidence: string; source: string;
  /** Scored by hand: there is no AI score for it (#121). */ manual?: boolean;
  /** Answer excerpts behind the AI score (#378): undefined when the evaluation predates them. */
  quotes?: { questionId: string; text: string; lineFrom: number; lineTo: number }[];
  /** Excerpts the AI gave that the answers don't contain, left out. */
  unlocatedQuotes?: number;
}
/** A round's answers in question order, for showing an excerpt in its answer (#378). Filled with real submissions. */
export const ANSWERS: Record<string, { questionId: string; title: string; answerText: string }[]> = {};
export interface Evaluation { id: string; attemptId: string; status: "ai_draft" | "final"; finalizedBy: string | null; finalizedAt: string | null; criteria: Criterion[]; /** Real cases: the AI evaluator's overall comment on the answers. */ summary?: string; /** Real cases: where the automatic scoring stands when there is none yet (#121). */ aiStatus?: "pending" | "running" | "done" | "failed" | "skipped"; aiError?: string | null }
export const EVALUATIONS: Record<string, Evaluation> = {};

export interface Result { id: string; caseId: string; evaluationId: string; overall: number; status: string; releaseId: string | null; /** Real cases: the round this result belongs to (#48). */ invitationId?: string; round?: number }
export const RESULTS: Record<string, Result> = {};

export interface Release {
  id: string; caseId: string; overall: number; showScore: boolean; outcomeText: string; feedbackText: string; nextStepText: string; publishedAt: string;
}
export const RELEASES: Record<string, Release> = {};

export interface Comparison { id: string; caseIds: string[]; mode: string; createdAt: string; note: string }
export const COMPARISONS: Record<string, Comparison> = {};

export interface Mail { id: string; from: string; subject: string; receivedAt: string; authStatus: string; threadStatus: string; matchReason: string; classification: string; caseId: string | null; attachments: string[]; missing?: string[] }
export const MAIL: Record<string, Mail> = {};

export interface Task { id: string; title: string; type: string; assignee: string | null; queue?: string; status: string; waitingReason?: string; waitingUntil?: string; dueAt: string; createdAt?: string; link: string; sourceRef: string }
// Filled only with real tasks from hireos-written-backend at runtime (see data/realTasksMerge.ts).
export const TASKS: Record<string, Task> = {};

export const FILES_LIST: string[] = [];
export interface FileConnection { id: string; name: string; kind: string; scope: string; status: string; lastSync: string }
export const FILE_CONNECTIONS: FileConnection[] = [];

export const ACTIVITY: { at: string; text: string }[] = [];

/** Demo clock — resolves to a fixed base instant + an offset the "advance clock" demo tool adds. */
export function nowISO(clockOffsetMin: number): string {
  const base = new Date(DEMO_CLOCK_BASE).getTime() + clockOffsetMin * 60000;
  return new Date(base).toISOString();
}
/** The interface language dates are written in (#237) — set by LocaleSync from the app's language. */
let displayLang: DisplayLang = "en";
export function setDisplayLang(lang: DisplayLang) {
  displayLang = lang;
}
// Times are shown in the demo's fixed zone (TZ, as the spec requires), written in the interface language.
export function fmtDate(iso: string | null | undefined): string {
  return formatDateTime(iso, displayLang, TZ);
}
export function fmtDateShort(iso: string | null | undefined): string {
  return formatDate(iso, displayLang, TZ);
}
export function timeAgo(iso: string, clockOffsetMin: number): string {
  return relativeTime(iso, nowISO(clockOffsetMin), displayLang);
}
