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

// Every stated amount, decimals included and added up: "1.5 months" is 45 days, "1 month and 2 weeks" 44.
// A bare 月 or 日 is a date ("3月到岗"), not a duration, so only 个月 and 天 count.
const DURATION = /(\d+(?:\.\d+)?)\s*(days?|天|weeks?|周|个?星期|months?|个月)/gi;
const UNIT_DAYS = (unit: string) => (/^(day|天)/i.test(unit) ? 1 : /^(week|周|个?星期)/i.test(unit) ? 7 : 30);

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
  // A stated notice period wins over any other wording ("Not immediately available; 2 months notice" is 60 days).
  // Amounts in words count like digits ("one month and two weeks" is 44 days); a vague one ("a few weeks") isn't
  // turned into days at all — the text alone is kept.
  if (/\b(a\s+)?(few|couple|several|some)\s+(days?|weeks?|months?)\b|几(天|周|个月)/i.test(text)) return { value: text, status: 'known' };
  const amounts = [...numbersAsDigits(text).matchAll(DURATION)];
  if (amounts.length) {
    return { value: text, status: 'known', days: Math.round(amounts.reduce((sum, m) => sum + Number(m[1]) * UNIT_DAYS(m[2]), 0)) };
  }
  // "Immediately" counts only when nothing negates it; otherwise the text is kept as written.
  const negated = /\b(not|no|isn't|cannot|can't|unable)\b[^.;,]{0,24}(immediate|right away)|(不能|无法|不可|非)\s*(随时|立即|马上)/i.test(text);
  if (!negated && /immediate|right away|随时|立即|马上/i.test(text)) return { value: text, status: 'known', days: 0 };
  if (negated) return { value: text, status: 'known' };
  return { value: text, status: 'known' };
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};
const CJK_DIGITS: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

/** Number words before a unit as digits: "one month and two weeks" → "1 month and 2 weeks", "两周" → "2周", "十二个月" → "12个月". */
function numbersAsDigits(text: string): string {
  return text
    .replace(/\b(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?=\s+(days?|weeks?|months?)\b)/gi, (w) => String(WORD_NUMBERS[w.toLowerCase()]))
    .replace(/([一二两三四五六七八九]?十[一二三四五六七八九]?|[一二两三四五六七八九])(?=\s*(天|周|个?星期|个月))/g, (w) => {
      if (!w.includes('十')) return String(CJK_DIGITS[w]);
      const [tens, ones] = w.split('十');
      return String((tens ? CJK_DIGITS[tens] : 1) * 10 + (ones ? CJK_DIGITS[ones] : 0));
    });
}
