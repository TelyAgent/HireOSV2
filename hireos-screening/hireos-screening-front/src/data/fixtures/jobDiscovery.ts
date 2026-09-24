import { daysAgo, hoursAgo } from "../../lib/daysAgo";

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

export const JOB_DISCOVERY: Record<string, JobDiscoveryRun> = {
  "cand-alex": { status: "recommendations_ready", lastRunAt: daysAgo(2), jobsScanned: 3 },
  "cand-am2": { status: "no_match", lastRunAt: daysAgo(11), jobsScanned: 3, reason: "No open role currently matches this profile’s experience area (Finance)." },
  "cand-jordan": { status: "recommendations_ready", lastRunAt: daysAgo(1), jobsScanned: 3 },
  "cand-casey": { status: "recommendations_ready", lastRunAt: daysAgo(3), jobsScanned: 3 },
  "cand-riley": { status: "recommendations_ready", lastRunAt: daysAgo(6), jobsScanned: 3 },
  "cand-morganb": { status: "recommendations_ready", lastRunAt: daysAgo(9), jobsScanned: 3 },
  "cand-taylor": { status: "no_match", lastRunAt: daysAgo(8), jobsScanned: 3, reason: "No open role in the current job set matches this profile’s experience area (Frontend / Product) yet." },
  "cand-priya": { status: "recommendations_ready", lastRunAt: daysAgo(2), jobsScanned: 3 },
  "cand-morgane": { status: "not_started", lastRunAt: null, jobsScanned: 0 },
  "cand-samo": { status: "no_open_jobs", lastRunAt: daysAgo(52), jobsScanned: 5, reason: "No open role in the current job set matches this profile’s experience area (Data Science) yet." },
  "cand-jamier": { status: "no_open_jobs", lastRunAt: daysAgo(8), jobsScanned: 6, reason: "The only Infrastructure/SRE role in the job set is currently paused." },
  "cand-devonp": { status: "recommendations_ready", lastRunAt: daysAgo(2), jobsScanned: 6 },
  "cand-avag": { status: "recommendations_ready", lastRunAt: daysAgo(3), jobsScanned: 6 },
  "cand-leom": { status: "recommendations_ready", lastRunAt: daysAgo(3), jobsScanned: 6 },
  "cand-quinnf": { status: "no_match", lastRunAt: daysAgo(60), jobsScanned: 3, reason: "No open role currently matches this profile’s experience area (Design)." },
  "cand-harpers": { status: "running", lastRunAt: hoursAgo(3), jobsScanned: 0 },
  "cand-noahb": { status: "failed", lastRunAt: daysAgo(20), jobsScanned: 0, reason: "The last matching run did not complete due to a transient error." },
};
