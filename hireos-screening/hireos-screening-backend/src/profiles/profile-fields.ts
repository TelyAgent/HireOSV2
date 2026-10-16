import { formatMonth, isPresent } from './experience';

/**
 * The profile, field by field (F02 FR-1/FR-2, #155): each field's values, whether it is known, not provided or
 * only partly read, and where each value sits in the résumé — résumé version, page (PDFs) and paragraph. The
 * location is found by looking the value up in the stored material's paragraphs, so it is the same on every
 * read and works for any parser. Nothing is filled in: a field the résumé doesn't give is "missing".
 */
export type FieldStatus = 'known' | 'missing' | 'partial';

export type FieldEvidence = {
  resumeVersionId: string;
  resumeVersion: number;
  materialId: string;
  segmentId: string;
  /** PDF page; null for files without pages. */
  page: number | null;
  /** Paragraph number, counted within the page when there is one. */
  paragraph: number;
  quote: string;
};

export type ProfileField = {
  field: (typeof PROFILE_FIELDS)[number];
  status: FieldStatus;
  values: string[];
  /** What is missing from a partly read field, e.g. the dates of a job. */
  incomplete: string[];
  /** Where the values come from: the résumé, or a person (a correction, or what was confirmed on a paste). */
  source: 'resume' | 'correction';
  evidence: FieldEvidence[];
  /** Why there is no source location: the source text can't be read, or the value wasn't found in it. */
  evidenceUnavailable: 'source_unavailable' | 'not_located' | null;
};

export const PROFILE_FIELDS = [
  'name', 'email', 'phone', 'location', 'employment_history', 'education', 'skills', 'languages',
  'certifications', 'projects', 'compensation_expectation', 'availability',
] as const;

type Segment = { id: string; text: string; page?: number };
type Source = { resumeVersionId: string; resumeVersion: number; materialId: string; readable: boolean; segments: Segment[] };
type Item = { value: string; needles: string[]; incomplete?: string[] };

export function profileFields(
  profile: Record<string, unknown> | null | undefined,
  candidate: { displayName: string; email: string | null; phone: string | null },
  source: Source | null,
): ProfileField[] {
  const p = profile ?? {};
  const corrected = new Set(asArray(p.corrections).map((c) => String(record(c).fieldPath ?? '')));
  const paragraphs = numberParagraphs(source?.segments ?? []);
  const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const named = (value: unknown) => text(typeof value === 'string' ? value : record(value).name);
  const location = record(p.location);
  const availability = record(p.availability);
  const compensation = record(p.compensationExpectation);

  const items: Record<ProfileField['field'], Item[]> = {
    name: one(text(p.displayName) || candidate.displayName),
    email: one(candidate.email ?? ''),
    phone: one(candidate.phone ?? ''),
    location: location.status === 'known' && text(location.value)
      ? [{
          value: text(location.value),
          needles: [text(location.value), text(location.city)],
          // §4.1: country + city as well as the text.
          incomplete: [...(!text(location.country) ? ['country'] : []), ...(!text(location.city) ? ['city'] : [])],
        }]
      : [],
    employment_history: asArray(p.employmentHistory).map((entry) => {
      const e = record(entry);
      const [company, title, start, end] = [text(e.company), text(e.title), text(e.start), text(e.end)];
      return {
        value: [title, company].filter(Boolean).join(' · ') + (start || end ? ` (${start || '?'} – ${end || '?'})` : ''),
        needles: [company, title],
        // Dates read as YYYY-MM (or present); anything else is kept as written and the entry counts as partly read.
        incomplete: [...(!company ? ['company'] : []), ...(!title ? ['title'] : []), ...(!formatMonth(start) || !(isPresent(end) || formatMonth(end)) ? ['dates'] : [])],
      };
    }),
    education: asArray(p.education).map((entry) => {
      const e = record(entry);
      const [school, degree, major, period] = [text(e.school), text(e.degree), text(e.major), text(e.period)];
      const split = [school, degree, major].filter(Boolean).join(' · ');
      const statement = split || text(e.statement);
      return {
        value: statement + (period ? ` (${period})` : ''),
        needles: [school, text(e.statement), major],
        // §4.1: school, degree, major and dates, each on its own.
        incomplete: [...(!school ? ['school'] : []), ...(!degree ? ['degree'] : []), ...(!major ? ['major'] : []), ...(!period ? ['dates'] : [])],
      };
    }),
    skills: asArray(p.skills).map(named).filter(Boolean).map((name) => ({ value: name, needles: [name] })),
    languages: asArray(p.languages).map(named).filter(Boolean).map((name) => ({ value: name, needles: [name] })),
    certifications: asArray(p.certifications).map(named).filter(Boolean).map((name) => ({ value: name, needles: [name] })),
    projects: asArray(p.projects).map((entry) => {
      const e = record(entry);
      const [name, description] = [text(e.name), text(e.description)];
      return { value: [name, description].filter(Boolean).join(': '), needles: [name, description], incomplete: description ? [] : ['description'] };
    }),
    compensation_expectation: compensation.min != null || compensation.max != null
      ? [{
          value: `${salaryRange(compensation)} ${text(compensation.currency)}${compensation.period ? ` / ${compensation.period}` : ''}${compensation.basis === 'gross' || compensation.basis === 'net' ? `, ${compensation.basis}` : ''}`.trim(),
          needles: salaryNeedles(compensation),
          incomplete: [...(!text(compensation.currency) ? ['currency'] : []), ...(!compensation.period ? ['period'] : [])],
        }]
      : [],
    availability: availability.status === 'known' && text(availability.value)
      ? [{
          value: text(availability.value)
            + (typeof availability.days === 'number' ? ` (${availability.days} days)` : typeof availability.date === 'string' ? ` (${availability.date})` : ''),
          needles: [text(availability.value)],
        }]
      : [],
  };

  const correctedField: Partial<Record<ProfileField['field'], string>> = {
    name: 'display_name', email: 'email', phone: 'phone', location: 'location', projects: 'projects', compensation_expectation: 'compensation_expectation',
  };
  return PROFILE_FIELDS.map((field) => {
    const list = items[field].filter((item) => item.value);
    const incomplete = [...new Set(list.flatMap((item) => item.incomplete ?? []))];
    const fromCorrection = !!correctedField[field] && corrected.has(correctedField[field]!);
    const evidence = source?.readable ? dedupe(list.map((item) => locate(item.needles, paragraphs, source)).filter((e): e is FieldEvidence => !!e)) : [];
    // A name the résumé text doesn't contain came from the file name: it stands until someone confirms it (§4.1).
    if (field === 'name' && list.length && !fromCorrection && source?.readable && !evidence.length) incomplete.push('to_confirm');
    // A person's correction stands as entered; the split formats apply to parsed values.
    if (fromCorrection) incomplete.length = 0;
    const status: FieldStatus = !list.length ? 'missing' : incomplete.length ? 'partial' : 'known';
    return {
      field,
      status,
      values: list.map((item) => item.value),
      incomplete,
      source: fromCorrection ? 'correction' : 'resume',
      evidence,
      evidenceUnavailable: !list.length ? null : !source?.readable ? 'source_unavailable' : evidence.length ? null : 'not_located',
    };
  });
}

