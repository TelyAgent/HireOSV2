import type { PersonId } from "./people";

/** A human score override — recorded separately from the AI score, which is
 * never overwritten (PRD: AI suggestions never overwrite human scores). */
export interface HumanAssessment {
  dimensionId: string;
  dimensionName: string;
  score: number;
  reason: string;
  by: PersonId;
  at: string;
}

/** Keyed by applicationId. Empty by default — the prototype seeds this
 * lazily as overrides are saved, so there is no fixture data to port. */
export const HUMAN_ASSESSMENTS: Record<string, HumanAssessment[]> = {};
