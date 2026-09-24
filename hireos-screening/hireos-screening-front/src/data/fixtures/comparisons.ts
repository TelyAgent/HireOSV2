import { daysAgo } from "../../lib/daysAgo";
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

export const COMPARISONS: Record<string, ComparisonSet> = {
  "cmp-job-a": {
    id: "cmp-job-a",
    jobId: "job-a",
    purpose: "Shortlist review — Senior Backend Engineer",
    memberIds: ["app-alex-a", "app-jordan-a", "app-casey-a", "app-riley-a"],
    owner: "daniel",
    collaborators: ["emma"],
    snapshots: [
      { id: "cmp-snap-1", version: 1, generatedAt: daysAgo(3), mode: "same_stage", freshness: "stale", note: "Initial shortlist snapshot, before Alex Morgan’s resume update." },
      {
        id: "cmp-snap-2",
        version: 2,
        generatedAt: daysAgo(1),
        mode: "current_summary",
        freshness: "current",
        note: "Refreshed after Alex Morgan’s updated resume and Riley Thompson joining the shortlist.",
        changesSinceLast: [
          "Alex Morgan: new evidence added for ownership of the latency-reduction project (resume v2).",
          "Riley Thompson added to the shortlist.",
        ],
      },
    ],
    annotations: [
      { id: "ann-1", author: "daniel", targetId: "app-jordan-a", body: "0→1 story is the strongest I’ve seen this cycle — want to validate technical depth in the assessment.", createdAt: daysAgo(1) },
    ],
  },
};
