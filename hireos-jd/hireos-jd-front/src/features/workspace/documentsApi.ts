/**
 * Persistence for the job workspace document: `/api/jobs/:jobId/documents/:audience` holds the
 * edited document blocks, and `/api/jobs/:jobId/drafts/current` holds the structured JD content
 * (from Copilot) that seeds a document which has never been saved.
 */
import { API_BASE_URL } from "../../lib/apiBase";
import type { Audience, DocBlock, Suggestion } from "../../data/types";
import type { MoneyRange } from "../../lib/format";

const JOBS = `${API_BASE_URL}api/jobs`;

export interface JobDocumentDto {
  jobId: string;
  audience: Audience;
  blocks: DocBlock[];
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
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}`);
  if (response.status === 404) return null;
  return parseOrThrow<JobDocumentDto>(response);
}

export async function saveJobDocument(
  jobId: string,
  audience: Audience,
  blocks: DocBlock[],
  baseRevision?: number,
): Promise<JobDocumentDto> {
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocks, baseRevision }),
  });
  return parseOrThrow<JobDocumentDto>(response);
}

export async function getCurrentDraft(jobId: string): Promise<CurrentDraftDto | null> {
  const response = await fetch(`${JOBS}/${jobId}/drafts/current`);
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
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}/rewrite`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseOrThrow<RewriteResult>(response);
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
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}/suggestions`);
  return parseOrThrow<Suggestion[]>(response);
}

export async function createSuggestion(jobId: string, audience: Audience, body: NewSuggestion): Promise<Suggestion> {
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}/suggestions`, {
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
  const response = await fetch(`${JOBS}/${jobId}/documents/${audience}/suggestions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(patch),
  });
  return parseOrThrow<Suggestion>(response);
}
