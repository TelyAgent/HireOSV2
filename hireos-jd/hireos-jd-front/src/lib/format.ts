/**
 * Formatting helpers ported from the prototype's top-of-script utilities
 * (`uid` / `nowISO` / `daysAgo` / `fmtDate` / `fmtRelative` / `money`).
 *
 * The prototype hard-coded `en-US`. Since this port adds a language switch,
 * date/relative/money output follows the active language. The store calls
 * `setFormatLang` whenever the language changes; keeping it module-level
 * (rather than threading a `lang` argument through every call site) mirrors
 * how the prototype read a single global `state`.
 */
import type { Lang } from "../store/types";

let __seq = 4000;
let __lang: Lang = "en";

export function setFormatLang(lang: Lang) {
  __lang = lang;
}

export function uid(p: string): string {
  return p + "-" + (__seq++).toString(36);
}

export function nowISO(offMin?: number): string {
  return new Date(Date.now() + (offMin || 0) * 60000).toISOString();
}

export function daysAgo(n: number, hh?: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  if (hh != null) d.setHours(hh, 0, 0, 0);
  return d.toISOString();
}

export function daysFromNow(n: number, hh?: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  if (hh != null) d.setHours(hh, 0, 0, 0);
  return d.toISOString();
}

export function hoursAgo(n: number): string {
  return new Date(Date.now() - n * 3600000).toISOString();
}

function locale(): string {
  return __lang === "zh" ? "zh-CN" : "en-US";
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString(locale(), { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" })
  );
}

export function fmtRelative(iso?: string | null): string {
  if (!iso) return "—";
  const zh = __lang === "zh";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return zh ? "刚刚" : "just now";
  if (mins < 60) return zh ? `${mins} 分钟前` : mins + "m ago";
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return zh ? `${hrs} 小时前` : hrs + "h ago";
  const days = Math.round(hrs / 24);
  if (days < 30) return zh ? `${days} 天前` : days + "d ago";
  return fmtDate(iso);
}

export interface MoneyRange {
  min: number | null;
  max: number | null;
  currency?: string;
  period?: "hour" | "month" | "year" | string;
  basis?: string;
}

/** English names of the supported currencies, for an English interface (#353). */
export const CURRENCY_EN: Record<string, string> = {
  CNY: "Chinese yuan",
  USD: "US dollar",
  SGD: "Singapore dollar",
  HKD: "Hong Kong dollar",
  EUR: "Euro",
  GBP: "British pound",
  JPY: "Japanese yen",
  VND: "Vietnamese dong",
};

export const CURRENCY_ZH: Record<string, string> = {
  CNY: "人民币",
  USD: "美元",
  SGD: "新加坡元",
  HKD: "港币",
  EUR: "欧元",
  GBP: "英镑",
  JPY: "日元",
  VND: "越南盾",
};

/**
 * The one salary line format, amount first: "15K–20K/月 · 税前 · 人民币" / "15K–20K / month · gross · USD".
 * Amounts are raw (15000, not 15). It still satisfies the completeness F1 check (range, currency, period,
 * gross/net) and parses back with `parseMoney`.
 */
export function salaryText(range: MoneyRange, lang: "zh" | "en"): string {
  const zh = lang === "zh";
  // Never rounds, so two different salaries never render the same (#99 review): whole thousands in K
  // (15000 → 15K, 1234 → 1.234K), anything else (an hourly 26, or 15000.25) as the full number.
  const k = (n: number | null) =>
    n == null
      ? "—"
      : Number.isInteger(n) && Math.abs(n) >= 1000
        ? `${(n / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 })}K`
        : n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  const amount = `${k(range.min)}–${k(range.max)}`;
  const period = range.period === "year" ? (zh ? "年" : "year") : range.period === "hour" ? (zh ? "小时" : "hour") : zh ? "月" : "month";
  const basis = range.basis === "gross" ? (zh ? "税前" : "gross") : range.basis === "net" ? (zh ? "税后" : "net") : range.basis;
  // A missing currency is said to be missing — never filled in from the interface language, which would make the
  // same amount read as yuan in Chinese and dollars in English (#236).
  const currency = range.currency ? (zh ? (CURRENCY_ZH[range.currency] ?? range.currency) : range.currency) : zh ? "币种未提供" : "currency not given";
  const parts = [zh ? `${amount}/${period}` : `${amount} / ${period}`, basis, currency];
  return parts.filter(Boolean).join(" · ");
}

export function money(range?: MoneyRange | null): string {
  const zh = __lang === "zh";
  if (!range || (range.min == null && range.max == null)) return zh ? "未指定" : "Not specified";
  return salaryText(range, zh ? "zh" : "en");
}

/** Relative-day label used by task rows ("Due Mar 3" / "Overdue"). */
export function isOverdue(iso?: string | null): boolean {
  return !!iso && new Date(iso) < new Date();
}
