import { useStore } from "../store/StoreContext";
import { taskCountsFor } from "../utils/writtenTasks";

/** "My open tasks" — unique task_id assigned to the current user with status
 * open/in_progress/waiting, scoped to written-test tasks (mirrors the prototype's
 * taskCountsFor(), which now filters through writtenTestTasks() rather than all tasks). */
export function useOpenTaskCount(): number {
  const { state } = useStore();
  return taskCountsFor(state.currentUser).open;
}
