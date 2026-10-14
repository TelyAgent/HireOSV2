import { BadRequestException } from '@nestjs/common';

/**
 * A finalized score must be usable: every criterion's human score a whole number within 0..max, and
 * the overall exactly their sum -- otherwise an out-of-range entry (e.g. 80 on a 35-point criterion)
 * would be locked in and published.
 */
export function assertValidFinalScores(dto: { overall: number; criteria: { name: string; max: number; human: number }[] }): void {
  for (const c of dto.criteria) {
    if (!Number.isInteger(c.human) || c.human < 0 || c.human > c.max) {
      throw new BadRequestException({ code: 'SCORE_OUT_OF_RANGE', criterion: c.name, max: c.max, message: `"${c.name}" must be a whole number from 0 to ${c.max}.` });
    }
  }
  const sum = dto.criteria.reduce((total, c) => total + c.human, 0);
  if (dto.overall !== sum) throw new BadRequestException({ code: 'OVERALL_MISMATCH', message: 'The overall score must equal the sum of the criterion scores.' });
}
