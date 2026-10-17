/**
 * Client for the real hireos-written-backend (`GET /api/tasks` — everything this backend has learned
 * about via a screening handoff). Deliberately denormalized on the wire (see WrittenTaskDto on the
 * backend) so `realTasksMerge.ts` can turn each row straight into fixture-shaped records without extra
 * round trips.
 */
import { API_BASE_URL } from "../utils/apiBase";
import { authFetch } from "../lib/session";

const BASE = `${API_BASE_URL}api`;

export interface RealWrittenTask {
  id: string;
  title: string;
  type: string;
  status: string;
  assignee: string | null;
  dueAt: string | null;
  createdAt: string;
  caseId: string;
  caseStatus: string;
  closeReason: "passed" | "rejected" | "withdrawn" | null;
  closedAt: string | null;
  closeDecision?: import('./fixtures').CloseDecision | null;
  handedOffAt: string | null;
  interviewTaskId: string | null;
  candidateId: string;
  candidateName: string;
  candidateEmail: string | null;
  jobId: string;
  jobTitle: string;
  jobDepartment: string | null;
  jobLocation: string | null;
}

/** One page of tasks, newest first; pass `nextCursor` back for the next page (#412). */
export interface RealWrittenTaskPage {
  items: RealWrittenTask[];
  nextCursor: string | null;
}

