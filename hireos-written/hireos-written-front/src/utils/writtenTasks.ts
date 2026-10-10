/**
 * "Written Test" task derivation, ported from the prototype's isWrittenTestTask() /
 * writtenTestTasks() / writtenTaskStatus() / writtenTaskJob() / taskCountsFor()
 * (docs/hireos-assessment-prototype.html). My Tasks scopes itself to only the tasks that
 * resolve to a candidate Case — workspace-only tasks (plan drafts, question publishing,
 * interview handoff) are excluded from this whole subsystem.
 */
import { CASES, CORE_APPLICATIONS, CORE_JOBS, INVITATIONS, PROJECT, RESULTS, TASKS, type CoreJob, type Task } from "../data/fixtures";

export type WrittenTaskStatus =
  | "handed_off"
  | "closed"
  | "on_hold"
  | "pending_release"
  | "awaiting_next_step"
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
  // Real cases: hireos-written-backend persists Case.status at every transition (see its
  // CaseLifecycleService) -- that is authoritative. The derivation below is the fallback for
  // fixture-only demo cases.
  const persisted = c ? writtenStatusFromCase(c.status) : null;
  if (persisted) return persisted;
  if (task.status === "completed" || (c && ["completed", "released"].includes(c.status))) return "awaiting_next_step";
  if (task.type === "evaluation_review" || task.type === "result_release" || (c && ["review_pending", "evaluated"].includes(c.status))) return "pending_result_review";
  if (submitted && !result) return "waiting_result";
  if ((latestInvite && ["accepted", "started"].includes(latestInvite.status)) || (c && ["awaiting_submission", "started"].includes(c.status))) return "pending_submission";
  if ((latestInvite && ["sent", "opened"].includes(latestInvite.status)) || c?.status === "invited") return "test_sent";
  return "pending_test";
}

/**
 * Case.status (persisted by hireos-written-backend's CaseLifecycleService) -> the status shown in
 * My Tasks and on the candidate detail page. All of a case's questions go out in one invitation, so
 * there is exactly one status per case. Returns null for a status outside that state machine.
 */
const CASE_STATUS_TO_WRITTEN: Record<string, WrittenTaskStatus> = {
  linked: "pending_test",
  invited: "test_sent",
  awaiting_submission: "pending_submission",
  review_pending: "pending_result_review",
  finalized: "pending_release",
  // Published, but not the end: HR still has to hand off to Interview, hold, or close testing.
  released: "awaiting_next_step",
  handed_off: "handed_off",
  on_hold: "on_hold",
  closed: "closed",
};

export function writtenStatusFromCase(caseStatus: string | undefined): WrittenTaskStatus | null {
  return (caseStatus && CASE_STATUS_TO_WRITTEN[caseStatus]) || null;
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