/** Each paragraph's number, counted within its page when the file has pages. */
function numberParagraphs(segments: Segment[]) {
  const perPage = new Map<number, number>();
  return segments.map((segment, index) => {
    const page = segment.page ?? null;
    const paragraph = page === null ? index + 1 : (perPage.get(page) ?? 0) + 1;
    if (page !== null) perPage.set(page, paragraph);
    return { segment, page, paragraph, normalized: normalize(segment.text), digits: segment.text.replace(/\D/g, '') };
  });
}

/** The first paragraph containing one of the value's texts (a long one by its opening words). */
function locate(needles: string[], paragraphs: ReturnType<typeof numberParagraphs>, source: Source): FieldEvidence | null {
  // The most specific text first: a project's description over its name, which may appear in other lines too.
  for (const needle of needles.map(normalize).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length)) {
    const probe = needle.length > 40 ? needle.slice(0, 32) : needle;
    // A phone number is stored in E.164 but written with spaces or dashes: compare its digits.
    const phone = /^\+?\d{7,15}$/.test(needle) ? needle.replace('+', '') : null;
    const hit = paragraphs.find((p) => (phone ? p.digits.includes(phone) : p.normalized.includes(probe)));
    if (hit) {
      const at = hit.segment.text.toLowerCase().indexOf(probe.split(' ')[0]);
      return {
        resumeVersionId: source.resumeVersionId,
        resumeVersion: source.resumeVersion,
        materialId: source.materialId,
        segmentId: hit.segment.id,
        page: hit.page,
        paragraph: hit.paragraph,
        quote: hit.segment.text.slice(Math.max(0, at - 40), Math.max(0, at - 40) + 160).replace(/\s+/g, ' ').trim(),
      };
    }
  }
  return null;
}

/** "35,000,000", or "30,000–40,000" for a range. */
function salaryRange(c: Record<string, unknown>) {
  const figure = (n: unknown) => (typeof n === 'number' ? n.toLocaleString('en-US') : '?');
  return c.min === c.max ? figure(c.min) : `${figure(c.min)}–${figure(c.max)}`;
}

/** How a salary figure may be written: 35000, 35,000, 35K, 35k, 3.5万. */
function salaryNeedles(c: Record<string, unknown>) {
  return [c.min, c.max].filter((n): n is number => typeof n === 'number' && n > 0).flatMap((n) => [
    `${n}`, n.toLocaleString('en-US'), ...(n % 1000 === 0 ? [`${n / 1000}k`] : []), ...(n % 1000 === 0 ? [`${n / 10000}万`] : []),
  ]);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function one(value: string): Item[] {
  return value ? [{ value, needles: [value] }] : [];
}

function dedupe(evidence: FieldEvidence[]) {
  return evidence.filter((e, i) => evidence.findIndex((o) => o.segmentId === e.segmentId) === i);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}