export async function listRealWrittenTasks(cursor?: string): Promise<RealWrittenTaskPage> {
  const response = await authFetch(`${BASE}/tasks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealWrittenTaskPage>;
}

/** My Tasks figures counted over every task in the workspace, not just the pages loaded (#412). */
export interface WrittenTaskStats {
  total: number;
  byCaseStatus: Record<string, number>;
  assignee: { open: number; inProgress: number; reviewsAwaiting: number; dueInRange: number | null };
}

export async function fetchWrittenTaskStats(query: { assignee: string; dueFrom: string; dueTo: string }): Promise<WrittenTaskStats> {
  const response = await authFetch(`${BASE}/tasks/stats?${new URLSearchParams(query).toString()}`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<WrittenTaskStats>;
}

export interface CaseAiContext {
  jobTitle: string;
  jdText: string | null;
  resumeText: string | null;
  candidateName: string;
}

/** Only cases created via a real screening handoff have this row — a 404 (fixture-only demo
 * case) means "no extra JD/resume context," not an error, so callers should treat it as optional. */
export async function fetchCaseAiContext(caseId: string): Promise<CaseAiContext | null> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/context`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<CaseAiContext>;
}

export interface GeneratedQuestion {
  title: string;
  prompt: string;
  competencies: { name: string; fraction: number }[];
}

export interface RealBankQuestion {
  revision: number;
  id: string;
  code: string;
  title: string;
  prompt: string;
  type: string;
  roles: string[];
  competencies: { name: string; fraction: number }[];
  difficulty: string;
  estMinutes: number;
  language: string;
  version: number;
  status: "published" | "draft_review" | "internal_only" | "concept";
  author: string | null;
  deliverables: string[];
  favorite: boolean;
  createdAt: string;
}

export async function listBankQuestions(): Promise<RealBankQuestion[]> {
  const response = await authFetch(`${BASE}/questions`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealBankQuestion[]>;
}

export async function createBankQuestion(input: {
  title: string;
  prompt: string;
  roles: string[];
  competencies: { name: string; fraction: number }[];
  language?: string;
  author?: string;
}): Promise<RealBankQuestion> {
  const response = await authFetch(`${BASE}/questions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<RealBankQuestion>;
}

/** Content edits create a draft revision; publishing allocates the immutable version. */
export async function updateBankQuestion(
  id: string,
  input: { expectedRevision?: number; title?: string; prompt?: string; roles?: string[]; competencies?: { name: string; fraction: number }[]; favorite?: boolean },
): Promise<RealBankQuestion> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<RealBankQuestion>;
}

export async function deleteBankQuestion(id: string): Promise<void> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await throwWithMessage(response);
}

export interface BankQuestionVersion {
  id: string; version: number; content: RealBankQuestion; historicalBaseline: boolean;
  publishedBy: string | null; publishedAt: string | null; createdAt: string;
}
export async function listBankQuestionVersions(id: string): Promise<BankQuestionVersion[]> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}/versions`);
  if (!response.ok) await throwWithMessage(response);
  return response.json();
}
export async function publishBankQuestion(id: string, expectedRevision: number): Promise<{ question: RealBankQuestion; replayed: boolean }> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}/publish`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision }) });
  if (!response.ok) await throwWithMessage(response);
  return response.json();
}

export interface QuestionDeprecation { id: string; version: number; actorId: string; createdAt: string }
export async function listQuestionDeprecations(id: string): Promise<QuestionDeprecation[]> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}/deprecations`);
  if (!response.ok) await throwWithMessage(response);
  return response.json();
}
export async function deprecateBankQuestion(id: string, expectedRevision: number): Promise<{ question: RealBankQuestion; replayed: boolean }> {
  const response = await authFetch(`${BASE}/questions/${encodeURIComponent(id)}/deprecate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ expectedRevision }) });
  if (!response.ok) await throwWithMessage(response);
  return response.json();
}

/** Scoring competencies for a hand-written Question Bank question, derived by AI from its content. */
export async function extractQuestionCompetencies(input: {
  title: string;
  prompt: string;
  roles?: string[];
  lang: "zh" | "en";
}): Promise<{ competencies: { name: string; fraction: number }[] }> {
  const response = await authFetch(`${BASE}/ai/extract-competencies`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ competencies: { name: string; fraction: number }[] }>;
}

export async function generateAiQuestion(input: {
  jobTitle: string;
  jdText?: string;
  resumeText?: string;
  focusBrief: string;
  lang: "zh" | "en";
}): Promise<GeneratedQuestion> {
  const response = await authFetch(`${BASE}/ai/generate-question`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<GeneratedQuestion>;
}

export interface QuestionSnapshot {
  questionId: string;
  code: string;
  title: string;
  prompt: string;
  competencies?: { name: string; fraction: number }[];
}

export interface RealEvaluation {
  overall: number;
  summary: string;
  criteria: {
    name: string; max: number; score: number; evidence: string;
    /** Excerpts of the answers behind the score, placed by question and lines (#378); absent on older evaluations. */
    quotes?: QuoteRef[];
    unlocatedQuotes?: number;
  }[];
}

export interface QuoteRef { questionId: string; text: string; lineFrom: number; lineTo: number }

export interface RealInvitation {
  id: string;
  /** 1, 2, ... in send order -- each invitation is one assessment round (#48). Listed oldest first. */
  round: number;
  token: string;
  questions: QuestionSnapshot[];
  mode: "timed" | "deadline_only";
  durationMin: number | null;
  deadline: string | null;
  status: string;
  createdAt: string;
  submission: RealSubmission | null;
}

export interface RealFinalCriterion { name: string; max: number; ai: number; human: number; overridden?: boolean; overrideReason?: string }
export interface RealReleaseInput { overall: number; showScore: boolean; outcomeText: string; feedbackText: string; nextStepText: string; assessmentOutcome?: "met" | "not_met" }

export interface RealSubmission {
  answers: { questionId: string; answerText: string }[];
  submittedAt: string;
  evaluation: RealEvaluation | null;
  /** Where the automatic scoring stands: it runs after the submission, never holding it up (#121). */
  evaluationStatus?: "pending" | "running" | "done" | "failed" | "skipped";
  evaluationError?: string | null;
  /** The round's scoring dimensions, for scoring by hand when there is no automatic scoring. */
  rubric?: { name: string; max: number }[];
  /** Set once a reviewer finalizes the scoring (Comprehensive evaluation tab). */
  finalEvaluation?: { overall: number; criteria: RealFinalCriterion[] } | null;
  finalizedBy?: string | null;
  finalizedAt?: string | null;
  /** Set once the result is published (Evaluation result tab) -- the case then awaits HR's next step (hand off / close / hold). */
  release?: RealReleaseInput | null;
  releasedAt?: string | null;
}

/** Persists the finalized scoring on the case's latest submission. Throws on a fixture-only demo case (404). */
export async function finalizeCaseEvaluation(
  caseId: string,
  // Who finalized is recorded by the server from the session (#134); the client doesn't name it.
  input: { overall: number; criteria: RealFinalCriterion[]; invitationId?: string },
): Promise<{ finalizedAt: string }> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/result/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ finalizedAt: string }>;
}

/** Persists the published result on the case's latest submission (must already be finalized). */
export async function releaseCaseResult(caseId: string, input: RealReleaseInput & { invitationId?: string; reviewComplete: boolean; disclosureApproved: boolean }): Promise<{ releasedAt: string }> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/result/release`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ releasedAt: string }>;
}

/** Only cases created via a real screening handoff can hold a real invitation — callers should
 * treat a thrown error here as "this candidate's data isn't backed by the real service yet." */
export async function createInvitation(
  caseId: string,
  input: {
    questions: QuestionSnapshot[];
    mode: "timed" | "deadline_only";
    durationMin?: number;
    deadline: string;
    disclosurePolicy: "score_and_summary" | "summary_only";
    recipientEmail: string;
    /** The candidate's language (#229); Chinese when left out. */
    locale?: "zh" | "en";
  },
): Promise<{ id: string; round: number; token: string; emailSent: boolean; emailError?: string }> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/invitations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ id: string; round: number; token: string; emailSent: boolean; emailError?: string }>;
}

