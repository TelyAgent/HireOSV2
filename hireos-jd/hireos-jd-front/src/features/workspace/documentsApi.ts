/**
 * Persistence for the job workspace document: `/api/jobs/:jobId/documents/:audience` holds the
 * edited document blocks, and `/api/jobs/:jobId/drafts/current` holds the structured JD content
 * (from Copilot) that seeds a document which has never been saved.
 */
import { API_BASE_URL } from "../../lib/apiBase";
import type { Audience, DocBlock, DocMeta, Suggestion } from "../../data/types";
import type { MoneyRange } from "../../lib/format";
import { authFetch } from "../../lib/session";

const JOBS = `${API_BASE_URL}api/jobs`;

export interface JobDocumentDto {
  jobId: string;
  audience: Audience;
  blocks: DocBlock[];
  meta: DocMeta | null;
  revision: number;
  updatedBy: string;
  updatedAt: string;
}

export interface CurrentDraftDto {
  roleSummary: string | null;
  responsibilities: string[];
  requirements: { label?: string; priority?: string }[];
  internalCompensation: MoneyRange | null;
  publicCompensation: MoneyRange | null;
  hiringContext?: { businessProblem?: string; expectedOutcomes?: string[] } | null;
  successCriteria?: { period?: string; statement?: string }[] | null;
  sourceRefs?: { kind?: string; url?: string }[];
}

/** Public job links the draft was read from (#64), for showing where its content came from. */
export function sourceLinks(content: CurrentDraftDto | null): string[] {
  return (content?.sourceRefs ?? [])
    .filter((ref) => ref.kind === "link" && typeof ref.url === "string" && /^https?:\/\//i.test(ref.url))
    .map((ref) => ref.url as string);
}

async function parseOrThrow<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Request failed (${response.status})`);
  }
  return body as T;
}

export async function getJobDocument(jobId: string, audience: Audience): Promise<JobDocumentDto | null> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}`);
  if (response.status === 404) return null;
  return parseOrThrow<JobDocumentDto>(response);
}

export async function saveJobDocument(
  jobId: string,
  audience: Audience,
  blocks: DocBlock[],
  baseRevision?: number,
  meta?: DocMeta,
): Promise<JobDocumentDto> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocks, baseRevision, meta }),
  });
  return parseOrThrow<JobDocumentDto>(response);
}

export async function getCurrentDraft(jobId: string): Promise<CurrentDraftDto | null> {
  const response = await authFetch(`${JOBS}/${jobId}/drafts/current`);
  if (response.status === 404) return null;
  return parseOrThrow<CurrentDraftDto>(response);
}

export interface RewriteRequest {
  selectedText: string;
  instruction?: string;
  action: "rewrite" | "shorten" | "clarify" | "custom";
  target: { kind: string; text?: string; items?: string[] };
  scope: "fragment" | "items";
  context: { jobTitle?: string; department?: string; documentText?: string };
}

export interface RewriteResult {
  text: string;
  items: string[] | null;
  explain: string;
  reason: string;
}

/** AI rewrite of a selected part of the document — backs the Copilot side panel. */
export async function rewriteDocumentSelection(jobId: string, audience: Audience, body: RewriteRequest): Promise<RewriteResult> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}/rewrite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<RewriteResult>(response);
}

export interface AskRequest {
  message: string;
  /** The selected text or clicked block; omitted when the user just asks. */
  selection?: { text: string; target: RewriteRequest["target"]; scope: RewriteRequest["scope"]; implicit?: boolean };
  context: RewriteRequest["context"] & { readiness?: string; documentTruncated?: boolean };
}

/** What the job-page Copilot did with a typed message; only `edit` becomes a suggestion (#106 #107). */
export type AskResult =
  | { kind: "answer"; intent: "answer" | "research" | "action" | "off_topic"; text: string; sources: { title: string; url: string }[]; contextScope: "selection" | "document" }
  | ({ kind: "edit" } & RewriteResult)
  | { kind: "no_change"; explain: string }
  | { kind: "needs_target" };

export async function askDocumentCopilot(jobId: string, audience: Audience, body: AskRequest): Promise<AskResult> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<AskResult>(response);
}

export interface NewSuggestion {
  anchorBlock: string;
  author: "ai" | "human";
  initiatedBy: string;
  instruction: string;
  oldText: string;
  newText: string;
  newItems?: string[] | null;
  reason: string;
  supersedes?: string | null;
}

/** Proposed document changes persisted per job document, so they survive reloads and are shared. */
export async function listSuggestions(jobId: string, audience: Audience): Promise<Suggestion[]> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}/suggestions`);
  return parseOrThrow<Suggestion[]>(response);
}

export async function createSuggestion(jobId: string, audience: Audience, body: NewSuggestion): Promise<Suggestion> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}/suggestions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<Suggestion>(response);
}

export async function updateSuggestion(
  jobId: string,
  audience: Audience,
  id: string,
  patch: Partial<Pick<Suggestion, "status" | "staleReason" | "newText" | "newItems">>,
): Promise<Suggestion> {
  const response = await authFetch(`${JOBS}/${jobId}/documents/${audience}/suggestions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseOrThrow<Suggestion>(response);
}

/* ---------------- completeness-standard AI ---------------- */

export interface AiBlock {
  id: string;
  kind: string;
  level: "public" | "internal" | "confidential";
  /** Heading of the section the block sits in. */
  section: string;
  /** Omitted for Confidential blocks — their text never leaves the browser for AI (standard V5). */
  text?: string;
}
export interface AiContext {
  jobTitle?: string;
  level?: string;
  location?: string;
  department?: string;
  headcount?: number;
  language?: "zh" | "en";
}
export interface AiSectionRequest {
  mode: "draft" | "fix";
  itemId: string;
  label: string;
  hint: string;
  issue?: string;
  list: boolean;
  current?: string[];
  context: AiContext;
  blocks: AiBlock[];
}
export interface AiFinding {
  id: string;
  status: "weak" | "missing";
  severity: "blocker" | "warning" | "suggestion";
  evidence: string;
  reason: string;
  suggestion: string;
  blockId: string | null;
}
export interface AiAnalysis {
  verdict: "ready" | "needs_work" | "blocked";
  summary: string;
  items: AiFinding[];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await authFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return parseOrThrow<T>(response);
}

/** Drafts a missing section, or revises one that fails a completeness rule. */
export function aiSection(jobId: string, audience: Audience, body: AiSectionRequest) {
  return postJson<{ items: string[]; explain: string; toConfirm?: string[] }>(`${JOBS}/${jobId}/documents/${audience}/ai/section`, body);
}

/** The judgement-based review against the completeness standard (advisory; the rule check gates publishing). */
export function aiAnalyze(jobId: string, audience: Audience, body: { context: AiContext; blocks: AiBlock[] }) {
  return postJson<AiAnalysis>(`${JOBS}/${jobId}/documents/${audience}/ai/analyze`, body);
}
