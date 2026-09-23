import { CASES, PLANS, type Round } from "../data/fixtures";

/** Every seeded Case already carries its `rounds` array (the prototype's roundsForCase()
 * lazily backfilled this for pre-multi-round cases — our fixtures are already in the new
 * shape, so this just reads it). */
export function roundsForCase(caseId: string): Round[] {
  return CASES[caseId]?.rounds ?? [];
}

export function planItemsForCase(caseId: string, roundId?: string) {
  const c = CASES[caseId];
  if (!c) return [];
  if (!roundId) return c.planItems.map((id) => PLANS[id]).filter(Boolean);
  const round = roundsForCase(caseId).find((r) => r.id === roundId);
  return round ? round.planItemIds.map((id) => PLANS[id]).filter(Boolean) : [];
}

export function currentRoundId(caseId: string): string | undefined {
  const rounds = roundsForCase(caseId);
  const notDone = rounds.find((r) => !["completed", "cancelled"].includes(r.status));
  return (notDone || rounds[rounds.length - 1])?.id;
}