/** What a lifecycle action (hold / resume / close / interview handoff) leaves the case as. */
export interface CaseLifecycleState {
  closeDecision?: import('./fixtures').CloseDecision | null;
  status: string;
  statusBeforeHold: string | null;
  closeReason: "passed" | "rejected" | "withdrawn" | null;
  closedAt: string | null;
  handedOffAt: string | null;
  interviewTaskId: string | null;
}

async function caseAction(caseId: string, action: string, body?: unknown): Promise<CaseLifecycleState> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<CaseLifecycleState>;
}

export const holdCase = (caseId: string) => caseAction(caseId, "hold");
export const resumeCase = (caseId: string) => caseAction(caseId, "resume");
export const closeCase = (caseId: string, reason: "passed" | "rejected" | "withdrawn", decisionReason?: string) => caseAction(caseId, "close", { reason, decisionReason });
/** Creates the candidate's interview task in hireos-interview (real cross-service call, via this backend). */
export const handoffCaseToInterview = (caseId: string) => caseAction(caseId, "interview-handoff");

export interface MailAccount {
  id: string;
  name: string;
  provider: "gmail" | "outlook" | "qq" | "163" | "126" | "custom";
  email: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  enabled: boolean;
  status: string;
  lastError: string | null;
  updatedAt: string;
  hasPassword: boolean;
}

