import { translate } from "../data/i18n";
import type { Lang } from "../store/types";

/** Formatting helpers ported from the prototype, with `lang` passed explicitly
 * instead of read off a global `state`. */

export function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const loc = lang === "zh" ? "zh-CN" : "en-US";
  return d.toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const loc = lang === "zh" ? "zh-CN" : "en-US";
  return (
    d.toLocaleDateString(loc, { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString(loc, { hour: "numeric", minute: "2-digit" })
  );
}

export function relTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60000,
    hr = 3600000,
    day = 86400000;
  let val: number, unit: "minute" | "hour" | "day";
  if (abs < hr) {
    val = Math.round(abs / min);
    unit = "minute";
  } else if (abs < day) {
    val = Math.round(abs / hr);
    unit = "hour";
  } else {
    val = Math.round(abs / day);
    unit = "day";
  }
  if (lang === "zh") {
    const unitZh = unit === "minute" ? "分钟" : unit === "hour" ? "小时" : "天";
    if (val === 0) return "刚刚";
    return diffMs < 0 ? `${val} ${unitZh}前` : `${val} ${unitZh}后`;
  }
  if (val === 0) return "just now";
  const plural = val === 1 ? unit : unit + "s";
  return diffMs < 0 ? `${val} ${plural} ago` : `in ${val} ${plural}`;
}

export interface MoneyRange {
  min: number | null;
  max: number | null;
  currency?: string | null;
  period?: "year" | "month" | "hour" | string | null;
  basis?: string | null;
}

export function fmtMoney(range: MoneyRange | null | undefined, lang: Lang): string {
  if (!range || (range.min == null && range.max == null)) return translate(lang, "Not provided");
  const cur = range.currency === "USD" ? "$" : (range.currency || "") + " ";
  const fmt = (n: number | null) => (n == null ? "?" : cur + n.toLocaleString("en-US"));
  const per = range.period === "year" ? "/yr" : range.period === "month" ? "/mo" : range.period === "hour" ? "/hr" : "";
  const basis = range.basis && range.basis !== "unknown" ? ` (${range.basis})` : "";
  if (range.min === range.max) return `${fmt(range.min)}${per}${basis}`;
  return `${fmt(range.min)}–${fmt(range.max)}${per}${basis}`;
}

export function pct(n: number | null | undefined): string {
  return n == null ? "—" : Math.round(n * 100) + "%";
}
