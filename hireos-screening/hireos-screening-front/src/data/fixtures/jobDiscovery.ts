export type JobDiscoveryStatus =
  | "not_started"
  | "running"
  | "recommendations_ready"
  | "no_match"
  | "no_open_jobs"
  | "insufficient_data"
  | "failed";

export interface JobDiscoveryRun {
  status: JobDiscoveryStatus;
  lastRunAt: string | null;
  jobsScanned: number;
  reason?: string;
}
