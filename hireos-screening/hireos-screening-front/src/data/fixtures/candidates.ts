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
  skills: string[];
  education: EducationEntry[];
  note?: string;
}
