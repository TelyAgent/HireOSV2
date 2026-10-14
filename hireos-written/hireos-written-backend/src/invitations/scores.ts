import { BadRequestException } from '@nestjs/common';

/**
 * The overall score is always out of 100: the criteria's points divided by their total maximum
 * (which varies with the questions in a round, e.g. 103), scaled to 100 and rounded.
 */
export function percentScore(parts: { score: number; max: number }[]): number {
  const max = parts.reduce((sum, p) => sum + p.max, 0);
  if (max <= 0) return 0;
  return Math.round((parts.reduce((sum, p) => sum + p.score, 0) / max) * 100);
}

/**
 * A finalized score must be usable: every criterion's human score a whole number within 0..max, and
 * the overall exactly their out-of-100 score -- otherwise an out-of-range entry (e.g. 80 on a
 * 35-point criterion) would be locked in and published.
 */
export function assertValidFinalScores(dto: { overall: number; criteria: { name: string; max: number; human: number }[] }): void {
  for (const c of dto.criteria) {
    if (!Number.isInteger(c.human) || c.human < 0 || c.human > c.max) {
      throw new BadRequestException({ code: 'SCORE_OUT_OF_RANGE', criterion: c.name, max: c.max, message: `"${c.name}" must be a whole number from 0 to ${c.max}.` });
    }
  }
  const expected = percentScore(dto.criteria.map((c) => ({ score: c.human, max: c.max })));
  if (dto.overall !== expected) {
    throw new BadRequestException({ code: 'OVERALL_MISMATCH', expected, message: 'The overall score must be the criterion scores scaled to 100.' });
  }
}
