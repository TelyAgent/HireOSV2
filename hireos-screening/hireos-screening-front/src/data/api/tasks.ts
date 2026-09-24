import { db, myTasks, queueTasks } from "../db";
import type { Task } from "../fixtures/tasks";
import type { PersonId } from "../fixtures/people";
import { daysFromNow } from "../../lib/daysAgo";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export async function listTasks(): Promise<Task[]> {
  if (isRealApi()) return apiFetch<Task[]>("/tasks");
  await delay();
  return [...db.tasks];
}

export async function listMyTasks(userId: PersonId): Promise<Task[]> {
  if (isRealApi()) return apiFetch<Task[]>("/tasks?scope=mine");
  await delay();
  return myTasks(userId);
}

export async function listQueueTasks(): Promise<Task[]> {
  if (isRealApi()) return apiFetch<Task[]>("/tasks?scope=queue");
  await delay();
  return queueTasks();
}

export async function getOpenTaskCount(userId: PersonId): Promise<number> {
  if (isRealApi()) {
    const tasks = await listMyTasks(userId);
    return tasks.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting").length;
  }
  await delay(80);
  return myTasks(userId).filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting").length;
}

/** Looks up the open/in-progress task tied to an application (e.g. its
 * "screening_review" task) without the caller needing to know the task id --
 * used to claim it the moment someone starts working the decision. */
export async function findTaskForApplication(applicationId: string): Promise<Task | null> {
  if (isRealApi()) {
    const tasks = await apiFetch<Task[]>(`/tasks?applicationId=${encodeURIComponent(applicationId)}`);
    return tasks[0] || null;
  }
  await delay();
  return db.tasks.find((t) => t.applicationId === applicationId) || null;
}

function findTask(id: string): Task {
  const task = db.tasks.find((t) => t.id === id);
  if (!task) throw new ApiError("NOT_FOUND", `Task ${id} not found`);
  return task;
}

export async function claimTask(taskId: string, userId: PersonId): Promise<Task> {
  if (isRealApi()) return apiFetch<Task>(`/tasks/${taskId}/claim`, { method: "POST" });
  await delay();
  const task = findTask(taskId);
  task.assignee = userId;
  task.status = task.status === "waiting" ? task.status : "in_progress";
  task.queue = undefined;
  return task;
}

export async function reassignTask(taskId: string, userId: PersonId): Promise<Task> {
  await delay();
  const task = findTask(taskId);
  task.assignee = userId;
  return task;
}

export async function deferTask(taskId: string, reason: string, resumeInDays: number): Promise<Task> {
  if (isRealApi()) return apiFetch<Task>(`/tasks/${taskId}/defer`, { method: "POST", body: JSON.stringify({ reason, resumeInDays }) });
  await delay();
  const task = findTask(taskId);
  task.status = "waiting";
  task.waitingReason = reason;
  task.resumeAt = daysFromNow(resumeInDays);
  return task;
}

export async function completeTask(taskId: string): Promise<Task> {
  if (isRealApi()) return apiFetch<Task>(`/tasks/${taskId}/complete`, { method: "POST" });
  await delay();
  const task = findTask(taskId);
  task.status = "completed";
  task.completedAt = new Date().toISOString();
  return task;
}
