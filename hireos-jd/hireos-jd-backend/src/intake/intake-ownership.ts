/**
 * Whether a job's current draft is still the one intake wrote from the AI's reading of the raw JD,
 * untouched by a person. Drafts are edited in place, so that means same id, same content hash, and
 * not yet confirmed. While it holds, the raw JD text is the authoritative JD; once it doesn't, the
 * person's draft is. Sources that predate this tracking (no draftId) keep their raw text visible.
 */
export function isIntakeOwned(
  draft: { id: string; contentHash: string; status: string },
  source: { draftId: string | null; draftHash: string | null },
) {
  if (!source.draftId) return true;
  return draft.status === 'draft' && draft.id === source.draftId && draft.contentHash === source.draftHash;
}
