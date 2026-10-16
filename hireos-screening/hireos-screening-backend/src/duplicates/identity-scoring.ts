/**
 * Is an uploaded résumé someone already on record? (F03 §4.1–4.2, #151.) Every signal is scored and the scores
 * are added up — no single hit decides, and the search doesn't stop at the first match. The total sorts the
 * upload into one of three bands; none of them ever merges anything on its own, a person always decides.
 * Weights and thresholds live in the policy, whose version is stored with every check.
 */
import { formatMonth } from '../profiles/experience';
import { dateAt, monthForms } from '../profiles/profile-fields';

export const IDENTITY_POLICY = {
  version: 'f03-identity-2026-10-16',
  points: {
    email: 40,
    phone: 30,
    employment: 20,
    name_exact: 15,
    name_close: 8,
    content: 15,
    education: 10,
    contact_conflict: -30,
  },
  /** ≥ newVersion: likely a newer résumé of the same person; ≥ review: needs a review; below: no prompt. */
  thresholds: { newVersion: 70, review: 40 },
  content: { minChars: 200, shingle: 5, same: 0.95, signal: 0.8 },
  minPhoneDigits: 7,
  minJobsInCommon: 2,
} as const;

export type SignalKey = keyof typeof IDENTITY_POLICY.points;
export type Signal = { key: SignalKey; points: number; detail: string };
export type ContactComparison = 'same' | 'different' | 'missing_uploaded' | 'missing_existing' | 'missing_both';
export type Band = 'new_resume_version' | 'possible_same_person' | 'none';

export type IdentityScore = {
  policyVersion: string;
  total: number;
  band: Band;
  signals: Signal[];
  contentSimilarity: number | null;
  /** How the two sides' email and phone compare — what the review copy must describe (#154). */
  contact: { email: ContactComparison; phone: ContactComparison };
};

export type UploadedSide = { name: string; email: string | null; phone: string | null; text: string };
export type ExistingSide = {
  name: string;
  email: string | null;
  phone: string | null;
  text: string | null;
  employment: Array<{ company?: unknown; title?: unknown; start?: unknown }>;
  education: Array<{ school?: unknown; major?: unknown; statement?: unknown; period?: unknown }>;
};

export function scoreIdentity(uploaded: UploadedSide, existing: ExistingSide): IdentityScore {
  const P = IDENTITY_POLICY.points;
  const signals: Signal[] = [];
  const contact = {
    email: compare(lower(uploaded.email), lower(existing.email)),
    phone: compare(phoneDigits(uploaded.phone), phoneDigits(existing.phone)),
  };
  if (contact.email === 'same') signals.push({ key: 'email', points: P.email, detail: `Same email: ${lower(uploaded.email)}` });
  if (contact.phone === 'same') signals.push({ key: 'phone', points: P.phone, detail: `Same phone number: ${uploaded.phone}` });

  const uploadedLines = contentLines(uploaded.text);
  const jobs = existing.employment.filter((job) => jobInText(job, uploadedLines));
  if (jobs.length >= IDENTITY_POLICY.minJobsInCommon) {
    signals.push({ key: 'employment', points: P.employment, detail: `${jobs.length} jobs with the same company, title and start month: ${jobs.map((j) => `${str(j.title)} · ${str(j.company)}`).join('; ')}` });
  }

  const [a, b] = [normalizeName(uploaded.name), normalizeName(existing.name)];
  if (a && b && a === b) signals.push({ key: 'name_exact', points: P.name_exact, detail: `Same name: ${existing.name}` });
  // §4.2: one character apart, short names included ("王芳" / "王芬"); a one-character name is too short to compare.
  else if (a && b && Math.min(a.length, b.length) >= 2 && editDistanceAtMostOne(a, b)) {
    signals.push({ key: 'name_close', points: P.name_close, detail: `Similar name (one character apart): ${uploaded.name} / ${existing.name}` });
  }

  const similarity = existing.text == null ? null : contentSimilarity(uploaded.text, existing.text);
  if (similarity != null && similarity >= IDENTITY_POLICY.content.signal && similarity < IDENTITY_POLICY.content.same) {
    signals.push({ key: 'content', points: P.content, detail: `Résumé text ${Math.floor(similarity * 100)}% similar` });
  }

  const schools = existing.education.filter((entry) => educationInText(entry, uploadedLines));
  if (schools.length) {
    signals.push({ key: 'education', points: P.education, detail: `Same education: ${schools.map((e) => str(e.school) || str(e.statement)).join('; ')}` });
  }

  if (contact.email === 'different' && contact.phone === 'different') {
    signals.push({ key: 'contact_conflict', points: P.contact_conflict, detail: 'Both have an email and a phone number, and both differ' });
  }

  const total = Math.max(0, Math.min(100, signals.reduce((sum, s) => sum + s.points, 0)));
  const band: Band = total >= IDENTITY_POLICY.thresholds.newVersion ? 'new_resume_version'
    : total >= IDENTITY_POLICY.thresholds.review ? 'possible_same_person' : 'none';
  return { policyVersion: IDENTITY_POLICY.version, total, band, signals, contentSimilarity: similarity, contact };
}

