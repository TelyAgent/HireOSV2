import type { FieldEvidence, ProfileField } from "../../data/fixtures/candidates";

/**
 * What the "Parsed fields" card shows for each field (#155), worked out from the API payload alone so it can be
 * tested without rendering: label, values, status, what is missing, where each value was found (and which
 * values weren't), or why there is no location. Strings are English keys; the card translates them.
 */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  employment_history: "Work experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
  projects: "Projects",
  compensation_expectation: "Salary expectation",
  availability: "Availability",
};

export const INCOMPLETE_LABELS: Record<string, string> = {
  dates: "dates",
  company: "company",
  title: "title",
  description: "description",
  currency: "currency",
  period: "pay period",
  country: "country",
  city: "city",
  school: "school",
  degree: "degree",
  major: "major",
  to_confirm: "to be confirmed — taken from the file name",
};

export const STATUS: Record<ProfileField["status"], { label: string; badge: string }> = {
  known: { label: "Known", badge: "badge-success" },
  missing: { label: "Not provided", badge: "badge-outline" },
  partial: { label: "Partly read", badge: "badge-warning" },
};

/** "Page 2 · paragraph 4", or "Paragraph 4" for files without pages. */
export function evidenceLabel(e: FieldEvidence, lang: string) {
  if (lang === "zh") return `v${e.resumeVersion} · ${e.page != null ? `第 ${e.page} 页 · ` : ""}第 ${e.paragraph} 段`;
  return `v${e.resumeVersion} · ${e.page != null ? `page ${e.page} · ` : ""}paragraph ${e.paragraph}`;
}

export type ParsedFieldRow = {
  field: string;
  label: string;
  values: string[];
  status: { label: string; badge: string };
  missing: string[];
  correctedByPerson: boolean;
  links: Array<{ label: string; evidence: FieldEvidence }>;
  /** Shown instead of (or after) the links: why a location is missing. */
  notes: Array<{ text: string; values?: string[] }>;
};

export function parsedFieldRows(fields: ProfileField[], lang: string): ParsedFieldRow[] {
  return fields.map((f) => ({
    field: f.field,
    label: PROFILE_FIELD_LABELS[f.field] ?? f.field,
    values: f.values,
    status: STATUS[f.status],
    missing: f.status === "partial" ? f.incomplete.map((i) => INCOMPLETE_LABELS[i] ?? i) : [],
    correctedByPerson: f.source === "correction",
    links: f.evidence.map((e) => ({ label: evidenceLabel(e, lang), evidence: e })),
    notes: [
      ...(f.evidenceUnavailable === "source_unavailable" ? [{ text: "Source text unavailable" }] : []),
      ...(f.evidenceUnavailable === "not_located"
        ? [{ text: f.source === "correction" ? "Entered by a person — not in the source" : "Not found in the source text" }]
        : []),
      ...(f.unlocatedValues?.length ? [{ text: "Not found in the source:", values: f.unlocatedValues }] : []),
    ],
  }));
}
