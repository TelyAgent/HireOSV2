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
  prompt: string;
  competencies: { name: string; fraction: number }[];
  deliverables: string[];
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
  submission: { answers: { questionId: string; answerText: string }[]; submittedAt: string } | null;
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
