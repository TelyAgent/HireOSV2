import type { Task } from "../fixtures/tasks";
import type { PersonId } from "../fixtures/people";
import { apiFetch } from "./shared";

export async function listTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks");
}

export async function listMyTasks(userId: PersonId): Promise<Task[]> {
  void userId; // server scopes "mine" to the authenticated session
  return apiFetch<Task[]>("/tasks?scope=mine");
}

export async function listQueueTasks(): Promise<Task[]> {
  return apiFetch<Task[]>("/tasks?scope=queue");
}

export async function getOpenTaskCount(userId: PersonId): Promise<number> {
  const tasks = await listMyTasks(userId);
  return tasks.filter((t) => t.status === "open" || t.status === "in_progress" || t.status === "waiting").length;
}

/** Looks up the open/in-progress task tied to an application (e.g. its
 * "screening_review" task) without the caller needing to know the task id --
 * used to claim it the moment someone starts working the decision. */
export async function findTaskForApplication(applicationId: string): Promise<Task | null> {
  const tasks = await apiFetch<Task[]>(`/tasks?applicationId=${encodeURIComponent(applicationId)}`);
  return tasks[0] || null;
}

export async function claimTask(taskId: string, userId: PersonId): Promise<Task> {
  void userId; // server derives the claimant from the authenticated session
  return apiFetch<Task>(`/tasks/${taskId}/claim`, { method: "POST" });
}

export async function deferTask(taskId: string, reason: string, resumeInDays: number): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}/defer`, { method: "POST", body: JSON.stringify({ reason, resumeInDays }) });
}

export async function completeTask(taskId: string): Promise<Task> {
  return apiFetch<Task>(`/tasks/${taskId}/complete`, { method: "POST" });
}
