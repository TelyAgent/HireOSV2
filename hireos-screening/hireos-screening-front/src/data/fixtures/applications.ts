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
