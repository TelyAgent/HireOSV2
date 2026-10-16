/**
 * Total work experience derived from the employment history (#156): the months covered by at least one job,
 * so overlapping jobs count once and an open-ended job runs to the current month. It is a derived value, never
 * an estimate: with no usable start and end dates it is unknown.
 */
export type TotalExperience =
  | { status: 'derived'; months: number; years: number }
  | { status: 'unknown' };

const PRESENT = /^(present|now|current|today|ongoing|至今|今|现在|目前)$/i;

/** A month as a single index (year * 12 + month - 1); null when the value isn't a recognisable date. */
export function monthIndex(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  // 2020-06, 2020/6, 2020.06, 2020年6月
  let match = text.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*月?$/);
  if (match) return toIndex(Number(match[1]), Number(match[2]));
  // 06/2020, 6-2020
  match = text.match(/^(\d{1,2})\s*[-/.]\s*(\d{4})$/);
  if (match) return toIndex(Number(match[2]), Number(match[1]));
  // A bare year is too coarse to count months from.
  return null;
}

function toIndex(year: number, month: number): number | null {
  return month >= 1 && month <= 12 && year >= 1950 && year <= 2100 ? year * 12 + (month - 1) : null;
}

/** "YYYY-MM" for a recognisable date, so dates read the same whatever format the résumé used. */
export function formatMonth(value: unknown): string | null {
  const index = monthIndex(value);
  if (index === null) return null;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export function isPresent(value: unknown): boolean {
  return typeof value === 'string' && PRESENT.test(value.trim());
}

export function totalExperience(history: unknown, now: Date = new Date()): TotalExperience {
  const current = now.getFullYear() * 12 + now.getMonth();
  const covered = new Set<number>();
  for (const entry of Array.isArray(history) ? history : []) {
    const record = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const start = monthIndex(record.start);
    const end = isPresent(record.end) ? current : monthIndex(record.end);
    if (start === null || end === null || end < start || start > current) continue;
    for (let month = start; month <= Math.min(end, current); month++) covered.add(month);
  }
  if (!covered.size) return { status: 'unknown' };
  return { status: 'derived', months: covered.size, years: Math.round((covered.size / 12) * 10) / 10 };
}
