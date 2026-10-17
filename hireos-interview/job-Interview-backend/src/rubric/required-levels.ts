export type JdRequirement = { id: string; label: string; requiredLevel: number | null };

/** Duplicate or absent IDs cannot provide a unique authority for a generated card. */
export function jdRequirements(value: unknown): JdRequirement[] {
  if (!Array.isArray(value)) return [];
  const candidates = value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  return candidates.flatMap(r => {
    if (typeof r.id !== 'string' || !r.id.trim() || typeof r.label !== 'string' || !r.label.trim()) return [];
    if (candidates.filter(other => other.id === r.id).length !== 1) return [];
    return [{ id: r.id, label: r.label, requiredLevel: typeof r.requiredLevel === 'number' && Number.isInteger(r.requiredLevel) && r.requiredLevel >= 1 && r.requiredLevel <= 5 ? r.requiredLevel : null }];
  });
}

export function requirementSegmentId(id: string) { return `jd-requirement:${encodeURIComponent(id)}`; }

export function cardLevel(input: unknown, segmentId: string, quote: string) {
  const requirements = input && typeof input === 'object' ? (input as { requirements?: unknown }).requirements : null;
  const source = jdRequirements(requirements).find(r => requirementSegmentId(r.id) === segmentId && r.label.includes(quote) && quote.trim());
  return { requiredLevel: source?.requiredLevel ?? null, sourceRequirementId: source?.id ?? null };
}
