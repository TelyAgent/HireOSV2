import type { PrismaService } from '../persistence/prisma.service';

/**
 * When a profile correction needs a reason (F02 COR-1/COR-2, #158): only when it changes a field that an
 * effective recommendation or evaluation actually used. Matching reads location, skills and work history;
 * scoring also reads the salary expectation. Name, contact details and project descriptions feed neither, and
 * a stale or dismissed recommendation or an out-of-date evaluation no longer counts as a use.
 */
const MATCHING_FIELDS = ['location', 'skills', 'employment_history'] as const;
const SCORING_FIELDS = ['location', 'skills', 'employment_history', 'compensation_expectation'] as const;
const EFFECTIVE_RECOMMENDATION = ['proposed', 'confirmed'];

export const CORRECTION_REASON_TYPES = ['parse_error', 'candidate_update', 'source_update', 'other'] as const;
export type CorrectionReasonType = (typeof CORRECTION_REASON_TYPES)[number];

type Db = Pick<PrismaService, 'candidateJobRecommendation' | 'screeningEvaluation'>;

/** The profile fields an effective recommendation or evaluation of this candidate relies on. */
export async function referencedProfileFields(db: Db, workspaceId: string, candidateId: string): Promise<string[]> {
  const [recommendation, evaluation] = await Promise.all([
    db.candidateJobRecommendation.findFirst({
      where: { workspaceId, candidateId, status: { in: EFFECTIVE_RECOMMENDATION }, staleReason: null },
      select: { id: true },
    }),
    db.screeningEvaluation.findFirst({
      where: { workspaceId, freshness: 'current', application: { candidateId } },
      select: { id: true },
    }),
  ]);
  return [...new Set<string>([...(recommendation ? MATCHING_FIELDS : []), ...(evaluation ? SCORING_FIELDS : [])])];
}
