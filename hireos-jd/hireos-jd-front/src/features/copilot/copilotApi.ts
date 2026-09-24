/**
 * Thin client for the real `hireos-jd-backend` Copilot endpoints
 * (`/api/copilot/conversations/...`). Used by GeminiPanel's "create a job"
 * flow in place of the offline `geminiLogic.ts` mock. The in-document "edit"
 * flow is untouched and keeps using the mock for now.
 */

import { API_BASE_URL } from "../../lib/apiBase";
import { safeRandomUUID } from "../../lib/uuid";

const BASE = `${API_BASE_URL}api/copilot/conversations`;

// Idempotency-Key needs real entropy: `lib/format`'s `uid()` is a page-load counter
// meant for cosmetic demo ids, so replaying the same UI flow (or an extra render
// pass) can regenerate the same value for a logically different request and get
// rejected by the backend as an idempotency conflict.
function idempotencyKey(prefix: string): string {
  return `${prefix}-${safeRandomUUID()}`;
}

export interface CopilotJdFields {
  title?: string;
  department?: string;
  location?: string;
  employmentType?: string;
  headcount?: number;
  roleSummary?: string;
  responsibilities?: string[];
  mustHave?: string[];
  niceToHave?: string[];
}

export interface CopilotMessageDto {
  id: string;
  role: "user" | "assistant";
  text: string | null;
  attachments?: unknown;
  sequence: number;
  createdAt: string;
}

export interface CopilotConversationDto {
  id: string;
  jobId: string | null;
  phase: "intake" | "drafting" | "ready_to_confirm" | "completed";
  fields: CopilotJdFields;
  missingFields: string[];
  stateRevision: number;
  createdAt: string;
  updatedAt: string;
  messages: CopilotMessageDto[];
}

async function request<T>(path: string, init: RequestInit & { idempotencyKey: string }): Promise<T> {
  const { idempotencyKey, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: { "content-type": "application/json", "idempotency-key": idempotencyKey, ...(headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Copilot request failed (${response.status})`);
  }
  return body as T;
}

export function createCopilotConversation(): Promise<CopilotConversationDto> {
  return request(BASE, { method: "POST", body: "{}", idempotencyKey: idempotencyKey("copilot-conv") });
}

/** History list: each item's `messages` is empty (the backend keeps list responses lightweight). */
export async function listCopilotConversations(): Promise<CopilotConversationDto[]> {
  const response = await fetch(BASE);
  const body = await response.json().catch(() => []);
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Copilot request failed (${response.status})`);
  }
  return body as CopilotConversationDto[];
}

export async function getCopilotConversation(conversationId: string): Promise<CopilotConversationDto> {
  const response = await fetch(`${BASE}/${conversationId}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Copilot request failed (${response.status})`);
  }
  return body as CopilotConversationDto;
}

/**
 * Streams a message turn over SSE: `onDelta` fires with each new chunk of the assistant's reply text
 * as the model generates it, and the returned promise resolves with the authoritative final
 * conversation state once the turn is fully committed server-side. The streamed text is purely
 * cosmetic — always trust the resolved conversation over anything accumulated from deltas, since a
 * cache-hit replay (same Idempotency-Key) or a mid-stream failure can mean the deltas never arrive.
 */
export async function streamCopilotMessage(
  conversationId: string,
  text: string,
  onDelta: (text: string) => void,
): Promise<CopilotConversationDto> {
  const response = await fetch(`${BASE}/${conversationId}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream", "idempotency-key": idempotencyKey("copilot-msg") },
    body: JSON.stringify({ text }),
  });
  if (!response.ok || !response.body) {
    const problem = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Copilot request failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const event = parseSseEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (event?.type === "assistant.delta") {
        onDelta((JSON.parse(event.data) as { text: string }).text);
      } else if (event?.type === "conversation.committed") {
        return JSON.parse(event.data) as CopilotConversationDto;
      } else if (event?.type === "error") {
        const problem = JSON.parse(event.data) as { code?: string; message?: string };
        throw new Error(problem.message || problem.code || "Copilot stream error");
      }
      boundary = buffer.indexOf("\n\n");
    }
  }
  throw new Error("Copilot stream ended unexpectedly");
}

function parseSseEvent(raw: string): { type: string; data: string } | null {
  let type = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  return dataLines.length > 0 ? { type, data: dataLines.join("\n") } : null;
}

/**
 * Uploads a PDF/DOCX/TXT file for one-shot bulk field extraction (as opposed to the conversational
 * one-question-at-a-time intake). Uses `FormData` directly rather than the shared `request()` helper,
 * since that helper always forces a `content-type: application/json` header — for multipart uploads
 * the browser must set its own `content-type` (with the multipart boundary) on the `fetch` call.
 */
export async function uploadCopilotAttachment(conversationId: string, file: File): Promise<CopilotConversationDto> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${BASE}/${conversationId}/attachments`, {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey("copilot-attach") },
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const problem = body as { code?: string; message?: string };
    throw new Error(problem.message || problem.code || `Copilot request failed (${response.status})`);
  }
  return body as CopilotConversationDto;
}

/**
 * Persists the collected fields as a real Job + JobDraft on the backend (which in turn creates the
 * Job on the Core Record service). This is a background write for now: the UI still navigates using
 * its local fixture job, since the rest of the app (JobWorkspacePage, etc.) doesn't read real backend
 * data yet. Call sites should treat failures as non-fatal — log, don't block the fixture flow on it.
 */
export function confirmCopilotDraft(conversationId: string): Promise<{ conversationId: string; jobId: string }> {
  return request(`${BASE}/${conversationId}/confirm-draft`, {
    method: "POST",
    idempotencyKey: idempotencyKey("copilot-confirm"),
  });
}

/**
 * Triggers the "auto-complete and optimize" turn: unlike a normal chat message, this asks the backend
 * to fill in every still-missing required field with reasonable, clearly-editable suggestions in one
 * shot rather than asking another clarifying question, landing straight on `ready_to_confirm`.
 */
export function autoCompleteCopilotConversation(conversationId: string): Promise<CopilotConversationDto> {
  return request(`${BASE}/${conversationId}/auto-complete`, {
    method: "POST",
    idempotencyKey: idempotencyKey("copilot-autocomplete"),
  });
}
