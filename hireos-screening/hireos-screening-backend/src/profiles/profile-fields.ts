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
  /** Where the values come from: the résumé, a person (a correction, or what was confirmed on a paste), or — for a
   * profile version made before contacts were recorded per version — the candidate's record. */
  source: 'resume' | 'correction' | 'record';
  evidence: FieldEvidence[];
  /** Why there is no source location: the source text can't be read, or the value wasn't found in it. */
  evidenceUnavailable: 'source_unavailable' | 'not_located' | null;
  /** Values of a list field that couldn't be found in the source, while others could (#155 AC-2). */
  unlocatedValues: string[];
};

export const PROFILE_FIELDS = [
  'name', 'email', 'phone', 'location', 'employment_history', 'education', 'skills', 'languages',
  'certifications', 'projects', 'compensation_expectation', 'availability',
] as const;

type Segment = { id: string; text: string; page?: number };
type Source = { resumeVersionId: string; resumeVersion: number; materialId: string; readable: boolean; segments: Segment[] };
/** `together`: texts that must all be in the same paragraph (a job's company and title), tried before `needles`. */
type Item = {
  value: string;
  needles: string[];
  together?: string[];
  /** Ways the start (and end) may be written; company + title + a start followed by its end pins the paragraph. */
  dateForms?: string[];
  endForms?: string[];
  /** Words one of which must be in the paragraph too: a salary is where the résumé talks about pay (#155 review). */
  context?: RegExp;
  /** Another item has the same company and title, so they alone can't tell which paragraph is this one. */
  ambiguous?: boolean;
  incomplete?: string[];
};

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
  // A location the user typed on paste (different from what was read) is theirs: no split, no source position.
  const confirmedLocation = record(location.evidence).source === 'user_confirmed';
  const availability = record(p.availability);
  const compensation = record(p.compensationExpectation);
  const contact = p.contact && typeof p.contact === 'object' ? record(p.contact) : null;

  const items: Record<ProfileField['field'], Item[]> = {
    name: one(text(p.displayName) || candidate.displayName),
    // The contact this version recorded; older versions without one fall back to the candidate's record (#155 review).
    email: one(contact ? text(contact.email) : (candidate.email ?? '')),
    phone: one(contact ? text(contact.phone) : (candidate.phone ?? '')),
    location: location.status === 'known' && text(location.value)
      ? [{
          value: text(location.value),
          needles: [text(location.value), text(location.city)],
          // §4.1: country + city as well as the text.
          incomplete: confirmedLocation ? [] : [...(!text(location.country) ? ['country'] : []), ...(!text(location.city) ? ['city'] : [])],
        }]
      : [],
    employment_history: asArray(p.employmentHistory).map((entry, _i, all) => {
      const e = record(entry);
      const [company, title, start, end] = [text(e.company), text(e.title), text(e.start), text(e.end)];
      const sameRole = all.filter((other) => normalize(text(record(other).company)) === normalize(company) && normalize(text(record(other).title)) === normalize(title)).length > 1;
      return {
        dateForms: monthForms(formatMonth(start)),
        endForms: isPresent(end) ? PRESENT_FORMS : monthForms(formatMonth(end)),
        ambiguous: sameRole,
        value: [title, company].filter(Boolean).join(' · ') + (start || end ? ` (${start || '?'} – ${end || '?'})` : ''),
        // Company and title in the same paragraph: two jobs with the same title at different companies each find
        // their own paragraph; a title alone is used only when there is no company (#155 review).
        ...(company && title ? { together: [company, title], needles: [] } : { needles: [company || title] }),
        // Dates read as YYYY-MM (or present); anything else is kept as written and the entry counts as partly read.
        incomplete: [...(!company ? ['company'] : []), ...(!title ? ['title'] : []), ...(!formatMonth(start) || !(isPresent(end) || formatMonth(end)) ? ['dates'] : [])],
      };
    }),
    education: asArray(p.education).map((entry, _i, all) => {
      const e = record(entry);
      const [school, degree, major, period] = [text(e.school), text(e.degree), text(e.major), text(e.period)];
      const split = [school, degree, major].filter(Boolean).join(' · ');
      const statement = split || text(e.statement);
      // Two degrees from one school are told apart by their start year, as two stints of a job are (#155 review).
      const sameSchool = !!school && all.filter((other) => normalize(text(record(other).school)) === normalize(school)).length > 1;
      return {
        value: statement + (period ? ` (${period})` : ''),
        ...(school
          ? { together: [school], dateForms: (period.match(/\d{4}/g) ?? []).slice(0, 1), endForms: (period.match(/\d{4}/g) ?? []).slice(1, 2), ambiguous: sameSchool, needles: [] }
          : { needles: [text(e.statement), major] }),
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
      return {
        value: [name, description].filter(Boolean).join(': '),
        // Name and description in the same paragraph, so projects that read alike each find their own.
        ...(name && description ? { together: [name, description], needles: [] } : { needles: [name || description] }),
        incomplete: description ? [] : ['description'],
      };
    }),
    compensation_expectation: compensation.min != null || compensation.max != null
      ? [{
          value: `${salaryRange(compensation)} ${text(compensation.currency)}${compensation.period ? ` / ${compensation.period}` : ''}${compensation.basis === 'gross' || compensation.basis === 'net' ? `, ${compensation.basis}` : ''}`.trim(),
          needles: salaryNeedles(compensation),
          // An amount alone could be any number in the résumé ("cut costs by 60000 USD"): only a paragraph about pay counts.
          context: SALARY_CONTEXT,
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
    const fromCorrection = (!!correctedField[field] && corrected.has(correctedField[field]!)) || (field === 'location' && confirmedLocation);
    // Each value is located on its own, so one found value can't hide another that wasn't (#155 AC-2).
    const located = source?.readable ? list.map((item) => ({ item, at: locateItem(item, paragraphs, source) })) : [];
    const evidence = dedupe(located.map((l) => l.at).filter((e): e is FieldEvidence => !!e));
    const unlocatedValues = located.length && evidence.length ? located.filter((l) => !l.at).map((l) => l.item.value) : [];
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
      source: fromCorrection ? 'correction' : !contact && (field === 'email' || field === 'phone') ? 'record' : 'resume',
      evidence,
      evidenceUnavailable: !list.length ? null : !source?.readable ? 'source_unavailable' : evidence.length ? null : 'not_located',
      unlocatedValues,
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
function locateItem(item: Item, paragraphs: ReturnType<typeof numberParagraphs>, source: Source): FieldEvidence | null {
  if (item.together?.length) {
    const parts = item.together.map(normalize).filter(Boolean);
    const candidates = paragraphs.filter((p) => parts.every((part) => p.normalized.includes(part)));
    // The start month tells two stints of the same role apart (#155 review).
    // A start followed by its own end: the previous stint's end month ("Jan 2015 – Jan 2017") is not this one's start.
    const dated = item.dateForms?.length ? candidates.find((p) => startsThenEnds(p.normalized, item.dateForms!, item.endForms ?? [])) : undefined;
    if (dated) return evidenceAt(dated, parts[0], source);
    // Without a matching month, company + title must point at one paragraph and one job; otherwise it isn't pinned.
    if (candidates.length === 1 && !item.ambiguous) return evidenceAt(candidates[0], parts[0], source);
    return null;
  }
  if (item.context) {
    const about = paragraphs.filter((p) => item.context!.test(p.segment.text));
    return locate(item.needles, about, source);
  }
  return locate(item.needles, paragraphs, source);
}

const SALARY_CONTEXT = /salary|compensation|expected\s+(pay|package|income|ctc)|pay\s+expectation|\bctc\b|remuneration|薪资|薪酬|期望薪|月薪|年薪|待遇|薪水|工资/i;

const PRESENT_FORMS = ['present', 'now', 'current', 'today', '至今', '现在', '目前'];

/** Where a date form occurs as a whole: "2017-1" is not found inside "2017-10", nor "2017" inside "12017". */
function dateAt(text: string, form: string, from = 0): number {
  for (let at = text.indexOf(form, from); at !== -1; at = text.indexOf(form, at + 1)) {
    const before = at > 0 ? text[at - 1] : '';
    const after = text[at + form.length] ?? '';
    if (!/\d/.test(before) && !/\d/.test(after)) return at;
  }
  return -1;
}

/** Whether the text has one of the start forms, followed — when an end is known — by one of the end forms. */
function startsThenEnds(text: string, starts: string[], ends: string[]): boolean {
  for (const start of starts) {
    for (let at = dateAt(text, start); at !== -1; at = dateAt(text, start, at + 1)) {
      if (!ends.length) return true;
      const after = at + start.length;
      if (ends.some((end) => dateAt(text, end, after) !== -1)) return true;
    }
  }
  return false;
}

/** How a YYYY-MM month may be written in a résumé, lower-cased: 2015-01, 2015/01, 2015.01, 2015年1月, 01/2015, jan 2015… */
function monthForms(month: string | null): string[] {
  if (!month) return [];
  const [year, mm] = month.split('-');
  const m = String(Number(mm));
  const names = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const full = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const i = Number(mm) - 1;
  return [`${year}-${mm}`, `${year}/${mm}`, `${year}.${mm}`, `${year}-${m}`, `${year}/${m}`, `${year}.${m}`, `${year}年${m}月`, `${year}年${mm}月`,
    `${mm}/${year}`, `${m}/${year}`, `${names[i]} ${year}`, `${names[i]}. ${year}`, `${full[i]} ${year}`];
}

function evidenceAt(hit: ReturnType<typeof numberParagraphs>[number], probe: string, source: Source): FieldEvidence {
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

function locate(needles: string[], paragraphs: ReturnType<typeof numberParagraphs>, source: Source): FieldEvidence | null {
  // The most specific text first: a project's description over its name, which may appear in other lines too.
  for (const needle of needles.map(normalize).filter((n) => n.length >= 2).sort((a, b) => b.length - a.length)) {
    // The whole text, however long: two projects that open alike must not share a paragraph (#155 review).
    const probe = needle;
    // A phone number is stored in E.164 but written with spaces or dashes: compare its digits.
    const phone = /^\+?\d{7,15}$/.test(needle) ? needle.replace('+', '') : null;
    const hit = paragraphs.find((p) => (phone ? p.digits.includes(phone) : p.normalized.includes(probe)));
    if (hit) return evidenceAt(hit, probe, source);
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
