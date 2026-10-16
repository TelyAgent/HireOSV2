/**
 * Calendar days in a given time zone (#352): two instants are on the same day when their dates there are the same,
 * whatever the UTC date is. "Due today" counts by the same zone the dates are shown in, so a task due 07:00 in
 * Shanghai on the 16th is due on the 16th even though it is still the 15th in UTC. No imports, so it can be tested
 * as is.
 */
export function dayIn(iso: string, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export function sameDayIn(a: string, b: string, timeZone: string): boolean {
  return dayIn(a, timeZone) === dayIn(b, timeZone);
}

export type DisplayLang = "en" | "zh";

/**
 * Dates and times in the interface language, in the given zone (#237): "Oct 16, 2026, 9:00 AM" / "2026年10月16日 09:00".
 * The instant is never changed — only how it is written.
 */
export function formatDateTime(iso: string | null | undefined, lang: DisplayLang, timeZone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", year: "numeric", hour: lang === "zh" ? "2-digit" : "numeric", minute: "2-digit", timeZone, hour12: lang !== "zh" });
}

export function formatDate(iso: string | null | undefined, lang: DisplayLang, timeZone: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", year: "numeric", timeZone });
}

/** "just now" / "5m ago" / "in 2h" — "刚刚" / "5 分钟前" / "2 小时后": past and future, never "-5m ago". */
export function relativeTime(iso: string | null | undefined, nowIso: string, lang: DisplayLang): string {
  if (!iso) return "—";
  const diffMin = Math.round((new Date(nowIso).getTime() - new Date(iso).getTime()) / 60000);
  const past = diffMin >= 0;
  const mins = Math.abs(diffMin);
  if (mins < 1) return lang === "zh" ? "刚刚" : "just now";
  const [n, unit] = mins < 60 ? [mins, "m"] : Math.round(mins / 60) < 24 ? [Math.round(mins / 60), "h"] : [Math.round(mins / 60 / 24), "d"];
  if (lang === "zh") return `${n} ${unit === "m" ? "分钟" : unit === "h" ? "小时" : "天"}${past ? "前" : "后"}`;
  return past ? `${n}${unit} ago` : `in ${n}${unit}`;
}
