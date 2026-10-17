/**
 * The "changes since last round" of a comparison snapshot as sentences in the interface language (#206 #208).
 * Snapshots from before #206 hold English sentences; those are shown as they are.
 */
export type SnapshotChange =
  | { kind: "added" | "removed"; applicationId: string; candidateName: string }
  | { kind: "overall" | "rank" | "eligibility"; applicationId: string; candidateName: string; from: string | number | null; to: string | number | null }
  | { kind: "dimension"; applicationId: string; candidateName: string; dimension: string; from: number | null; to: number | null };

/** What the round-changes panel says about a snapshot: first of its set, unchanged, or these changes. */
export type RoundChangesView = { state: "first" } | { state: "unchanged"; previousVersion: number } | { state: "changed"; lines: string[] };

const ELIGIBILITY: Record<string, string> = {
  eligible: "Eligible",
  likely_eligible: "Likely eligible",
  needs_verification: "Needs verification",
  not_eligible: "Not eligible",
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

export function describeChange(change: SnapshotChange | string, t: (s: string) => string): string {
  if (typeof change === "string") return change;
  const name = change.candidateName;
  const value = (v: string | number | null, unknown: string) => (v == null ? t(unknown) : String(v));
  switch (change.kind) {
    case "added":
      return fill(t("{name} was added to the comparison."), { name });
    case "removed":
      return fill(t("{name} was removed from the comparison."), { name });
    case "overall":
      return fill(t("{name}: overall score {from} → {to}."), { name, from: value(change.from, "unknown"), to: value(change.to, "unknown") });
    case "rank":
      return fill(t("{name}: rank {from} → {to}."), { name, from: value(change.from, "unranked"), to: value(change.to, "unranked") });
    case "eligibility": {
      const label = (v: string | number | null) => (v == null ? t("unknown") : t(ELIGIBILITY[String(v)] ?? String(v)));
      return fill(t("{name}: eligibility {from} → {to}."), { name, from: label(change.from), to: label(change.to) });
    }
    case "dimension":
      return fill(t("{name}: {dimension} score {from} → {to}."), { name, dimension: t(change.dimension), from: value(change.from, "unknown"), to: value(change.to, "unknown") });
  }
}

/**
 * `changesSinceLast` is null (or absent) on the first snapshot of a set and a list otherwise; an empty list means
 * nothing changed. Older snapshots stored [] even on the first one, so version 1 always reads as the first.
 */
export function roundChangesView(
  snapshot: { version: number; changesSinceLast?: Array<SnapshotChange | string> | null },
  t: (s: string) => string,
): RoundChangesView {
  if (snapshot.version <= 1 || snapshot.changesSinceLast == null) return { state: "first" };
  if (!snapshot.changesSinceLast.length) return { state: "unchanged", previousVersion: snapshot.version - 1 };
  return { state: "changed", lines: snapshot.changesSinceLast.map((change) => describeChange(change, t)) };
}

/** A comparison's purpose: the one the shortlist creates is system wording ("Shortlist review — <job>"); anything else is the user's own. */
export function purposeLabel(purpose: string, t: (s: string) => string): string {
  const prefix = "Shortlist review";
  return purpose === prefix || purpose.startsWith(`${prefix} — `) ? t(prefix) + purpose.slice(prefix.length) : purpose;
}
