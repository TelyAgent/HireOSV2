import type { Criterion } from "../data/fixtures";
import type { RealFinalCriterion } from "../data/writtenApi";

/**
 * The overall score is always out of 100: the criteria's points divided by their total maximum
 * (which varies with the questions in the round, e.g. 103), scaled to 100 and rounded. Mirrors
 * hireos-written-backend's percentScore() (src/invitations/scores.ts), which checks it on finalize.
 */
export function percentScore(parts: { score: number; max: number }[]): number {
  const max = parts.reduce((sum, p) => sum + p.max, 0);
  if (max <= 0) return 0;
  return Math.round((parts.reduce((sum, p) => sum + p.score, 0) / max) * 100);
}

/** Overall out of 100 from the AI or human column; null while any criterion is unscored. */
export function computeOverall(criteria: Criterion[], key: "ai" | "human"): number | null {
  if (criteria.some((c) => c[key] == null)) return null;
  return percentScore(criteria.map((c) => ({ score: c[key] as number, max: c.max })));
}

/** A finalized scoring's overall, recomputed from its criteria -- results finalized before the
 * 100-point scale stored the raw sum, so the stored value isn't trusted. */
export function finalOverall(final: { overall: number; criteria: RealFinalCriterion[] }): number {
  return final.criteria.length ? percentScore(final.criteria.map((c) => ({ score: c.human, max: c.max }))) : final.overall;
}
