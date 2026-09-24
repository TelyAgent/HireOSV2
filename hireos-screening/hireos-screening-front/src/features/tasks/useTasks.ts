import { useCallback, useEffect, useState } from "react";
import { listTasks } from "../../data/api/tasks";
import type { Task } from "../../data/fixtures/tasks";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return listTasks().then((t) => {
      setTasks(t);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tasks, loading, reload };
}