/**
 * CNT-1: half-width, lower case, no whitespace, punctuation or bullets, and no page numbers or lines repeated
 * as page headers / footers.
 */
export function normalizeContent(text: string): string {
  const lines = text.normalize('NFKC').toLowerCase().split(/\r?\n/).map((line) => line.trim());
  const counts = new Map<string, number>();
  for (const line of lines) if (line && line.length <= 60) counts.set(line, (counts.get(line) ?? 0) + 1);
  return lines
    .filter((line) => !/^(page\s*)?\d+(\s*(of|\/)\s*\d+)?$|^第\s*\d+\s*页(\s*[/共]\s*\d+\s*页?)?$/.test(line))
    .filter((line) => !(line.length <= 60 && (counts.get(line) ?? 0) >= 3))
    .join('')
    .replace(/[\s\p{P}\p{S}•●▪◦·]/gu, '');
}

/** CNT-2/3: share of 5-character slices the two texts have in common; null when either is too short to compare. */
export function contentSimilarity(a: string, b: string): number | null {
  const [x, y] = [normalizeContent(a), normalizeContent(b)];
  if (x.length < IDENTITY_POLICY.content.minChars || y.length < IDENTITY_POLICY.content.minChars) return null;
  if (x === y) return 1;
  const [sx, sy] = [shingles(x), shingles(y)];
  let shared = 0;
  for (const s of sx) if (sy.has(s)) shared += 1;
  return shared / (sx.size + sy.size - shared);
}

function shingles(text: string) {
  const size = IDENTITY_POLICY.content.shingle;
  const set = new Set<string>();
  for (let i = 0; i + size <= text.length; i++) set.add(text.slice(i, i + size));
  return set;
}

export function normalizeName(name: string | null | undefined): string {
  return (name ?? '').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function editDistanceAtMostOne(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** The uploaded text line by line: as written (lower case, spaces collapsed) for dates, and normalized for names. */
function contentLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => ({ raw: line.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim(), normalized: normalizeContent(line) }))
    .filter((line) => line.normalized);
}
type Line = ReturnType<typeof contentLines>[number];

const YEAR = /(^|\D)((19|20)\d{2})(?=\D|$)/;

/**
 * Whether one entry of the résumé holds every part, with `startForms` as its first date (#151 review). An entry starts
 * at a line naming it and runs to its first dated line (at most three lines: a company above its title and dates is
 * common), so the next job's company, title or dates never count for this one. Dates are compared whole, as written:
 * "2021-1" is not found in "2021-10".
 */
function entryInLines(lines: Line[], names: string[], parts: string[], startForms: string[], year: string) {
  for (let i = 0; i < lines.length; i++) {
    if (!names.some((name) => lines[i].normalized.includes(name))) continue;
    const entry: Line[] = [];
    for (const line of lines.slice(i, i + ENTRY_LINES)) {
      entry.push(line);
      if (YEAR.test(line.raw)) break;
    }
    const normalized = entry.map((line) => line.normalized).join('');
    if (!parts.every((part) => normalized.includes(part))) continue;
    const raw = entry.map((line) => line.raw).join(' ');
    const first = YEAR.exec(raw);
    if (!first) continue;
    const firstYearAt = first.index + first[1].length;
    if (startForms.some((form) => {
      for (let at = dateAt(raw, form); at !== -1; at = dateAt(raw, form, at + 1)) if (at + form.indexOf(year) === firstYearAt) return true;
      return false;
    })) return true;
  }
  return false;
}

/** A job counts as shared when one entry has its company, title and — as that entry's start — its start month. */
function jobInText(job: ExistingSide['employment'][number], lines: Line[]) {
  const company = normalizeContent(str(job.company));
  const title = normalizeContent(str(job.title));
  const month = formatMonth(job.start);
  if (!company || !title || !month) return false;
  return entryInLines(lines, [company, title], [company, title], monthForms(month), month.slice(0, 4));
}

/** Education counts when one entry has its school, major (if recorded) and years, starting with its first year. */
function educationInText(entry: ExistingSide['education'][number], lines: Line[]) {
  const school = normalizeContent(str(entry.school));
  const major = normalizeContent(str(entry.major));
  const years = str(entry.period).match(/\d{4}/g) ?? [];
  const first = years[0];
  if (!school || !first) return false;
  return entryInLines(lines, [school], [school, ...(major ? [major] : []), ...years], [first], first);
}

/** An entry is at most its first line and the next two, up to its first dated line. */
const ENTRY_LINES = 3;

function compare(a: string, b: string): ContactComparison {
  if (!a && !b) return 'missing_both';
  if (!a) return 'missing_uploaded';
  if (!b) return 'missing_existing';
  return a === b ? 'same' : 'different';
}

function lower(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

/** Digits only, and only when there are enough of them to mean anything (≥ 7). */
function phoneDigits(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= IDENTITY_POLICY.minPhoneDigits ? digits : '';
}

function str(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}
