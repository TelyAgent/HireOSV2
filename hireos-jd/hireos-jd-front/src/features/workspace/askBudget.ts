/**
 * Keeps one job-page Copilot request inside the backend's JSON body limit (Nest/Express default 100 KB),
 * measured on the whole request — selection, target block, status and document together (#106 review).
 */
import type { AskRequest } from "./documentsApi";

/** Whole-request budget, with margin under the backend's 102400-byte limit. */
export const MAX_ASK_BYTES = 90_000;
const MAX_SELECTION_BYTES = 8_000;
const MAX_TARGET_BYTES = 16_000;

const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).length;

/** The longest prefix of `text` that fits in `maxBytes` of UTF-8. */
export function fitBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (bytes(text) <= maxBytes) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (bytes(text.slice(0, mid)) <= maxBytes) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo);
}

/**
 * Trims the selection and its block to fixed shares, then gives the document whatever is left of the
 * budget. `truncated` is true when any of the document had to be left out, so the answer can say so.
 */
export function fitAskRequest(body: AskRequest): { body: AskRequest; truncated: boolean } {
  const fullDoc = body.context.documentText ?? "";
  let selection = body.selection;
  if (selection) {
    const target = selection.target.items
      ? {
          ...selection.target,
          items: selection.target.items.map((item) => fitBytes(item, Math.floor(MAX_TARGET_BYTES / Math.max(1, selection!.target.items!.length)))),
        }
      : { ...selection.target, text: selection.target.text === undefined ? undefined : fitBytes(selection.target.text, MAX_TARGET_BYTES) };
    selection = { ...selection, text: fitBytes(selection.text, MAX_SELECTION_BYTES), target };
  }
  const rest: AskRequest = { ...body, selection, context: { ...body.context, documentText: "" } };
  // JSON escaping can add bytes beyond the raw text (quotes, newlines), so measure the encoded form.
  const room = MAX_ASK_BYTES - bytes(JSON.stringify(rest));
  let documentText = fitBytes(fullDoc, room);
  while (documentText && bytes(JSON.stringify(documentText)) - 2 > room) documentText = fitBytes(documentText, bytes(documentText) - 2_000);
  return { body: { ...rest, context: { ...rest.context, documentText } }, truncated: documentText.length < fullDoc.length };
}