export type MailAccountInput = {
  name: string;
  provider: MailAccount["provider"];
  email: string;
  password?: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

async function throwWithMessage(response: Response): Promise<never> {
  const body = await response.json().catch(() => null) as { code?: string; message?: string | string[]; details?: { fieldErrors?: Record<string, string[]> } } | null;
  const message = body?.code === "INVALID_SCHEMA" ? invalidSchemaMessage(body.details) : Array.isArray(body?.message) ? body.message.join("; ") : body?.message;
  throw new Error(message || `Request failed (${response.status})`);
}

/** A 422 INVALID_SCHEMA (the platform's validation error) as readable "field: problem" text. */
function invalidSchemaMessage(details?: { fieldErrors?: Record<string, string[]> }) {
  const entries = Object.entries(details?.fieldErrors ?? {});
  return entries.length ? entries.map(([field, errors]) => `${field}: ${errors.join(", ")}`).join("; ") : undefined;
}

export async function listMailAccounts(): Promise<MailAccount[]> {
  const response = await authFetch(`${BASE}/settings/mail-accounts`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<MailAccount[]>;
}

export interface MailConnectionInput {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export async function testMailAccount(input: MailConnectionInput): Promise<{ status: "ok" | "error"; message?: string }> {
  const response = await authFetch(`${BASE}/settings/mail-accounts/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<{ status: "ok" | "error"; message?: string }>;
}

export async function createMailAccount(input: MailAccountInput & { password: string }): Promise<MailAccount> {
  const response = await authFetch(`${BASE}/settings/mail-accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<MailAccount>;
}

export async function updateMailAccount(id: string, input: Partial<MailAccountInput>): Promise<MailAccount> {
  const response = await authFetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<MailAccount>;
}

export async function deleteMailAccount(id: string): Promise<void> {
  const response = await authFetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}

export async function setMailAccountEnabled(id: string, enabled: boolean): Promise<MailAccount> {
  const response = await authFetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}/enabled`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<MailAccount>;
}

export async function listCaseInvitations(caseId: string): Promise<RealInvitation[]> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/invitations`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealInvitation[]>;
}

/** The covering letter (greeting, introduction, HR sign-off) -- built by the backend, same as the email. */
export interface InvitationLetter {
  /** e.g. "2026-10-15 23:42（北京时间）"; null when no deadline is set. */
  deadlineText: string | null;
  /** e.g. "限时 90 分钟，打开题目后开始计时" or "不限作答时长". */
  timingText: string;
  greeting: string;
  paragraphs: string[];
  closing: string;
  signature: string[];
}

export interface PublicInvitation {
  /** The language the candidate is written to (#229). */
  locale?: "zh" | "en";
  candidateName: string;
  jobTitle: string;
  letter?: InvitationLetter;
  questions: QuestionSnapshot[];
  mode: "timed" | "deadline_only";
  durationMin: number | null;
  deadline: string | null;
  /** When the questions were first opened: a timed round's clock starts then (#129). */
  openedAt?: string | null;
  /** When answers are due — the deadline, or sooner in timed mode; the server refuses answers after it. */
  dueAt?: string | null;
  status: string;
  submission: { answers: { questionId: string; answerText: string }[]; submittedAt: string } | null;
}

export async function fetchPublicInvitation(token: string): Promise<PublicInvitation> {
  const response = await fetch(`${BASE}/public/invitations/${encodeURIComponent(token)}`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<PublicInvitation>;
}

export async function submitPublicInvitation(token: string, answers: { questionId: string; answerText: string }[]): Promise<void> {
  const response = await fetch(`${BASE}/public/invitations/${encodeURIComponent(token)}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ answers }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { code?: string } | null;
    throw Object.assign(new Error(`Request failed (${response.status})`), { code: body?.code });
  }
}

export interface RealPlanItem {
  id: string;
  kind: "required" | "optional";
  status: string;
  questionCode: string;
  questionTitle: string;
  questionPrompt: string;
  customPrompt: string | null;
  competencies: { name: string; fraction: number }[] | null;
  deliverables: string[] | null;
  /** #48: null = in the draft round (editable); otherwise the round invitation it was sent with (read-only). */
  invitationId: string | null;
  round: number | null;
  createdAt: string;
}

/** A case's round state (#48): sent rounds, the single open draft round (if any), and whether one can be opened. */
export interface RoundState {
  roundsSent: number;
  draftRound: { round: number; items: number } | null;
  canOpenRound: boolean;
}

export async function getRoundState(caseId: string): Promise<RoundState> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/rounds`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RoundState>;
}

/** "Add supplemental test": opens the next round as a draft (idempotent -- never more than one). */
export async function openDraftRound(caseId: string): Promise<RoundState> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/rounds/draft`, { method: "POST" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RoundState>;
}

/** Cancels an opened supplemental round that has no questions yet. */
export async function discardDraftRound(caseId: string): Promise<RoundState> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/rounds/draft`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RoundState>;
}

/** A 404 here means a fixture-only demo case with no real backend Case row — callers should treat
 * that as "nothing to load," not an error, and leave the case's fixture plan items untouched. */
export async function listPlanItems(caseId: string): Promise<RealPlanItem[]> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem[]>;
}

export async function createPlanItem(
  caseId: string,
  input: {
    bankQuestionId?: string;
    bankQuestionVersion?: number;
    kind: "required" | "optional";
    questionCode: string;
    questionTitle: string;
    questionPrompt: string;
    customPrompt?: string | null;
    competencies?: { name: string; fraction: number }[];
    deliverables?: string[];
  },
): Promise<RealPlanItem> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem>;
}

export async function updatePlanItem(caseId: string, id: string, input: { customPrompt?: string | null; status?: string }): Promise<RealPlanItem> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem>;
}

export async function deletePlanItem(caseId: string, id: string): Promise<void> {
  const response = await authFetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}

/* ---------------------------------------------------------------
   New-task entry: JD (new text or an existing job) + one résumé -> a written-test case.
   Errors surface as ApiCodeError(code) so the modal can explain them.
   --------------------------------------------------------------- */
export class ApiCodeError extends Error { constructor(public code: string) { super(code); } }

async function codeFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await authFetch(`${BASE}${path}`, init); } catch { throw new ApiCodeError("NETWORK_ERROR"); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiCodeError(error.code || (response.status === 413 ? "FILE_TOO_LARGE" : "REQUEST_FAILED"));
  }
  return response.json() as Promise<T>;
}

/** A file stored in Core Record (`id` is its Core material id) plus its extracted text. */
export interface UploadedMaterial { id: string; name: string; text: string; readStatus: string; errorCode: string | null }
export interface ExternalJob { id: string; title: string; team?: string; location?: string; seniority?: string; status: string }
export interface QuickStartResult { caseId: string; taskId: string; jobTitle: string; candidateName: string; duplicate: boolean }

export async function uploadMaterial(file: File): Promise<UploadedMaterial> {
  if (file.size > 10 * 1024 * 1024) throw new ApiCodeError("FILE_TOO_LARGE");
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new ApiCodeError("UNSUPPORTED_FILE_TYPE");
  const data = new FormData(); data.append("file", file);
  return codeFetch<UploadedMaterial>("/materials", { method: "POST", body: data });
}

export async function searchExternalJobs(query: string): Promise<ExternalJob[]> {
  return codeFetch<ExternalJob[]>(`/external-jobs${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ""}`);
}

export async function quickStart(
  input: { jd: { text: string; materialId?: string } | { coreJobId: string }; resumeMaterialId: string },
  idempotencyKey: string,
): Promise<QuickStartResult> {
  return codeFetch<QuickStartResult>("/quick-start", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  });
}
