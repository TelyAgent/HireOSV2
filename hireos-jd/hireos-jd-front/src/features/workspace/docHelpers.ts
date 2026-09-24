/**
 * Document-draft helpers ported from the prototype's job-workspace section
 * (`docKey` / `getDraft` / `buildDefaultDraft` / `canonicalSuggestion`).
 *
 * `buildDefaultDraft` is pure: jobs with no stored draft get one derived from
 * their active role version and requirements, exactly as the prototype did on
 * first read.
 */
import { mkBlock } from "../../data/fixtures/documents";
import { money, nowISO, uid } from "../../lib/format";
import type { AppState } from "../../store/types";
import type { Audience, DocBlock, DocumentDraft, Suggestion } from "../../data/types";

export function docKey(jobId: string, audience: Audience) {
  return `${jobId}:${audience}`;
}

export function buildDefaultDraft(state: AppState, jobId: string, audience: Audience): DocumentDraft {
  const j = state.jobs[jobId];
  const rv = j.activeRoleVersionRef ? state.roleVersions[j.activeRoleVersionRef] : null;
  const reqs = state.requirements[jobId] || [];
  const must = reqs.filter((r) => r.priority === "must_have").map((r) => r.statement);
  const pref = reqs.filter((r) => r.priority === "preferred").map((r) => r.statement);

  const blocks: DocBlock[] = [];
  let n = 1;
  const bid = () => "d" + jobId.slice(-3) + "-" + n++;

  blocks.push(mkBlock(bid(), "h2", j.title + (audience === "external" ? "" : " — " + j.department)));
  blocks.push(
    mkBlock(
      bid(),
      "p",
      rv
        ? rv.roleSummary
        : j.hiringStatus === "draft"
          ? "This job has no confirmed requirements yet. Start a conversation with Copilot, or upload source material, to draft this document."
          : "No role summary on file.",
    ),
  );
  if (rv?.responsibilities?.length) {
    blocks.push(mkBlock(bid(), "h2", audience === "external" ? "What you’ll do" : "Responsibilities"));
    blocks.push(mkBlock(bid(), "ul", rv.responsibilities));
  }
  if (must.length) {
    blocks.push(mkBlock(bid(), "h2", audience === "external" ? "What we’re looking for" : "Requirements — Must-have"));
    blocks.push(mkBlock(bid(), "ul", must));
  }
  if (audience === "internal" && pref.length) {
    blocks.push(mkBlock(bid(), "h2", "Preferred"));
    blocks.push(mkBlock(bid(), "ul", pref));
  }
  blocks.push(mkBlock(bid(), "h2", "Compensation"));
  blocks.push(
    mkBlock(
      bid(),
      "p",
      money(rv ? rv.publicCompensation : null) +
        (audience === "internal" ? " public. Internal ceiling is restricted — see Requirements → Compensation." : ", plus benefits."),
    ),
  );

  return {
    id: `doc-${jobId}-${audience}`,
    jobId,
    audience,
    language: "en",
    revision: 1,
    saveState: "saved",
    blocks,
  };
}

/** Read-only draft lookup used during render. */
export function selectDraft(state: AppState, jobId: string, audience: Audience): DocumentDraft {
  return state.drafts[docKey(jobId, audience)] ?? buildDefaultDraft(state, jobId, audience);
}

/** Mutation-time lookup: materialises the default draft into the store first. */
export function ensureDraft(draft: AppState, jobId: string, audience: Audience): DocumentDraft {
  const key = docKey(jobId, audience);
  if (!draft.drafts[key]) draft.drafts[key] = buildDefaultDraft(draft, jobId, audience);
  return draft.drafts[key];
}

export function selectSuggestions(state: AppState, jobId: string, audience: Audience): Suggestion[] {
  return state.suggestions[docKey(jobId, audience)] ?? [];
}

export function selectThreads(state: AppState, jobId: string, audience: Audience) {
  return state.comments[docKey(jobId, audience)] ?? [];
}

export function pendingSuggestionsFor(state: AppState, jobId: string, audience: Audience, blockId?: string) {
  return selectSuggestions(state, jobId, audience).filter(
    (s) => s.status === "proposed" && (!blockId || s.anchorBlock === blockId),
  );
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

interface CanonicalSuggestion {
  newText: string;
  explain: string;
  reason: string;
  requirementRef?: string;
}

/**
 * The prototype's flagship demo rewrites (PRD/Brief §17.4): turning vague
 * requirement wording into something a screener can actually verify.
 */
export function canonicalSuggestion(selText: string, instruction?: string): CanonicalSuggestion {
  if (/strong communication skills/i.test(selText)) {
    return {
      newText:
        "Can explain technical trade-offs clearly to non-technical stakeholders, supported by an example from a previous project.",
      explain:
        "I rewrote this as a requirement that can actually be verified in an interview or work sample, and kept it must-have. Whether it applies to this specific role is still yours to confirm.",
      reason:
        "Evidence expectation changes from unspecified to a concrete example; priority (must-have) is unchanged. This updates the linked requirement draft (req-102-comm) alongside the document text.",
      requirementRef: "req-102-comm",
    };
  }
  if (/b2b saas/i.test(selText)) {
    return {
      newText: "2+ years building B2B SaaS platforms, with a named product and your specific contribution.",
      explain:
        "I made this easier to screen against a resume by asking for a named product and a specific contribution, while keeping it must-have as Maya requested.",
      reason: "Adds a verifiable evidence bar; does not change priority. Linked to req-102-b2b.",
      requirementRef: "req-102-b2b",
    };
  }
  if (/shorten/i.test(instruction || "")) {
    const words = selText.split(" ");
    const short = words.slice(0, Math.max(4, Math.ceil(words.length * 0.6))).join(" ");
    return {
      newText: short + (short.endsWith(".") ? "" : "."),
      explain: "Shortened while keeping the core requirement.",
      reason: "Wording simplified; no change to must-have/preferred or evaluation dimension.",
    };
  }
  if (/clarify/i.test(instruction || "")) {
    return {
      newText: selText.replace(/\.$/, "") + ", with a specific example as evidence.",
      explain: "Added a concrete evidence expectation to reduce ambiguity.",
      reason: "Evidence standard clarified; priority unchanged.",
    };
  }
  return {
    newText: selText.replace(/\.$/, "") + " (rewritten for clarity).",
    explain: "Here’s a clearer version of the selected text.",
    reason: "Wording clarified; no change to must-have/preferred or evaluation dimension.",
  };
}

export function makeSuggestion(
  currentUserId: string,
  blockId: string,
  selText: string,
  instruction?: string,
): { suggestion: Suggestion; explain: string } {
  const c = canonicalSuggestion(selText, instruction);
  return {
    suggestion: {
      id: uid("sug"),
      anchorBlock: blockId,
      status: "proposed",
      author: "ai",
      initiatedBy: currentUserId,
      createdAt: nowISO(),
      instruction: instruction || "Rewrite",
      oldText: selText,
      newText: c.newText,
      reason: c.reason,
      requirementRef: c.requirementRef ?? null,
    },
    explain: c.explain,
  };
}
