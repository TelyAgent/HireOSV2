import { Injectable } from '@nestjs/common';
import { readAvailability, storedPhone, type Availability } from './field-formats';

type Segment = { id: string; text: string; page?: number };

export type Evidence = {
  sourceMaterialId: string;
  segmentId: string;
  quote: string;
};

export type ParsedProfile = {
  displayName: string;
  email: string | null;
  phone: string | null;
  location: { value: string; status: 'known' | 'unknown'; evidence?: Evidence } | null;
  workAuthorization: { value: string; status: 'known' | 'unknown'; evidence?: Evidence } | null;
  skills: Array<{ name: string; evidence: Evidence }>;
  languages: Array<{ name: string; evidence: Evidence }>;
  availability: (Availability & { evidence: Evidence }) | null;
  employmentHistory: [];
  education: [];
  certifications: string[];
  projects: [];
  compensationExpectation: null;
  missingFields: string[];
  sourceEntries: Evidence[];
};

const SKILLS = [
  'TypeScript', 'JavaScript', 'Python', 'Java', 'Go', 'C#', 'Ruby', 'PHP',
  'React', 'Next.js', 'Node.js', 'NestJS', 'Express', 'Vue', 'Angular',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Kafka', 'Docker', 'Kubernetes',
  'AWS', 'Azure', 'GCP', 'Terraform', 'Git', 'GraphQL', 'REST',
];

const LANGUAGES = ['English', 'Chinese', 'Mandarin', 'Spanish', 'French', 'German', 'Japanese', 'Korean'];

@Injectable()
export class ProfileParserService {
  parse(materialId: string, segments: Segment[], fallbackName: string): ParsedProfile {
    const entries = segments.flatMap((segment) =>
      segment.text.split(/\r?\n/).map((line) => ({
        line: line.trim(),
        evidence: { sourceMaterialId: materialId, segmentId: segment.id, quote: line.trim().slice(0, 500) },
      })).filter((item) => item.line.length > 0),
    );
    const text = entries.map((item) => item.line).join('\n');
    const emailMatch = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
    const phoneMatch = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3}[\s.-]\d{4}\b/);
    const emailEvidence = emailMatch ? evidenceFor(entries, emailMatch[0]) : undefined;
    const phoneEvidence = phoneMatch ? evidenceFor(entries, phoneMatch[0]) : undefined;
    const skills = uniqueMatches(SKILLS, entries);
    const languages = uniqueMatches(LANGUAGES, entries);
    const locationEntry = entries.find(({ line }) => /\b(location|based in|address|city|居住地|所在地)\b/i.test(line));
    // "Availability: 1 month notice", "到岗时间：随时" (#155).
    const availabilityEntry = entries.find(({ line }) => AVAILABILITY.test(line));
    const availabilityValue = availabilityEntry ? labelledValue(availabilityEntry.line) : '';
    const availability = availabilityEntry && availabilityValue
      ? { ...readAvailability(availabilityValue), evidence: availabilityEntry.evidence }
      : null;
    const certificationEntries = entries.filter(({ line }) => CERTIFICATION.test(line));
    const certifications = [...new Set(certificationEntries.flatMap(({ line }) => labelledValue(line).split(/[,，;；、]\s*/)).map((v) => v.trim()).filter(Boolean))];
    const authorizationEntry = entries.find(({ line }) => /\b(authorized to work|work authorization|visa|sponsorship|citizen|permanent resident)\b/i.test(line));
    const locationValue = locationEntry ? locationFromLine(locationEntry.line) : '';
    const location = locationEntry && locationValue
      ? { value: locationValue, status: 'known' as const, evidence: locationEntry.evidence }
      : null;
    const workAuthorization = authorizationEntry
      ? { value: authorizationEntry.line.slice(0, 200), status: 'known' as const, evidence: authorizationEntry.evidence }
      : null;

    return {
      displayName: inferDisplayName(entries, fallbackName),
      email: emailMatch?.[0]?.toLowerCase() || null,
      phone: storedPhone(phoneMatch?.[0]),
      location,
      workAuthorization,
      skills,
      languages,
      availability,
      employmentHistory: [],
      education: [],
      certifications,
      projects: [],
      compensationExpectation: null,
      missingFields: [
        ...(location ? [] : ['location']),
        'employment_history',
        'education',
        'compensation_expectation',
      ],
      sourceEntries: [
        ...(emailEvidence ? [emailEvidence] : []),
        ...(phoneEvidence ? [phoneEvidence] : []),
        ...(location?.evidence ? [location.evidence] : []),
        ...(workAuthorization?.evidence ? [workAuthorization.evidence] : []),
        ...skills.map((skill) => skill.evidence),
        ...languages.map((language) => language.evidence),
        ...(availability ? [availability.evidence] : []),
        ...certificationEntries.map(({ evidence }) => evidence),
      ],
    };
  }
}

