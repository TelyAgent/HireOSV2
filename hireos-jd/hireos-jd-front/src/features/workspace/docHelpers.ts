/**
 * Document-draft helpers for the job workspace.
 *
 * A job has one document. Every block carries its own visibility level (Public / Internal /
 * Confidential — JD completeness standard §1.3), and every bullet is its own `ul` block holding a
 * single item so it can be classified, reordered and deleted on its own. `normalizeBlocks` brings
 * documents saved before this model (multi-item lists, no levels) into that shape when they load.
 */
import { mkBlock } from "../../data/fixtures/documents";
import { money } from "../../lib/format";
import type { AppState } from "../../store/types";
import type { CurrentDraftDto } from "./documentsApi";
import type { Audience, BlockLevel, DocBlock, DocumentDraft, Suggestion } from "../../data/types";

/** The workspace edits a single document; it is still stored under the backend's "internal" slot. */
export const DOC_AUDIENCE: Audience = "internal";

export function docKey(jobId: string, audience: Audience = DOC_AUDIENCE) {
  return `${jobId}:${audience}`;
}

export const BLOCK_LEVELS: Record<BlockLevel, { label: string; icon: string; hint: string }> = {
  public: { label: "Public", icon: "public", hint: "Shown on external postings" },
  internal: { label: "Internal", icon: "groups", hint: "Visible to people with access to this job" },
  confidential: { label: "Confidential", icon: "lock", hint: "Restricted — never shown externally, AI is disabled" },
};
export const BLOCK_LEVEL_KEYS = Object.keys(BLOCK_LEVELS) as BlockLevel[];

const CONFIDENTIAL_HINT = /ceiling|budget|backfill|restricted|confidential|内部预算|薪资上限|保密/i;
const INTERNAL_HINT = /^(team|hiring manager|reports? to|recruiter)\s*[:：]|用人经理|汇报对象/i;

/** A block's visibility, guessing one for blocks saved before levels existed. */
export function blockLevel(b: DocBlock): BlockLevel {
  if (b.level && b.level in BLOCK_LEVELS) return b.level;
  const text = blockPlainText(b);
  if (CONFIDENTIAL_HINT.test(text)) return "confidential";
  if (INTERNAL_HINT.test(text)) return "internal";
  return "public";
}

/** One bullet per block, and every block with an explicit level. Returns the same array when nothing changed. */
export function normalizeBlocks(blocks: DocBlock[]): DocBlock[] {
  let changed = false;
  const out: DocBlock[] = [];
  const used = new Set(blocks.map((b) => b.id));
  const freshId = (base: string) => {
    let n = 1;
    while (used.has(`${base}-${n}`)) n++;
    used.add(`${base}-${n}`);
    return `${base}-${n}`;
  };
  for (const b of blocks) {
    const level = blockLevel(b);
    if (b.kind === "ul" && Array.isArray(b.text) && b.text.length !== 1) {
      changed = true;
      const items = b.text.length ? b.text : [""];
      items.forEach((item, i) => out.push({ ...b, id: i === 0 ? b.id : freshId(b.id), text: [item], level }));
      continue;
    }
    if (b.level !== level) {
      changed = true;
      out.push({ ...b, level });
      continue;
    }
    out.push(b);
  }
  return changed ? out : blocks;
}

/** One bullet block per item. */
function listBlocks(bid: () => string, items: string[], level: BlockLevel): DocBlock[] {
  return items.map((item) => mkBlock(bid(), "ul", [item], { level }));
}

export function buildDefaultDraft(state: AppState, jobId: string): DocumentDraft {
  const j = state.jobs[jobId];
  const rv = j.activeRoleVersionRef ? state.roleVersions[j.activeRoleVersionRef] : null;
  const reqs = state.requirements[jobId] || [];
  const must = reqs.filter((r) => r.priority === "must_have").map((r) => r.statement);
  const pref = reqs.filter((r) => r.priority === "preferred").map((r) => r.statement);

  const blocks: DocBlock[] = [];
  let n = 1;
  const bid = () => "d" + jobId.slice(-3) + "-" + n++;

  blocks.push(mkBlock(bid(), "h2", j.title, { level: "public" }));
  blocks.push(
    mkBlock(
      bid(),
      "p",
      rv
        ? rv.roleSummary
        : j.hiringStatus === "draft"
          ? "This job has no confirmed requirements yet. Start a conversation with Copilot, or upload source material, to draft this document."
          : "No role summary on file.",
      { level: "public" },
    ),
  );
  if (rv?.responsibilities?.length) {
    blocks.push(mkBlock(bid(), "h2", "Responsibilities", { level: "public" }));
    blocks.push(...listBlocks(bid, rv.responsibilities, "public"));
  }
  if (must.length) {
    blocks.push(mkBlock(bid(), "h2", "Requirements", { level: "public" }));
    blocks.push(...listBlocks(bid, must, "public"));
  }
  if (pref.length) {
    blocks.push(mkBlock(bid(), "h2", "Preferred", { level: "public" }));
    blocks.push(...listBlocks(bid, pref, "public"));
  }
  blocks.push(mkBlock(bid(), "h2", "Compensation", { level: "public" }));
  blocks.push(mkBlock(bid(), "p", money(rv ? rv.publicCompensation : null), { level: "public" }));

  return { id: `doc-${jobId}`, jobId, audience: DOC_AUDIENCE, language: "en", revision: 1, saveState: "saved", blocks };
}

