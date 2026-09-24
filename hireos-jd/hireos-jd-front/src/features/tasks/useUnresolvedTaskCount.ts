import { useStore } from "../../store/StoreContext";

/** Port of the prototype's `unresolvedTaskCount()` — drives the nav badge and topbar dot. */
export function useUnresolvedTaskCount(): number {
  const { state } = useStore();
  return state.tasks.filter(
    (t) => t.assignee === state.currentUserId && ["open", "in_progress", "waiting"].includes(t.status),
  ).length;
}
