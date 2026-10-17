import type { PersonId } from "./people";
import type { SnapshotChange } from "../../lib/snapshotChanges";

export type ComparisonMode = "same_stage" | "current_summary" | "changes_since_last";
export type ComparisonFreshness = "current" | "stale";

export interface ComparisonSnapshot {
  id: string;
  version: number;
  generatedAt: string;
  mode: ComparisonMode;
  freshness: ComparisonFreshness;
  note: string;
  /** Null on a set's first snapshot; English sentences on snapshots from before #206. */
  changesSinceLast?: Array<SnapshotChange | string> | null;
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
  /** Members whose concerns, verification, decision or score changed after the latest snapshot (#27). */
  changedSinceSnapshot?: string[];
}
