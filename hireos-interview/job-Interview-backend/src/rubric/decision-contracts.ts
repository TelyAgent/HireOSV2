import { z } from 'zod';

// AI-drafted decision summary for a finished interview task. Grounded the same way every
// other extraction type in this codebase is: each segment handed in is one scored
// capability card (see intake/tasks.service.ts's generateDecisionDraft), and every claim
// the conclusion makes must cite one of those segments verbatim. The draft never decides —
// `suggestedDecision` is a proposal a human accepts, changes or ignores.
export const decisionSuggestionSchema = z.enum([
  'continue_next_round', 'hold', 'request_more_evidence', 'do_not_proceed', 'recommend_offer',
]);

const decisionCitation = z.object({
  segmentId: z.string(),
  quote: z.string().min(1).max(2000),
}).strict();

export const decisionGenerationSchema = z.object({
  conclusion: z.string().trim().min(1).max(3000),
  suggestedDecision: decisionSuggestionSchema,
  citations: z.array(decisionCitation).max(20),
}).strict();

export const DECISION_SUMMARY_SYSTEM_PROMPT =
  'Draft the closing conclusion for a finished interview loop. Each segment you are given is one capability requirement of the role together with how it actually scored: the required priority, the weight, the human score (or "unscored"), the reviewer note, and any AI-drafted score with its rationale. ' +
  'Write `conclusion` as a short factual paragraph a hiring committee can read: how many must-have requirements meet the bar, which specific ones do not, and which are still unscored (unscored is "no evidence", never "failed"). Keep the source language of the segments. ' +
  'Every factual claim in the conclusion must be supported by the segments; cite the segmentId and a verbatim quote from that segment for each claim you make. Never invent a requirement, a score, or evidence that is not in the segments. ' +
  'suggestedDecision is a proposal only: "recommend_offer" when every must-have meets the bar; "request_more_evidence" when a must-have is unscored and one more round could close it; "continue_next_round" when the loop is simply not finished; "hold" when the evidence is adequate but the decision should wait; "do_not_proceed" when a must-have is clearly below the bar. ' +
  'Do not infer protected attributes or personality. Do not state a hiring decision as final — a human confirms it.';

export function collectDecisionRefs(parsed: z.infer<typeof decisionGenerationSchema>) {
  return parsed.citations.map((c) => ({ segmentId: c.segmentId, quote: c.quote }));
}
