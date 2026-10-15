/**
 * Keeps one job-page Copilot request inside the backend's JSON body limit (Nest/Express default 100 KB),
 * measured on the whole request — selection, target block, status and document together (#106 review).
 */
import type { AskRequest } from "./documentsApi";

/** Whole-request budget, with margin under the backend's 102400-byte limit. */
export const MAX_ASK_BYTES = 90_000;
/** Room kept for the document next to an explicit selection, so the answer still has the JD's context. */
const MIN_DOCUMENT_BYTES = 10_000;

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

/** The backend's per-field limits on a selection (characters), mirrored so a request is never refused there. */
const MAX_SELECTION_CHARS = 8_000;
const MAX_TARGET_CHARS = 20_000;
const MAX_TARGET_ITEMS = 200;

function selectionFits(selection: NonNullable<AskRequest["selection"]>): boolean {
  const { text, target } = selection;
  return (
    text.length <= MAX_SELECTION_CHARS &&
    (target.text ?? "").length <= MAX_TARGET_CHARS &&
    (target.items ?? []).length <= MAX_TARGET_ITEMS &&
    (target.items ?? []).every((item) => item.length <= MAX_TARGET_CHARS)
  );
}

export type FitResult = { body: AskRequest; truncated: boolean } | { tooLarge: true };

/**
 * Fits one request into the budget without ever changing what an edit would replace (#106 review): an
 * explicit selection and its block are sent whole or not at all (`tooLarge` → ask for a shorter
 * selection); the block the cursor merely sits in is dropped when it's too big, and the question is
 * answered from the document. The document gets whatever room is left; `truncated` says it was cut.
 */
export function fitAskRequest(body: AskRequest): FitResult {
  const fullDoc = body.context.documentText ?? "";
  let selection = body.selection;
  const withoutDoc = (sel: AskRequest["selection"]): AskRequest => ({ ...body, selection: sel, context: { ...body.context, documentText: "" } });
  // JSON escaping can add bytes beyond the raw text (quotes, newlines), so measure the encoded form.
  const roomWith = (sel: AskRequest["selection"]) => MAX_ASK_BYTES - bytes(JSON.stringify(withoutDoc(sel)));
  // The selection must leave a little room for the document; otherwise it is too big to send whole.
  if (selection && (!selectionFits(selection) || roomWith(selection) < MIN_DOCUMENT_BYTES)) {
    if (!selection.implicit) return { tooLarge: true };
    selection = undefined;
  }
  const rest = withoutDoc(selection);
  const room = roomWith(selection);
  if (room < 0) return { tooLarge: true };
  let documentText = fitBytes(fullDoc, room);
  while (documentText && bytes(JSON.stringify(documentText)) - 2 > room) documentText = fitBytes(documentText, bytes(documentText) - 2_000);
  return { body: { ...rest, context: { ...rest.context, documentText } }, truncated: documentText.length < fullDoc.length };
}
