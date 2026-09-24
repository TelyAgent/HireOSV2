import { useEffect, useState } from "react";
import { getOpenTaskCount } from "../../data/api/tasks";
import { useStore } from "../../store/StoreContext";

/** Polls the open-task count for the current demo user, for the sidenav badge. */
export function useOpenTaskCount(): number {
  const { state } = useStore();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getOpenTaskCount(state.currentUser).then((n) => {
      if (!cancelled) setCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [state.currentUser]);

  return count;
}
