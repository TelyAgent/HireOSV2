import { TASKS } from "../data/fixtures";
import { useStore } from "../store/StoreContext";

/** "My open tasks" — unique task_id assigned to the current user with status
 * open/in_progress/waiting (mirrors the prototype's taskCountsFor()). */
export function useOpenTaskCount(): number {
  const { state } = useStore();
  return Object.values(TASKS).filter(
    (task) => task.assignee === state.currentUser && (task.status === "open" || task.status === "in_progress" || task.status === "waiting"),
  ).length;
}
