import type { PersonId } from "./people";

export type ComparisonMode = "same_stage" | "current_summary" | "changes_since_last";
export type ComparisonFreshness = "current" | "stale";

export interface ComparisonSnapshot {
  id: string;
  version: number;
  generatedAt: string;
  mode: ComparisonMode;
  freshness: ComparisonFreshness;
  note: string;
  changesSinceLast?: string[];
}
export interface ComparisonAnnotation {
  id: string;
  author: PersonId;
  targetId: string;
  body: string;
  createdAt: string;
}
export interface ComparisonSet {
  id: string;
  jobId: string;
  purpose: string;
  memberIds: string[];
  owner: PersonId;
  collaborators: PersonId[];
  snapshots: ComparisonSnapshot[];
  annotations: ComparisonAnnotation[];
}
