import { CopilotRequestError } from "./copilotApi";

/**
 * Plain-language explanation of a failed Copilot request (#33): what happened and what to do — never
 * a raw code like `IDENTITY_UNAVAILABLE` or a status number. Returns an English source string for `t()`.
 */
export function describeCopilotError(error: unknown): string {
  if (error instanceof CopilotRequestError) {
    // The server runs without an AI key (#35): AI features are off, manual creation still works.
    if (error.code === "AI_NOT_CONFIGURED") return "AI isn’t set up on this server yet, so Copilot can’t draft for now. Use “Create Manually”, or ask an admin to configure AI.";
    if (error.status === 401 || error.code === "AUTH_REQUIRED") return "Your sign-in has expired. Refresh the page and sign in again, then retry.";
    if (error.status === 403) return "You don’t have permission to do this. Ask an admin for access.";
    if (error.code === "INVALID_SCHEMA" && error.fieldPaths.includes("fields.title")) return "Job title can be at most 200 characters.";
    // Upload problems the user fixes by picking another file (#82).
    if (error.status === 413 || error.code === "ATTACHMENT_TOO_LARGE") return ATTACHMENT_TOO_LARGE;
    if (error.code === "ATTACHMENT_FILE_EMPTY") return ATTACHMENT_FILE_EMPTY;
    if (error.status === 429) return "Copilot is getting too many requests right now. Wait a moment, then retry.";
    if (error.status === 0 || error.status >= 500 || error.code === "IDENTITY_UNAVAILABLE") {
      return "Copilot is temporarily unavailable. Your input is kept — retry in a moment.";
    }
    return isReadable(error.message) ? error.message : GENERIC;
  }
  // fetch() rejects with a TypeError when the network or the server can't be reached at all.
  if (error instanceof TypeError) return "Couldn’t reach Copilot. Check your connection, then retry.";
  if (error instanceof Error && isReadable(error.message)) return error.message;
  return GENERIC;
}

/** Same limit as the backend's `MAX_ATTACHMENT_BYTES`. */
export const MAX_ATTACHMENT_MB = 10;
export const ATTACHMENT_TOO_LARGE = "This file is larger than the 10 MB limit. Compress or split it, then choose it again.";
export const ATTACHMENT_FILE_EMPTY = "This file is empty (0 bytes). Choose a file that has the JD in it.";

const GENERIC ="Sorry, Copilot couldn’t process that just now. Your input is kept — please retry.";

/** Backend validation messages are sentences; codes (`SOME_CODE`) and "request failed (503)" are not. */
function isReadable(message: string) {
  return !!message && !/^[A-Z0-9_]+$/.test(message) && !/\(\d{3}\)|request failed|stream (error|ended)/i.test(message);
}
