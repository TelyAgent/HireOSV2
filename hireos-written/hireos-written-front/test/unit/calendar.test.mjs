// #352 -- "due today" counts by the calendar day in the zone dates are shown in (Asia/Shanghai), not by UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayIn, sameDayIn } from "../../src/utils/calendar.ts";

const TZ = "Asia/Shanghai";
const now = "2026-10-16T01:00:00Z"; // 09:00 on the 16th in Shanghai

test("#352 AC-1: due 07:00 the same Shanghai day counts as today; the day before and after don't", () => {
  assert.equal(sameDayIn("2026-10-15T23:00:00Z", now, TZ), true, "07:00 on the 16th in Shanghai (still the 15th in UTC)");
  assert.equal(sameDayIn("2026-10-15T15:59:00Z", now, TZ), false, "23:59 on the 15th in Shanghai");
  assert.equal(sameDayIn("2026-10-16T16:00:00Z", now, TZ), false, "00:00 on the 17th in Shanghai");
});

test("#352 AC-2: around local midnight, and a zone with daylight saving, the zone's own date is used", () => {
  assert.equal(dayIn("2026-10-15T15:59:59Z", TZ), "2026-10-15");
  assert.equal(dayIn("2026-10-15T16:00:00Z", TZ), "2026-10-16");
  // New York: 23:30 on 1 Nov 2026 (after the DST change) is 04:30 UTC on the 2nd.
  assert.equal(dayIn("2026-11-02T04:30:00Z", "America/New_York"), "2026-11-01");
  assert.equal(dayIn("2026-03-08T07:30:00Z", "America/New_York"), "2026-03-08", "the night the clocks go forward");
});

import { formatDate, formatDateTime, relativeTime } from "../../src/utils/calendar.ts";

test("#237 AC-1: the same instant is written in the interface language, in the shown zone", () => {
  const at = "2026-10-16T01:00:00Z";
  assert.equal(formatDateTime(at, "en", TZ), "Oct 16, 2026, 9:00 AM");
  assert.match(formatDateTime(at, "zh", TZ), /^2026年10月16日 09:00$/);
  assert.equal(formatDate(at, "en", TZ), "Oct 16, 2026");
  assert.equal(formatDate(at, "zh", TZ), "2026年10月16日");
  assert.equal(formatDateTime(null, "zh", TZ), "—");
});

test("#237 AC-2: relative time covers zero, the past and the future in both languages", () => {
  const now = "2026-10-16T01:00:00Z";
  const minus = (min) => new Date(new Date(now).getTime() - min * 60000).toISOString();
  assert.deepEqual([relativeTime(now, now, "en"), relativeTime(now, now, "zh")], ["just now", "刚刚"]);
  assert.deepEqual([relativeTime(minus(5), now, "en"), relativeTime(minus(5), now, "zh")], ["5m ago", "5 分钟前"]);
  assert.deepEqual([relativeTime(minus(180), now, "en"), relativeTime(minus(180), now, "zh")], ["3h ago", "3 小时前"]);
  assert.deepEqual([relativeTime(minus(3 * 1440), now, "en"), relativeTime(minus(3 * 1440), now, "zh")], ["3d ago", "3 天前"]);
  assert.deepEqual([relativeTime(minus(-120), now, "en"), relativeTime(minus(-120), now, "zh")], ["in 2h", "2 小时后"], "the future, not \"-2h ago\"");
});

test("#412: a zone's day as the instants it starts and ends, so the server counts the same 'Due today'", async () => {
  const { dayRangeIn } = await import("../../src/utils/calendar.ts");
  assert.deepEqual(dayRangeIn(now, TZ), { from: "2026-10-15T16:00:00.000Z", to: "2026-10-16T16:00:00.000Z" });
  assert.deepEqual(dayRangeIn("2026-10-15T15:59:59Z", TZ), { from: "2026-10-14T16:00:00.000Z", to: "2026-10-15T16:00:00.000Z" });
  // New York, the day the clocks go back: 25 hours long.
  assert.deepEqual(dayRangeIn("2026-11-01T15:00:00Z", "America/New_York"), { from: "2026-11-01T04:00:00.000Z", to: "2026-11-02T05:00:00.000Z" });
  for (const iso of ["2026-10-15T23:00:00Z", "2026-10-16T15:59:00Z"]) {
    const { from, to } = dayRangeIn(now, TZ);
    assert.equal(iso >= from && iso < to, sameDayIn(iso, now, TZ), iso);
  }
});