function uniqueMatches(
  vocabulary: string[],
  entries: Array<{ line: string; evidence: Evidence }>,
) {
  const found = new Map<string, Evidence>();
  for (const item of entries) {
    for (const term of vocabulary) {
      if (new RegExp(`(^|[^a-z0-9+#.-])${escapeRegExp(term)}([^a-z0-9+#.-]|$)`, 'i').test(item.line) && !found.has(term)) {
        found.set(term, item.evidence);
      }
    }
  }
  return Array.from(found, ([name, evidence]) => ({ name, evidence }));
}

function evidenceFor(entries: Array<{ line: string; evidence: Evidence }>, value: string) {
  return entries.find(({ line }) => line.toLowerCase().includes(value.toLowerCase()))?.evidence;
}

function inferDisplayName(entries: Array<{ line: string; evidence: Evidence }>, fallback: string) {
  for (const { line } of entries) {
    const name = nameFromLine(line);
    if (name) return name;
  }
  return fallback;
}

// A labelled field ("Location: Hanoi", "Email: …", "居住地：…") or a "Based in …" line is never the name (#164).
const FIELD_LINE = /^(location|based in|address|city|email|e-mail|phone|mobile|tel|linkedin|github|website|portfolio|nationality|居住地|所在地|现居|地址|邮箱|电话|手机|求职意向)\b|^(居住地|所在地|现居|地址|邮箱|电话|手机)|[:：]/i;
const DATE = /\d{4}\s*[-/.年]\s*\d{1,2}(?:\s*[-/.月]\s*\d{1,2}\s*日?|\s*月)?|\b(?:19|20)\d{2}\b/g;
const HEADING = /resume|curriculum vitae|profile|summary|experience|skills|education|objective|简历|个人信息/i;

/**
 * The person's name on a line, if the line is one: short, letters only once dates are taken off (a name line
 * often carries an update date, "Mai Tran 2026-10-15"), and not a labelled field, a heading or a sentence.
 */
export function nameFromLine(line: string): string | null {
  if (line.includes('@') || FIELD_LINE.test(line)) return null;
  const name = line.replace(DATE, ' ').split(/\s*[|·•]\s*/)[0].replace(/[\s,，.。-]+$/, '').replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60 || /\d/.test(name) || HEADING.test(name)) return null;
  if (name.split(' ').length > 5) return null;
  return name;
}

/** The place in a location line: "Based in Ho Chi Minh City, Vietnam." gives "Ho Chi Minh City, Vietnam". */
export function locationFromLine(line: string): string {
  const labelled = line.match(/(?:location|based in|address|city|居住地|所在地|现居)\s*[:：-]?\s*(.+)/i);
  return (labelled ? labelled[1] : line).replace(/[.。;；]+\s*$/, '').split(/[.。;；]\s/)[0].trim().slice(0, 200);
}

const AVAILABILITY = /^(availability|available from|notice period|start date|到岗时间|到岗|可到岗|入职时间)\s*[:：]/i;
const CERTIFICATION = /^(certifications?|certificates?|licen[cs]es?|证书|资格证书|职业资格)\s*[:：]/i;

/** The value after a "Label:" on a line. */
function labelledValue(line: string): string {
  return line.replace(/^[^:：]*[:：]\s*/, '').replace(/[.。;；]+\s*$/, '').trim().slice(0, 200);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
