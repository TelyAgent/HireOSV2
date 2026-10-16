/**
 * Avatar initials from a display name (#240), by whole characters as people see them (grapheme clusters), never
 * UTF-16 units: "李𠮷" stays "李𠮷", an emoji or a letter with a combining accent is never cut in half. Two or more
 * words give the first character of the first two ("Mai Tran" → "MT", "محمد علي" → "مع"); one word — most Chinese
 * and Japanese names — gives its first two characters ("陈立" → "陈立"). An empty name gives the fallback. Only what
 * is displayed is derived; the name itself is never changed. The same file is kept in every frontend.
 */
export function initials(name: string | null | undefined, fallback = "?"): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return fallback;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const picked = words.length >= 2 ? [characters(words[0])[0], characters(words[1])[0]] : characters(words[0]).slice(0, 2);
  return picked.join("").toLocaleUpperCase();
}

/** The name's characters: grapheme clusters where Intl.Segmenter exists, otherwise code points (never half a pair). */
export function characters(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: "grapheme" }) => { segment(input: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), (part) => part.segment);
  return Array.from(text);
}
