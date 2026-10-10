/**
 * Client for the real hireos-written-backend (`GET /api/tasks` — everything this backend has learned
 * about via a screening handoff). Deliberately denormalized on the wire (see WrittenTaskDto on the
 * backend) so `realTasksMerge.ts` can turn each row straight into fixture-shaped records without extra
 * round trips.
 */
import { API_BASE_URL } from "../utils/apiBase";

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

export async function listRealWrittenTasks(): Promise<RealWrittenTask[]> {
  const response = await fetch(`${BASE}/tasks`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealWrittenTask[]>;
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
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/context`);
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
  const response = await fetch(`${BASE}/questions`);
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
  const response = await fetch(`${BASE}/questions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<RealBankQuestion>;
}

/** Any subset -- a content change (title/prompt/competencies) bumps the question's version server-side. */
export async function updateBankQuestion(
  id: string,
  input: { title?: string; prompt?: string; roles?: string[]; competencies?: { name: string; fraction: number }[]; favorite?: boolean },
): Promise<RealBankQuestion> {
  const response = await fetch(`${BASE}/questions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<RealBankQuestion>;
}

export async function deleteBankQuestion(id: string): Promise<void> {
  const response = await fetch(`${BASE}/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) await throwWithMessage(response);
}

/** Scoring competencies for a hand-written Question Bank question, derived by AI from its content. */
export async function extractQuestionCompetencies(input: {
  title: string;
  prompt: string;
  roles?: string[];
  lang: "zh" | "en";
}): Promise<{ competencies: { name: string; fraction: number }[] }> {
  const response = await fetch(`${BASE}/ai/extract-competencies`, {
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
  const response = await fetch(`${BASE}/ai/generate-question`, {
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
  criteria: { name: string; max: number; score: number; evidence: string }[];
}

export interface RealInvitation {
  id: string;
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
export interface RealReleaseInput { overall: number; showScore: boolean; outcomeText: string; feedbackText: string; nextStepText: string }

export interface RealSubmission {
  answers: { questionId: string; answerText: string }[];
  submittedAt: string;
  evaluation: RealEvaluation | null;
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
  input: { overall: number; criteria: RealFinalCriterion[]; finalizedBy?: string },
): Promise<{ finalizedAt: string }> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/result/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ finalizedAt: string }>;
}

/** Persists the published result on the case's latest submission (must already be finalized). */
export async function releaseCaseResult(caseId: string, input: RealReleaseInput): Promise<{ releasedAt: string }> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/result/release`, {
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
  },
): Promise<{ id: string; token: string; emailSent: boolean; emailError?: string }> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/invitations`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<{ id: string; token: string; emailSent: boolean; emailError?: string }>;
}

/** What a lifecycle action (hold / resume / close / interview handoff) leaves the case as. */
export interface CaseLifecycleState {
  status: string;
  statusBeforeHold: string | null;
  closeReason: "passed" | "rejected" | "withdrawn" | null;
  closedAt: string | null;
  handedOffAt: string | null;
  interviewTaskId: string | null;
}

async function caseAction(caseId: string, action: string, body?: unknown): Promise<CaseLifecycleState> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) await throwWithMessage(response);
  return response.json() as Promise<CaseLifecycleState>;
}

export const holdCase = (caseId: string) => caseAction(caseId, "hold");
export const resumeCase = (caseId: string) => caseAction(caseId, "resume");
export const closeCase = (caseId: string, reason: "passed" | "rejected" | "withdrawn") => caseAction(caseId, "close", { reason });
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
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  const message = Array.isArray(body?.message) ? body.message.join("; ") : body?.message;
  throw new Error(message || `Request failed (${response.status})`);
}

export async function listMailAccounts(): Promise<MailAccount[]> {
  const response = await fetch(`${BASE}/settings/mail-accounts`);
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
  const response = await fetch(`${BASE}/settings/mail-accounts/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<{ status: "ok" | "error"; message?: string }>;
}

export async function createMailAccount(input: MailAccountInput & { password: string }): Promise<MailAccount> {
  const response = await fetch(`${BASE}/settings/mail-accounts`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<MailAccount>;
}

export async function updateMailAccount(id: string, input: Partial<MailAccountInput>): Promise<MailAccount> {
  const response = await fetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) return throwWithMessage(response);
  return response.json() as Promise<MailAccount>;
}

export async function deleteMailAccount(id: string): Promise<void> {
  const response = await fetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}

export async function setMailAccountEnabled(id: string, enabled: boolean): Promise<MailAccount> {
  const response = await fetch(`${BASE}/settings/mail-accounts/${encodeURIComponent(id)}/enabled`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<MailAccount>;
}

export async function listCaseInvitations(caseId: string): Promise<RealInvitation[]> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/invitations`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealInvitation[]>;
}

export interface PublicInvitation {
  candidateName: string;
  jobTitle: string;
  questions: QuestionSnapshot[];
  mode: "timed" | "deadline_only";
  durationMin: number | null;
  deadline: string | null;
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
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
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
  createdAt: string;
}

/** A 404 here means a fixture-only demo case with no real backend Case row — callers should treat
 * that as "nothing to load," not an error, and leave the case's fixture plan items untouched. */
export async function listPlanItems(caseId: string): Promise<RealPlanItem[]> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items`);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem[]>;
}

export async function createPlanItem(
  caseId: string,
  input: {
    kind: "required" | "optional";
    questionCode: string;
    questionTitle: string;
    questionPrompt: string;
    customPrompt?: string | null;
    competencies?: { name: string; fraction: number }[];
    deliverables?: string[];
  },
): Promise<RealPlanItem> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem>;
}

export async function updatePlanItem(caseId: string, id: string, input: { customPrompt?: string | null; status?: string }): Promise<RealPlanItem> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RealPlanItem>;
}

export async function deletePlanItem(caseId: string, id: string): Promise<void> {
  const response = await fetch(`${BASE}/cases/${encodeURIComponent(caseId)}/plan-items/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
}
