/**
 * AI-written JD content must not turn facts nobody gave into requirements (#95): years of experience and
 * pay figures that appear nowhere in the job's own data are taken out of the text and returned as
 * "to confirm" instead, whatever the model wrote.
 */

/** "3 年及以上", "1年以上", "5+ years", "at least 2 years" … */
const YEARS = /(\d+(?:\.\d+)?)\s*(?:\+|＋)?\s*(?:年(?:及以上|以上|或以上)?(?:的|相关|工作)?(?:经验|工作经验|经历)?|years?)/gi;
/** "15K", "20万", "¥30,000", "$5000", "30000 元" … — a unit must end there ("10 Kubernetes" is not pay). */
const PAY = /(?:[¥$€£]\s*\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?\s*(?:[kK]|千|万|元|RMB|CNY|USD)(?![A-Za-z]))/g;

/**
 * Sentences of a paragraph. A "." only ends a sentence when whitespace or the end follows, so decimals
 * ("1.5 years") and names ("Node.js") stay whole; CJK and other end marks always end one.
 */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[。！？!?])|(?<=\.)(?=\s|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The number in each years / pay mention, e.g. "3 年及以上" → "3", "¥30,000" → "30000", "15K" → "15k". */
function figures(text: string, pattern: RegExp): string[] {
  return [...text.matchAll(pattern)].map((m) => {
    const raw = m[0].replace(/\s+/g, '').toLowerCase();
    const number = (raw.match(/\d[\d,]*(?:\.\d+)?/)?.[0] ?? '').replace(/,/g, '');
    const unit = raw.match(/[k千万]/)?.[0] ?? '';
    return number + unit;
  });
}

/** Years or pay figures in `text` that the source doesn't state as years or pay too. */
function unsourced(text: string, source: string): string[] {
  const srcYears = new Set(figures(source, YEARS));
  const srcPay = new Set(figures(source, PAY));
  return [...figures(text, YEARS).filter((f) => !srcYears.has(f)), ...figures(text, PAY).filter((f) => !srcPay.has(f))];
}

/**
 * Splits AI output into what may be written and what must be confirmed first. A list item with an
 * unsourced figure is moved whole; in a paragraph only the sentence carrying it is moved.
 */
export function separateUnsourced(items: string[], list: boolean, source: string): { items: string[]; toConfirm: string[] } {
  const keep: string[] = [];
  const toConfirm: string[] = [];
  if (list) {
    for (const item of items) (unsourced(item, source).length ? toConfirm : keep).push(item);
    return { items: keep, toConfirm };
  }
  const text = items.join('\n');
  const sentences = sentencesOf(text);
  const moved = sentences.filter((sentence) => unsourced(sentence, source).length > 0);
  if (!moved.length) return { items: [text], toConfirm: [] };
  const kept = sentences.filter((sentence) => !moved.includes(sentence));
  return { items: kept.length ? [kept.join(/[一-鿿]/.test(kept.join('')) ? '' : ' ')] : [], toConfirm: moved };
}
