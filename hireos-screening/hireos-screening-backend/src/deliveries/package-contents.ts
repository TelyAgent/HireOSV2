/* eslint-disable @typescript-eslint/no-explicit-any */
// Issue #22: the five things the package preview promises — requested action, evaluation snapshot,
// target, access limitations, review status — assembled from what the package froze at creation.

/** What every outgoing package withholds (the policy the preview has always described). */
export const ACCESS_LIMITATIONS = ['contact_details_excluded', 'internal_ranking_excluded', 'restricted_evidence_redacted'] as const;

export type EvaluationSnapshot = {
  evaluationId: string | null;
  version: number | null;
  overall: number | null;
  coverage: number;
  eligibilityStatus: string | null;
  dimensionScores: Array<{ dimensionId?: string; name: string; score: number | null; status: string }>;
  generatedAt: string | null;
};

/**
 * `evaluationRow` backfills version / generatedAt for packages created before they were frozen into the
 * payload; both are immutable facts of that evaluation, so this never reflects a later re-screen.
 */
export function packageContents(
  pkg: { kind: string; reviewStatus: string | null; decisionId: string | null; payload: unknown },
  evaluationRow?: { version: number; completedAt: Date | null; createdAt: Date } | null,
) {
  const payload = (pkg.payload && typeof pkg.payload === 'object' ? pkg.payload : {}) as Record<string, any>;
  const ev = payload.evaluation as Record<string, any> | null | undefined;
  const evaluationSnapshot: EvaluationSnapshot | null = ev
    ? {
      evaluationId: ev.id ?? null,
      version: ev.version ?? evaluationRow?.version ?? null,
      overall: ev.overall ?? null,
      coverage: ev.coverage ?? 0,
      eligibilityStatus: ev.eligibilityStatus ?? null,
      dimensionScores: Array.isArray(ev.dimensionScores)
        ? ev.dimensionScores.map((d: any) => ({ dimensionId: d.dimensionId, name: d.name, score: d.score ?? null, status: d.status }))
        : [],
      generatedAt: ev.generatedAt ?? (evaluationRow ? (evaluationRow.completedAt ?? evaluationRow.createdAt).toISOString() : null),
    }
    : null;
  return {
    requestedAction: pkg.kind,
    evaluationSnapshot,
    accessLimitations: [...ACCESS_LIMITATIONS],
    // Packages only come from a recorded human decision; older non-report packages never stored it.
    reviewStatus: pkg.reviewStatus ?? (pkg.decisionId ? 'human_reviewed' : 'not_reviewed'),
  };
}