/**
 * Seeds a never-saved document from the backend's structured JD draft (the content Copilot collected
 * when the job was created), using the same layout as `buildDefaultDraft`.
 */
export function buildDraftFromBackend(title: string, content: CurrentDraftDto, jobId: string): DocumentDraft {
  const labels = (priority: string) =>
    content.requirements.filter((r) => r.priority === priority && r.label).map((r) => r.label as string);
  const must = labels("must_have");
  const pref = labels("preferred");

  const blocks: DocBlock[] = [];
  let n = 1;
  const bid = () => `b${jobId.slice(-3)}-${n++}`;

  blocks.push(mkBlock(bid(), "h2", title, { level: "public" }));
  blocks.push(mkBlock(bid(), "p", content.roleSummary || "No role summary on file.", { level: "public" }));
  if (content.responsibilities.length) {
    blocks.push(mkBlock(bid(), "h2", "Responsibilities", { level: "public" }));
    blocks.push(...listBlocks(bid, content.responsibilities, "public"));
  }
  if (must.length) {
    blocks.push(mkBlock(bid(), "h2", "Requirements", { level: "public" }));
    blocks.push(...listBlocks(bid, must, "public"));
  }
  if (pref.length) {
    blocks.push(mkBlock(bid(), "h2", "Preferred", { level: "public" }));
    blocks.push(...listBlocks(bid, pref, "public"));
  }
  blocks.push(mkBlock(bid(), "h2", "Compensation", { level: "public" }));
  blocks.push(mkBlock(bid(), "p", money(content.publicCompensation), { level: "public" }));
  if (content.internalCompensation) {
    blocks.push(mkBlock(bid(), "p", `Internal ceiling: ${money(content.internalCompensation)}`, { level: "confidential" }));
  }

  return { id: `doc-${jobId}`, jobId, audience: DOC_AUDIENCE, language: "en", revision: 1, saveState: "saved", blocks };
}

/** Read-only draft lookup used during render. */
export function selectDraft(state: AppState, jobId: string): DocumentDraft {
  return state.drafts[docKey(jobId)] ?? buildDefaultDraft(state, jobId);
}

/**
 * Copy-on-write edit of a job's document inside a `mutate` callback. The store's MUTATE reducer only
 * shallow-copies the root state and React (StrictMode) may run a reducer twice, so editing the stored
 * document in place would apply non-idempotent changes (inserting a block, swapping text) twice.
 * This copies the draft and its blocks first and stores the copy.
 */
export function editDocCopy(draft: AppState, jobId: string, fn: (doc: DocumentDraft) => void): DocumentDraft {
  const key = docKey(jobId);
  const base = draft.drafts[key] ?? buildDefaultDraft(draft, jobId);
  const doc: DocumentDraft = {
    ...base,
    blocks: base.blocks.map((b) => ({ ...b, text: Array.isArray(b.text) ? [...b.text] : b.text })),
  };
  fn(doc);
  draft.drafts = { ...draft.drafts, [key]: doc };
  return doc;
}

/** Mutation-time lookup: materialises the default draft into the store first. */
export function ensureDraft(draft: AppState, jobId: string): DocumentDraft {
  const key = docKey(jobId);
  if (!draft.drafts[key]) draft.drafts[key] = buildDefaultDraft(draft, jobId);
  return draft.drafts[key];
}

export function selectSuggestions(state: AppState, jobId: string): Suggestion[] {
  return state.suggestions[docKey(jobId)] ?? [];
}

export function pendingSuggestionsFor(state: AppState, jobId: string, blockId?: string) {
  return selectSuggestions(state, jobId).filter((s) => s.status === "proposed" && (!blockId || s.anchorBlock === blockId));
}

/** Sections are an `h2` plus the blocks up to the next `h2`; blocks before the first heading form a headless section. */
export interface DocSection {
  head: DocBlock | null;
  blocks: DocBlock[];
}
export function groupSections(blocks: DocBlock[]): DocSection[] {
  const secs: DocSection[] = [];
  let cur: DocSection | null = null;
  for (const b of blocks) {
    if (b.kind === "h2") {
      cur = { head: b, blocks: [] };
      secs.push(cur);
    } else {
      if (!cur) {
        cur = { head: null, blocks: [] };
        secs.push(cur);
      }
      cur.blocks.push(b);
    }
  }
  return secs;
}

/** Ids of a section's heading and every block under it. */
export function sectionBlockIds(blocks: DocBlock[], headId: string): string[] {
  const i = blocks.findIndex((b) => b.id === headId);
  if (i < 0) return [];
  const ids = [headId];
  for (let k = i + 1; k < blocks.length && blocks[k].kind !== "h2"; k++) ids.push(blocks[k].id);
  return ids;
}

/** Blocks edited through `RichBlockEditor` may hold simple inline HTML (`<strong>`/`<em>`) in `text`
 * once the user bolds/italicizes something — this strips it back to plain text for contexts that only
 * ever want a flat string (the outline sidebar, modal previews). */
export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}

export function blockPlainText(b: DocBlock): string {
  return Array.isArray(b.text) ? b.text.map(stripHtml).join(" • ") : stripHtml(b.text);
}
