// Issue #27: a comparison snapshot is frozen at generation time. To tell the reader when it no longer
// matches reality, each snapshot entry records a key of the member's decision-relevant state, and the
// comparison read recomputes it: a differing key means "changed since this snapshot".

export type MemberState = {
  evaluation: { id: string; overallScore: number | null } | null;
  concerns: Array<{ id: string; status: string }>;
  verificationItems: Array<{ id: string; status: string }>;
  decision: { id: string; status: string } | null;
};

/** Order-insensitive key of everything a reviewer acts on: current score, concern / verification statuses, decision. */
export function memberStateKey(state: MemberState): string {
  const pairs = (items: Array<{ id: string; status: string }>) => items.map((i) => `${i.id}:${i.status}`).sort().join(',');
  return [
    `e=${state.evaluation ? `${state.evaluation.id}:${state.evaluation.overallScore ?? 'null'}` : 'none'}`,
    `c=${pairs(state.concerns)}`,
    `v=${pairs(state.verificationItems)}`,
    `d=${state.decision ? `${state.decision.id}:${state.decision.status}` : 'none'}`,
  ].join('|');
}

/**
 * Members whose state differs from the latest snapshot, or who joined after it. Entries from snapshots
 * taken before keys were recorded carry no key, so no claim is made about them.
 */
export function changedSinceSnapshot(
  memberIds: string[],
  snapshotEntries: unknown,
  currentKeys: Map<string, string>,
): string[] {
  const entries = Array.isArray(snapshotEntries) ? (snapshotEntries as Array<{ applicationId?: string; stateKey?: string }>) : [];
  const byId = new Map(entries.map((e) => [e.applicationId, e]));
  return memberIds.filter((id) => {
    const entry = byId.get(id);
    if (!entry) return entries.length > 0;
    return typeof entry.stateKey === 'string' && entry.stateKey !== currentKeys.get(id);
  });
}
