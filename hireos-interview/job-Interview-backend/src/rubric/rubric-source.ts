import { z } from 'zod';
import { cardGenerationSchema } from './contracts';

const snapshotSchema = z.object({
  sourceId: z.string(),
  segments: z.array(z.object({ id: z.string().min(1), text: z.string() })),
});
const refsSchema = z.array(z.object({ segmentId: z.string().min(1), quote: z.string().min(1) })).min(1);
type SourceJob = { id: string; inputVersion: number; input: unknown; result: unknown };

/** Only the frozen generation input can establish an old card's provenance. */
export function rubricCardSource(card: { requirement: string; sourceRefs: unknown }, source: SourceJob | undefined) {
  const unknown = { status: 'not_recorded' as const, jdVersion: null, parseJobId: null, refs: [] };
  if (!source || !Number.isSafeInteger(source.inputVersion) || source.inputVersion < 1) return unknown;
  const input = snapshotSchema.safeParse(source.input);
  const result = cardGenerationSchema.safeParse(source.result);
  const refs = refsSchema.safeParse(card.sourceRefs);
  if (!input.success || !result.success || !refs.success || input.data.sourceId !== `jd:${source.inputVersion}`) return unknown;
  const verified = refs.data.every(ref => {
    const segments = input.data.segments.filter(s => s.id === ref.segmentId);
    return ref.quote.trim() && segments.length === 1 && segments[0].text.includes(ref.quote) &&
      result.data.cards.some(c => c.requirement === card.requirement && c.segmentId === ref.segmentId && c.quote === ref.quote);
  });
  if (!verified) return unknown;
  return { status: 'verified' as const, jdVersion: source.inputVersion, parseJobId: source.id, refs: refs.data };
}
