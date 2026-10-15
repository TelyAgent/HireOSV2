import type { JdFields } from './types';

/**
 * Collected JD fields -> the JobDraft content DraftsService.create takes. Shared by the Copilot
 * "confirm draft" action and the subsystem intake (IntakeService), so both produce the same draft shape.
 *
 * Core's role-version schema requires each requirement to carry id/label/dimension/hard/kind (see
 * hireos-core-record's RoleVersionsService requirementSchema) — a `statement` string alone isn't
 * enough. There's no real dimension taxonomy yet, so everything lands under a generic
 * "experience" dimension for now.
 */
export function fieldsToDraftContent(fields: JdFields) {
  const requirements = [
    ...(fields.mustHave || []).map((label, index) => ({
      id: `must-${index}`, label, dimension: 'experience', priority: 'must_have' as const, hard: true, kind: 'general',
    })),
    ...(fields.niceToHave || []).map((label, index) => ({
      id: `nice-${index}`, label, dimension: 'experience', priority: 'preferred' as const, hard: false, kind: 'general',
    })),
  ];
  return {
    roleSummary: fields.roleSummary,
    responsibilities: fields.responsibilities || [],
    requirements,
    publicCompensation: fields.publicCompensation ?? null,
    ...(fields.businessProblem || fields.expectedOutcomes?.length
      ? { hiringContext: { businessProblem: fields.businessProblem, expectedOutcomes: fields.expectedOutcomes } }
      : {}),
    // Same `{ period, statement }` shape the role blueprint reads; the period lives in the statement text.
    ...(fields.successCriteria?.length
      ? { successCriteria: fields.successCriteria.map((statement) => ({ period: '90 days', statement })) }
      : {}),
  };
}
