/**
 * Whether the job page's Publish button is enabled, and why not — the one rule both the button and the
 * Copilot's "can I submit / publish?" answer use (#106 AC-2), so they can never disagree.
 */
import type { AppState } from "../../store/types";
import { selectDraft } from "./docHelpers";
import { issueCount, type Evaluation } from "./completeness";
import { diffBlocks } from "./versions";

export type PublishGate =
  | { kind: "loading" }
  | { kind: "issues"; count: number; missing: string[]; revise: string[]; blockers: string[] }
  | { kind: "no_changes"; versionNo: number }
  | { kind: "ready" };

export function publishGate(state: AppState, jobId: string, ev: Evaluation | null): PublishGate {
  const versionInfo = state.wsVersions[jobId];
  if (!versionInfo) return { kind: "loading" };
  // Publishing needs every required item filled, nothing left to revise and no blocking issue.
  const count = ev ? issueCount(ev) : 0;
  if (ev && count) {
    return {
      kind: "issues",
      count,
      missing: ev.rows.filter((r) => !r.ok).map((r) => r.item.label),
      revise: [
        ...ev.rows.filter((r) => r.ok && r.weak).map((r) => r.item.label),
        ...ev.flags.filter((f) => f.severity === "warning").map((f) => `${f.rule} ${f.message}`),
      ],
      blockers: ev.flags.filter((f) => f.severity === "blocker").map((f) => `${f.rule} ${f.message}`),
    };
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
    if (gate.missing.length) lines.push(`Missing: ${gate.missing.join(", ")}.`);
    if (gate.revise.length) lines.push(`To revise: ${gate.revise.join("; ")}.`);
    if (gate.blockers.length) lines.push(`Blocking issues: ${gate.blockers.join("; ")}.`);
  }
  if (gate.kind === "no_changes") lines.push(`The Publish button is disabled: nothing has changed since v${gate.versionNo} was published.`);
  if (gate.kind === "ready") lines.push("The Publish button is available.");
  if (unsaved) lines.push("The document has unsaved changes.");
  lines.push("Submitting for approval is not available in HireOS yet.");
  return lines.join(" ");
}
