/**
 * The F02 §4.1 formats a parsed value is stored in (#155): phone numbers in E.164 when they carry a country code,
 * and availability turned into a number of days or a date when the wording allows. The original text is always
 * kept; a value that can't be read stays as written.
 */

/** "+84 90 123 4567" → "+84901234567"; null when there is no country code to go on. */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed.startsWith('+') && !trimmed.startsWith('00')) return null;
  const digits = trimmed.replace(/^00/, '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/** The phone as stored: E.164 when it can be, otherwise as written. */
export function storedPhone(phone: string | null | undefined): string | null {
  return phone ? (toE164(phone) ?? phone.trim()) : null;
}

export type Availability = { value: string; status: 'known'; days?: number; date?: string };

const UNIT_DAYS: Array<[RegExp, number]> = [
  [/(\d+)\s*(?:days?|天|日)/i, 1],
  [/(\d+)\s*(?:weeks?|周|星期)/i, 7],
  [/(\d+)\s*(?:months?|个月|月)/i, 30],
];

/** "1 month notice" → 30 days, "随时到岗" → 0, "available from 2026-11-01" → that date; otherwise the text alone. */
export function readAvailability(value: string): Availability {
  const text = value.trim();
  const date = text.match(/(\d{4})[-/.年](\d{1,2})(?:[-/.月](\d{1,2}))?/);
  if (date) {
    const [year, month, day] = [Number(date[1]), Number(date[2]), date[3] ? Number(date[3]) : 1];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return { value: text, status: 'known', date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
    }
  }
  if (/immediate|right away|随时|立即|马上/i.test(text)) return { value: text, status: 'known', days: 0 };
  for (const [pattern, days] of UNIT_DAYS) {
    const match = text.match(pattern);
    if (match) return { value: text, status: 'known', days: Number(match[1]) * days };
  }
  const word = text.match(/\b(one|two|three|four|six)\s+(week|month)s?\b/i);
  if (word) {
    const n = { one: 1, two: 2, three: 3, four: 4, six: 6 }[word[1].toLowerCase() as 'one'];
    return { value: text, status: 'known', days: n * (word[2].toLowerCase() === 'week' ? 7 : 30) };
  }
  return { value: text, status: 'known' };
}
