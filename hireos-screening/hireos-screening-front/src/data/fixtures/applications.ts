import { daysAgo } from "../../lib/daysAgo";
import type { PersonId } from "./people";

export type ScreeningStatus = "not_started" | "review_pending" | "decided";

export interface Application {
  id: string;
  candidateId: string;
  jobId: string;
  cycleId: string;
  status: "active";
  screeningStatus: ScreeningStatus;
  assessmentStatus?: "not_administered" | "completed";
  origin: "sourced" | "applied";
  linkedAt: string;
  linkedBy: PersonId;
  linkReason: string;
}

export const APPLICATIONS: Application[] = [
  { id: "app-alex-a", candidateId: "cand-alex", jobId: "job-a", cycleId: "cycle-1", status: "active", screeningStatus: "review_pending", origin: "sourced", linkedAt: daysAgo(19), linkedBy: "daniel", linkReason: "Strong technical match on core requirements; proceeding to full screening." },
  { id: "app-jordan-a", candidateId: "cand-jordan", jobId: "job-a", cycleId: "cycle-1", status: "active", screeningStatus: "review_pending", origin: "sourced", linkedAt: daysAgo(15), linkedBy: "emma", linkReason: "0→1 ownership evidence is directly relevant to this role." },
  { id: "app-casey-a", candidateId: "cand-casey", jobId: "job-a", cycleId: "cycle-1", status: "active", screeningStatus: "review_pending", origin: "applied", linkedAt: daysAgo(13), linkedBy: "daniel", linkReason: "Communication strength worth a closer look despite technical unknowns." },
  { id: "app-riley-a", candidateId: "cand-riley", jobId: "job-a", cycleId: "cycle-1", status: "active", screeningStatus: "review_pending", origin: "sourced", linkedAt: daysAgo(6), linkedBy: "emma", linkReason: "Consistent backend track record; adding to the active shortlist." },
  { id: "app-morganb-a", candidateId: "cand-morganb", jobId: "job-a", cycleId: "cycle-1", status: "active", screeningStatus: "decided", origin: "applied", linkedAt: daysAgo(9), linkedBy: "emma", linkReason: "Applied directly; reviewing against core requirements." },
];
