/**
 * Whether the job page's Publish button is enabled, and why not — the one rule both the button and the
 * Copilot's "can I submit / publish?" answer use (#106 AC-2), so they can never disagree.
 */
import type { AppState } from "../../store/types";
import { blockLevel, selectDraft } from "./docHelpers";
import { issueCount, type ComplianceFlag, type Evaluation } from "./completeness";
import { diffBlocks } from "./versions";

/** The backend accepts up to 8000 characters of status context; stay well inside it (#106 review). */
export const MAX_STATUS_CONTEXT = 6000;
const MAX_LISTED = 8;

/** At most MAX_LISTED entries, each at most 200 characters, then "and N more". */
function listOf(items: string[], sep: string): string {
  const shown = items.slice(0, MAX_LISTED).map((x) => (x.length > 200 ? `${x.slice(0, 200)}…` : x));
  return items.length > MAX_LISTED ? `${shown.join(sep)}${sep}and ${items.length - MAX_LISTED} more` : shown.join(sep);
}

/**
 * The whole status for the Copilot, bounded: the gate's conclusion comes first so a cut never drops it.
 */
export function statusContext(gate: string, analysis: string): string {
  const text = `${gate} ${analysis}`;
  return text.length <= MAX_STATUS_CONTEXT ? text : `${text.slice(0, MAX_STATUS_CONTEXT - 1)}…`;
}

export type PublishGate =
  | { kind: "loading" }
  | { kind: "issues"; count: number; missing: string[]; revise: string[]; blockers: string[]; analysis: string[] }
  | { kind: "no_changes"; versionNo: number }
  | { kind: "ready" };

export function publishGate(state: AppState, jobId: string, ev: Evaluation | null): PublishGate {
  const versionInfo = state.wsVersions[jobId];
  if (!versionInfo) return { kind: "loading" };
  // Publishing needs every required item filled, nothing left to revise and no blocking issue.
  const count = ev ? issueCount(ev) : 0;
  if (ev && count) {
    // A flag's message quotes the text it matched; for a Confidential block only its rule may leave the page (V5).
    const confidential = new Set(selectDraft(state, jobId).blocks.filter((b) => blockLevel(b) === "confidential").map((b) => b.id));
    const say = (f: ComplianceFlag) => (confidential.has(f.blockId) ? `${f.rule} (in a Confidential block)` : `${f.rule} ${f.message}`);
    return {
      kind: "issues",
      count,
      missing: ev.rows.filter((r) => !r.ok).map((r) => r.item.label),
      revise: [
        ...ev.rows.filter((r) => r.ok && r.weak).map((r) => r.item.label),
        ...ev.flags.filter((f) => f.severity === "warning").map(say),
      ],
      blockers: ev.flags.filter((f) => f.severity === "blocker").map(say),
      analysis: [],
    };
  }
  const doc = selectDraft(state, jobId);
  const run = state.wsAiAnalysis[jobId];
  const analysisIssues = !run
    ? ["AI Analyze has not been run on the current saved revision."]
    : run.revision !== doc.revision || doc.saveState !== "saved"
      ? ["The current saved revision needs a fresh AI Analyze result."]
      : run.result.items.filter((item) => item.severity !== "suggestion").map((item) => `${item.id || "AI"}: ${item.reason}`);
  if (analysisIssues.length) {
    return { kind: "issues", count: count + analysisIssues.length, missing: [], revise: [], blockers: [], analysis: analysisIssues };
  }
  const latest = versionInfo.versions[versionInfo.versions.length - 1];
  if (latest && !diffBlocks(latest.blocks, selectDraft(state, jobId).blocks).count) return { kind: "no_changes", versionNo: latest.versionNo };
  return { kind: "ready" };
}

/** The gate in plain words for the Copilot's context (English; the model answers in the user's language). */
export function describePublishGate(gate: PublishGate, unsaved: boolean): string {
  const lines: string[] = [];
  if (gate.kind === "loading") lines.push("The job's versions are still loading, so the Publish button is disabled for now.");
  if (gate.kind === "issues") {
    lines.push(`The Publish button is disabled: ${gate.count} item(s) to complete or revise (see Analysis).`);
    if (gate.missing.length) lines.push(`Missing: ${listOf(gate.missing, ", ")}.`);
    if (gate.revise.length) lines.push(`To revise: ${listOf(gate.revise, "; ")}.`);
    if (gate.blockers.length) lines.push(`Blocking issues: ${listOf(gate.blockers, "; ")}.`);
    if (gate.analysis.length) lines.push(`AI Analyze: ${listOf(gate.analysis, "; ")}.`);
  }
  if (gate.kind === "no_changes") lines.push(`The Publish button is disabled: nothing has changed since v${gate.versionNo} was published.`);
  if (gate.kind === "ready") lines.push("The Publish button is available.");
  if (unsaved) lines.push("The document has unsaved changes.");
  lines.push("Submitting for approval is not available in HireOS yet.");
  return lines.join(" ");
}

/**
 * The last AI Analyze result in words, and whether it still describes the current document (#106 AC-2).
 * An outdated result is reported as outdated, never as the current verdict.
 */
export function describeAiAnalysis(state: AppState, jobId: string): string {
  const run = state.wsAiAnalysis[jobId];
  const doc = selectDraft(state, jobId);
  if (!run) return "AI Analyze has not been run on this document yet.";
  if (run.revision !== doc.revision) return "The last AI Analyze result is outdated — the document changed after it ran — so Analyze must be run again before relying on it.";
  const confidential = new Set(doc.blocks.filter((b) => blockLevel(b) === "confidential").map((b) => b.id));
  const findings = run.result.items
    .filter((i) => i.severity !== "suggestion")
    .map((i) => `${i.id} (${i.severity}): ${i.reason}${i.evidence && !(i.blockId && confidential.has(i.blockId)) ? ` — “${i.evidence}”` : ""}`);
  return [
    `Current AI Analyze result: ${run.result.verdict}. ${run.result.summary}`,
    findings.length ? `Findings: ${listOf(findings, "; ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
