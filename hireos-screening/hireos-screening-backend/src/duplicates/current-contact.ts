/**
 * A candidate's email and phone as their latest profile version gives them (#151 review): the record keeps the
 * first values, while each version records its own. A version from before contacts were recorded falls back to
 * the record. Duplicate checks and the review compare against this, as the candidate page shows it.
 */
export function currentContact(
  candidate: { email: string | null; phone: string | null },
  profile: { contact?: unknown } | null | undefined,
): { email: string | null; phone: string | null } {
  const contact = profile?.contact && typeof profile.contact === 'object' && !Array.isArray(profile.contact) ? (profile.contact as Record<string, unknown>) : null;
  if (!contact) return { email: candidate.email, phone: candidate.phone };
  return {
    email: typeof contact.email === 'string' && contact.email ? contact.email : null,
    phone: typeof contact.phone === 'string' && contact.phone ? contact.phone : null,
  };
}
