/**
 * "Written Test" task derivation, ported from the prototype's isWrittenTestTask() /
 * writtenTestTasks() / writtenTaskStatus() / writtenTaskJob() / taskCountsFor()
 * (docs/hireos-assessment-prototype.html). My Tasks scopes itself to only the tasks that
 * resolve to a candidate Case — workspace-only tasks (plan drafts, question publishing,
 * interview handoff) are excluded from this whole subsystem.
 */
import { CASES, CORE_APPLICATIONS, CORE_JOBS, INVITATIONS, PROJECT, RESULTS, TASKS, type CoreJob, type Task } from "../data/fixtures";

export type WrittenTaskStatus =
  | "written_completed"
  | "pending_result_review"
  | "waiting_result"
  | "pending_submission"
  | "test_sent"
  | "pending_test";

export function isWrittenTestTask(task: Task): boolean {
  return !!(task.sourceRef && CASES[task.sourceRef]);
}

export function writtenTestTasks(): Task[] {
  return Object.values(TASKS).filter(isWrittenTestTask);
}

export function writtenTaskStatus(task: Task): WrittenTaskStatus {
  const c = task.sourceRef ? CASES[task.sourceRef] : undefined;
  const invitations = c ? Object.values(INVITATIONS).filter((i) => i.caseId === c.id) : [];
  const latestInvite = invitations[invitations.length - 1];
  const result = c ? Object.values(RESULTS).find((r) => r.caseId === c.id) : undefined;
  const submitted =
    !!(latestInvite && latestInvite.status === "submitted") ||
    !!(c && c.rounds.some((r) => r.status === "submitted")) ||
    c?.status === "submitted";

  if (c?.supplementalPending) return "pending_submission";
  if (task.status === "completed" || (c && ["completed", "released"].includes(c.status))) return "written_completed";
  if (task.type === "evaluation_review" || task.type === "result_release" || (c && ["review_pending", "evaluated"].includes(c.status))) return "pending_result_review";
  if (submitted && !result) return "waiting_result";
  if ((latestInvite && ["accepted", "started"].includes(latestInvite.status)) || (c && ["awaiting_submission", "started"].includes(c.status))) return "pending_submission";
  if ((latestInvite && ["sent", "opened"].includes(latestInvite.status)) || c?.status === "invited") return "test_sent";
  return "pending_test";
}

export function writtenTaskJob(task: Task): CoreJob {
  const c = task.sourceRef ? CASES[task.sourceRef] : undefined;
  const app = c ? CORE_APPLICATIONS[c.applicationId] : undefined;
  const job = (app && CORE_JOBS[app.jobId]) || CORE_JOBS[PROJECT.jobId];
  return job || { id: "written-test", title: "Written Test", workspaceId: "ws_demo" };
}

export function taskCountsFor(userId: string): { open: number; total: number } {
  const all = writtenTestTasks().filter((t) => t.assignee === userId);
  const open = all.filter((t) => ["open", "in_progress", "waiting"].includes(t.status)).length;
  return { open, total: all.length };
}
