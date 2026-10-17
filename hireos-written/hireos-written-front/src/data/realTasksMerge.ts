/**
 * Merges real tasks from hireos-written-backend into the existing fixture module objects
 * (CASES/CORE_CANDIDATES/CORE_JOBS/CORE_APPLICATIONS/TASKS), the same "merge real data into the
 * fixture dictionaries in place" pattern hireos-jd-front uses for its Job Library — every existing
 * helper (isWrittenTestTask, writtenTaskStatus, writtenTaskJob, candidateOf, ...) keeps working
 * unchanged for both fixture and real entries, since real ones just become more keys in the same dicts.
 *
 * The backend's Case/Task model is intentionally much thinner than the prototype's fixture shape
 * (single round, no plan items, no ownership yet) — synthesized fields below (rounds, ownership,
 * applicationId) are the minimum needed to satisfy the existing TS interfaces and let PlanPage render
 * without crashing; they don't represent real backend concepts yet.
 */
import {
  CASES, CORE_APPLICATIONS, CORE_CANDIDATES, CORE_JOBS, TASKS,
  type Case, type CoreApplication, type CoreCandidate, type CoreJob, type Task,
} from "./fixtures";
import { listRealWrittenTasks, type RealWrittenTask } from "./writtenApi";

function toCandidate(t: RealWrittenTask): CoreCandidate {
  return { id: t.candidateId, name: t.candidateName, email: t.candidateEmail ?? "", userId: `user_${t.candidateId}`, profileVersion: "v1" };
}

function toJob(t: RealWrittenTask): CoreJob {
  return { id: t.jobId, title: t.jobTitle, workspaceId: "ws_demo" };
}

function applicationIdFor(caseId: string): string {
  return `application_${caseId}`;
}

function toApplication(t: RealWrittenTask): CoreApplication {
  return { id: applicationIdFor(t.caseId), candidateId: t.candidateId, jobId: t.jobId, cycleId: `cycle_${t.jobId}`, status: "active" };
}

function toCase(t: RealWrittenTask): Case {
  return {
    id: t.caseId,
    candidateId: t.candidateId,
    applicationId: applicationIdFor(t.caseId),
    label: `${t.candidateName} — ${t.jobTitle}`,
    planItems: [],
    status: t.caseStatus,
    closeReason: t.closeReason,
    closedAt: t.closedAt,
    closeDecision: t.closeDecision ?? null,
    handedOffAt: t.handedOffAt,
    interviewTaskId: t.interviewTaskId,
    ownership: { hrOwner: null, hiringManager: null, reviewAssignee: null },
    roundMode: "single",
    rounds: [{ id: `round_${t.caseId}_1`, position: 1, title: "Round 1", planItemIds: [], releaseCondition: "manual", deadlineAt: null, status: "planned" }],
  };
}

function toTask(t: RealWrittenTask): Task {
  return { id: t.id, title: t.title, type: t.type, assignee: t.assignee, status: t.status, dueAt: t.dueAt ?? "", createdAt: t.createdAt, link: `/cases/${t.caseId}/plan`, sourceRef: t.caseId };
}

function merge(tasks: RealWrittenTask[]) {
  for (const t of tasks) {
    CORE_CANDIDATES[t.candidateId] = toCandidate(t);
    CORE_JOBS[t.jobId] = toJob(t);
    CORE_APPLICATIONS[applicationIdFor(t.caseId)] = toApplication(t);
    CASES[t.caseId] = toCase(t);
    TASKS[t.id] = toTask(t);
  }
}

// The task list comes a page at a time (#412): where the next page starts, or null once all are loaded.
let nextCursor: string | null = null;

/** The newest page of tasks; pages loaded before stay merged. */
export async function loadRealWrittenTasksIntoFixtures(): Promise<void> {
  const page = await listRealWrittenTasks();
  merge(page.items);
  nextCursor = page.nextCursor;
}

export function hasMoreRealWrittenTasks(): boolean {
  return nextCursor !== null;
}

export async function loadMoreRealWrittenTasks(): Promise<void> {
  if (!nextCursor) return;
  const page = await listRealWrittenTasks(nextCursor);
  merge(page.items);
  nextCursor = page.nextCursor;
}
