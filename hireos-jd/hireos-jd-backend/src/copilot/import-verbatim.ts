import type { JdFields } from './types';

const LISTS = ['responsibilities', 'mustHave', 'niceToHave', 'expectedOutcomes', 'successCriteria'] as const;
const PROSE = ['roleSummary', 'businessProblem'] as const;
const normalize = (text: string) => text.normalize('NFC').replace(/\s+/g, ' ').trim();
const unbullet = (text: string) => text.replace(/^\s*(?:[-*•]|\d+[.)、])\s+/, '');

/** Whole source lines, not substring matches: "CRM required" must not match "No CRM required". */
export function changedImportedFields(fields: JdFields, source: string): string[] {
  const lines = new Set(source.split(/\r?\n/).map(line => normalize(unbullet(line))).filter(Boolean));
  const paragraphs = new Set(source.split(/\n\s*\n/).map(normalize).filter(Boolean));
  return [
    ...LISTS.filter(key => fields[key]?.some(item => !lines.has(normalize(unbullet(item))))),
    ...PROSE.filter(key => fields[key] && !lines.has(normalize(fields[key]!)) && !paragraphs.has(normalize(fields[key]!))),
  ];
}
