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
