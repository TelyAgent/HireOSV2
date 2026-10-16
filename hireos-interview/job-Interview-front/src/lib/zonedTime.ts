/**
 * Wall-clock times in a chosen IANA time zone (#231). A scheduler picks "10:00" and "Asia/Shanghai": that is one
 * instant, whatever time zone the browser is in. Converting needs care around daylight saving: a wall time that
 * the clocks skip doesn't exist ("gap"), one they repeat happens twice ("overlap") — both are reported, never
 * guessed. No imports, so it can be tested as is.
 */

/** Zones offered when scheduling. Others still work if a round already has one. */
export const SCHEDULE_TIME_ZONES = [
  "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Tokyo", "Asia/Ho_Chi_Minh", "Asia/Kolkata",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney", "UTC",
] as const;

export function isIanaZone(zone: string | null | undefined): zone is string {
  if (!zone || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** "YYYY-MM-DDTHH:mm" — the wall time of an instant in a zone (what a datetime-local input holds). */
export function instantToWallTime(iso: string, zone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export type ZonedInstant =
  | { kind: "ok"; iso: string }
  | { kind: "gap" } // skipped by a daylight-saving change: doesn't exist
  | { kind: "overlap"; earlier: string; later: string } // repeated by a daylight-saving change: happens twice
  | { kind: "invalid" };

/** The instant a wall time in a zone stands for. */
export function wallTimeToInstant(wall: string, zone: string): ZonedInstant {
  const m = wall.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!m || !isIanaZone(zone)) return { kind: "invalid" };
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Every offset the zone uses around then (a day either side covers any change); keep those that land on the wall time.
  const offsets = new Set<number>();
  for (const probe of [asUtc - 86_400_000, asUtc, asUtc + 86_400_000]) {
    const w = instantToWallTime(new Date(probe).toISOString(), zone);
    const [d, t] = w.split("T");
    const [y, mo, da] = d.split("-").map(Number);
    const [h, mi] = t.split(":").map(Number);
    offsets.add(Date.UTC(y, mo - 1, da, h, mi) - probe);
  }
  const hits = [...new Set([...offsets].map((off) => asUtc - off))]
    .filter((t) => instantToWallTime(new Date(t).toISOString(), zone) === wall)
    .sort((a, b) => a - b);
  if (hits.length === 0) return { kind: "gap" };
  if (hits.length > 1) return { kind: "overlap", earlier: new Date(hits[0]).toISOString(), later: new Date(hits[hits.length - 1]).toISOString() };
  return { kind: "ok", iso: new Date(hits[0]).toISOString() };
}

/** "Oct 15, 10:00 AM GMT+8" — the instant written in the zone it was scheduled in, the zone named. */
export function formatInZone(iso: string, zone: string, lang: "en" | "zh"): string {
  return new Date(iso).toLocaleString(lang === "zh" ? "zh-CN" : "en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: zone, timeZoneName: "short" });
}
