import { daysAgo, daysFromNow, hoursAgo } from "../../lib/daysAgo";
import type { PersonId } from "./people";

export type TaskType =
  | "duplicate_review"
  | "link_confirmation"
  | "screening_review"
  | "next_step"
  | "comparison_review"
  | "delivery_exception"
  | "ownership_assignment";
export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "open" | "in_progress" | "waiting" | "completed" | "cancelled";

export interface Task {
  id: string;
  type: TaskType;
  title: string;
  subjectLabel: string;
  module: string;
  assignee: PersonId | null;
  queue?: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  dueAt?: string;
  completedAt?: string;
  waitingReason?: string;
  resumeAt?: string;
  needsRefresh?: boolean;
  createdOrFollowed?: boolean;
  linkRoute: string;
  applicationId?: string;
  candidateId?: string;
  jobId?: string;
}

export const TASKS: Task[] = [
  { id: "task-1", type: "duplicate_review", title: "Possible duplicate candidate: Alex Morgan", subjectLabel: "Uploaded file vs. existing candidate", module: "Resume Library", assignee: "emma", priority: "high", status: "open", createdAt: hoursAgo(20), dueAt: daysFromNow(0, 18), linkRoute: "/duplicates/dup-am-identity", candidateId: "cand-am2" },
  { id: "task-2", type: "duplicate_review", title: "New resume version available: Alex Morgan", subjectLabel: "alex_morgan_resume_v2.pdf", module: "Resume Library", assignee: null, queue: "Resume Library queue", priority: "normal", status: "open", createdAt: daysAgo(2), linkRoute: "/duplicates/dup-am-version", candidateId: "cand-alex" },
  { id: "task-3", type: "link_confirmation", title: "Confirm job link: Alex Morgan → Engineering Lead", subjectLabel: "AI recommendation, 71% confidence", module: "Resume Library", assignee: "daniel", priority: "normal", status: "open", createdAt: daysAgo(2), linkRoute: "/candidates/cand-alex/jobs", candidateId: "cand-alex", jobId: "job-b" },
  { id: "task-4", type: "link_confirmation", title: "Confirm job link: Jordan Lee → Engineering Lead", subjectLabel: "AI recommendation, 58% confidence", module: "Resume Library", assignee: "emma", priority: "normal", status: "open", createdAt: daysAgo(1), linkRoute: "/candidates/cand-jordan/jobs", candidateId: "cand-jordan", jobId: "job-b" },
  { id: "task-5", type: "link_confirmation", title: "Confirm job link: Jordan Lee → Data Platform Engineer", subjectLabel: "Role closed since this recommendation was generated", module: "Resume Library", assignee: "emma", priority: "low", status: "open", needsRefresh: true, createdAt: daysAgo(9), linkRoute: "/candidates/cand-jordan/jobs", candidateId: "cand-jordan", jobId: "job-c" },
  { id: "task-6", type: "screening_review", title: "Review screening: Casey Chen — Senior Backend Engineer", subjectLabel: "Insufficient evidence — needs verification", module: "Screening", assignee: "daniel", priority: "high", status: "open", createdAt: daysAgo(3), linkRoute: "/applications/app-casey-a", candidateId: "cand-casey", jobId: "job-a" },
  { id: "task-7", type: "next_step", title: "Choose next step: Riley Thompson — Senior Backend Engineer", subjectLabel: "Linked, screening complete, no next step chosen yet", module: "Screening", assignee: "emma", priority: "normal", status: "open", createdAt: daysAgo(1), linkRoute: "/applications/app-riley-a/decision", candidateId: "cand-riley", jobId: "job-a" },
  { id: "task-8", type: "next_step", title: "Await verification: Morgan Blake — work authorization", subjectLabel: "Waiting on candidate confirmation", module: "Screening", assignee: "emma", priority: "low", status: "waiting", waitingReason: "Awaiting candidate confirmation of sponsorship situation via recruiter follow-up.", resumeAt: daysFromNow(3), createdAt: daysAgo(8), linkRoute: "/applications/app-morganb-a", candidateId: "cand-morganb", jobId: "job-a" },
  { id: "task-9", type: "comparison_review", title: "Review comparison: Senior Backend Engineer shortlist (4 candidates)", subjectLabel: "Snapshot v2, refreshed 1 day ago", module: "Comparisons", assignee: "daniel", priority: "low", status: "open", createdAt: daysAgo(1), linkRoute: "/comparisons/cmp-job-a", jobId: "job-a", createdOrFollowed: true },
  { id: "task-10", type: "delivery_exception", title: "Delivery bounced: Interview package for Drew Sato", subjectLabel: "Email bounced — mailbox not found", module: "Delivery", assignee: "emma", priority: "urgent", status: "open", createdAt: daysAgo(2), dueAt: daysAgo(1), linkRoute: "/deliveries/deliv-hist-2" },
  { id: "task-11", type: "duplicate_review", title: "Confirmed different person: Alex Morgan (Finance) vs. Alex Morgan (Backend)", subjectLabel: "Resolved during intake review", module: "Resume Library", assignee: "emma", priority: "normal", status: "completed", createdAt: daysAgo(11), completedAt: daysAgo(11), linkRoute: "/candidates/cand-am2", candidateId: "cand-am2" },
  { id: "task-12", type: "ownership_assignment", title: "New library entry needs an owner: Priya Shah", subjectLabel: "Imported via API (demo ingestion), unassigned", module: "Resume Library", assignee: null, queue: "Resume Library queue", priority: "normal", status: "open", createdAt: daysAgo(2), linkRoute: "/candidates/cand-priya", candidateId: "cand-priya" },
];
