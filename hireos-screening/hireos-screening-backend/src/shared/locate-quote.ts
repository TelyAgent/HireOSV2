/**
 * Where a quote sits in a stored material (#155 #192): the paragraph that contains it, with its page (PDFs) and
 * its paragraph number, counted within the page when there is one. Case, spacing and punctuation are ignored,
 * and a long quote is matched on its opening words. Null when the text doesn't contain it.
 */
export type Segment = { id: string; text: string; page?: number };
export type QuoteLocation = { segmentId: string; page: number | null; paragraph: number };

export function normalizeForMatch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function asSegments(value: unknown): Segment[] {
  return (Array.isArray(value) ? value : []).filter(
    (s): s is Segment => !!s && typeof s === 'object' && typeof (s as Segment).id === 'string' && typeof (s as Segment).text === 'string',
  );
}

export function locateQuote(segments: Segment[], quote: string): QuoteLocation | null {
  const probe = normalizeForMatch(quote).slice(0, 60);
  if (probe.length < 4) return null;
  const perPage = new Map<number, number>();
  let index = 0;
  for (const segment of segments) {
    index += 1;
    const page = segment.page ?? null;
    const paragraph = page === null ? index : (perPage.get(page) ?? 0) + 1;
    if (page !== null) perPage.set(page, paragraph);
    if (normalizeForMatch(segment.text).includes(probe)) return { segmentId: segment.id, page, paragraph };
  }
  return null;
}
