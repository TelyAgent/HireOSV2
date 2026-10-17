/**
 * Where a quoted excerpt sits in a candidate's written answer (#378): the shortest run of lines that contains it.
 * Case, spacing and punctuation are ignored (as in Screening's locate-quote), and the whole excerpt must be
 * there -- a quote the answer doesn't contain is never placed. Lines are counted from 1, as shown to reviewers.
 */
export type QuoteRef = { questionId: string; text: string; lineFrom: number; lineTo: number };

export function normalizeForMatch(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function locateInAnswer(answer: string, quote: string): { lineFrom: number; lineTo: number } | null {
  const probe = normalizeForMatch(quote);
  if (probe.length < 4 || !normalizeForMatch(answer).includes(probe)) return null;
  const lines = answer.split(/\r?\n/).map(normalizeForMatch);
  for (let width = 1; width <= lines.length; width++) {
    for (let start = 0; start + width <= lines.length; start++) {
      if (lines.slice(start, start + width).join('').includes(probe)) return { lineFrom: start + 1, lineTo: start + width };
    }
  }
  return null;
}

/**
 * The AI's excerpts for one criterion, placed in the answers they quote. `question` is the 1-based number the
 * prompt showed. Excerpts that can't be found are dropped and counted, so a reviewer is told some were left out.
 */
export function placeQuotes(
  quotes: { question: number; text: string }[],
  questions: { questionId: string }[],
  answers: { questionId: string; answerText: string }[],
): { quotes: QuoteRef[]; unlocated: number } {
  const placed: QuoteRef[] = [];
  let unlocated = 0;
  for (const quote of quotes) {
    const questionId = questions[quote.question - 1]?.questionId;
    const answer = questionId ? answers.find((a) => a.questionId === questionId)?.answerText : undefined;
    const at = answer ? locateInAnswer(answer, quote.text) : null;
    if (questionId && at) placed.push({ questionId, text: quote.text.trim(), ...at });
    else unlocated++;
  }
  return { quotes: placed, unlocated };
}
