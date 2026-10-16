import type { PersonId } from "./people";

export interface FieldWithStatus<T> {
  value: T;
  status: "known" | "unknown";
}
export interface CompensationExpectation {
  min: number;
  max: number;
  currency: string;
  period: "year" | "month" | "hour";
  basis: "gross" | "net" | "unknown";
  status: "known" | "unknown";
}
export interface EmploymentEntry {
  company: string;
  title: string;
  start: string;
  end: string;
  achievements: string[];
}
export interface EducationEntry {
  statement: string;
  period: string;
}

export interface FieldEvidence {
  resumeVersionId: string;
  resumeVersion: number;
  materialId: string;
  segmentId: string;
  page: number | null;
  paragraph: number;
  quote: string;
}

export interface ProfileField {
  field: string;
  status: "known" | "missing" | "partial";
  values: string[];
  incomplete: string[];
  source: "resume" | "correction" | "record";
  evidence: FieldEvidence[];
  evidenceUnavailable: "source_unavailable" | "not_located" | null;
  /** Values of a list field that couldn't be found in the source while others could. */
  unlocatedValues?: string[];
}

export interface Candidate {
  id: string;
  displayName: string;
  identityStatus: "confirmed" | "provisional";
  contact: {
    email: string;
    phone: string;
    location: FieldWithStatus<string>;
  };
  workAuth: FieldWithStatus<string>;
  tags: string[];
  owner: PersonId;
  createdAt: string;
  lastMatchedAt: string | null;
  retention: string;
  libraryStatus: "available";
  compensationExpectation: CompensationExpectation | null;
  missingFields: string[];
  employment: EmploymentEntry[];
  projects?: Array<{ name: string; description: string }>;
  /** The owner's account id (the library filters by it, #172); absent on fixtures. */
  ownerId?: string;
  /** Each F02 field with its status and source locations (#155); absent on fixtures. */
  profileFields?: ProfileField[];
  /** The profile version shown (#159). */
  profileVersion?: number | null;
  /** Fields a correction needs a reason for: used by a current recommendation or evaluation (#158). */
  correctionReasonRequiredFor?: string[];
  /** Derived from the employment dates, overlaps counted once (#156); absent on fixtures. */
  totalExperience?: { status: "derived"; months: number; years: number } | { status: "unknown" };
  skills: string[];
  education: EducationEntry[];
  note?: string;
}
