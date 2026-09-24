/** Ported verbatim from the prototype's data.js date helpers. */

let seq = 1000;
export function uid(prefix: string): string {
  return prefix + "-" + (seq++).toString(36);
}

export function nowISO(offsetMin?: number): string {
  const d = new Date(Date.now() + (offsetMin || 0) * 60000);
  return d.toISOString();
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
