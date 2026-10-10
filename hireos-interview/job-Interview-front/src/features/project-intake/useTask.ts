import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type ApiError, type Task } from './api';
import type { Screen } from '../../store/types';

/** Loads the real InterviewTask (with its Job + Candidate) backing the current project-flow pages. */
export function useTask(taskId: string | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(!!taskId);
  const [error, setError] = useState('');
  const current = useRef(taskId);
  current.current = taskId;

  // Resolves once the fresh task is in state, so a caller can await it before navigating —
  // flow gating reads `task.stages`, and must not see the pre-action snapshot.
  const reload = useCallback(async () => {
    if (!taskId) { setTask(null); setLoading(false); setError(''); return null; }
    setLoading(true);
    try {
      const t = await api<Task>(`/tasks/${taskId}`);
      if (current.current === taskId) { setTask(t); setError(''); }
      return t;
    } catch (e) {
      if (current.current === taskId) setError((e as ApiError).code);
      return null;
    } finally {
      if (current.current === taskId) setLoading(false);
    }
  }, [taskId]);

  // Drop the previous task's data on a task switch so its stages never gate the new one.
  useEffect(() => { setTask(null); void reload(); }, [reload]);

  return { task, loading, error, reload };
}

// ProjectShell's task, shared with the flow pages so an action that finishes a stage can
// refresh the nav's copy (and its stage locks) before moving on to the next screen.
// `advance` is every page's "Continue to …": refetch, then move on only if that stage is
// now unlocked (otherwise it says why). `isDone` lets a page drop its own step's actions
// (confirm / continue) once that step is finished — the nav tabs take over from there.
export const ProjectTaskContext = createContext<{
  task: Task | null; reload: () => Promise<Task | null>; advance: (screen: Screen) => Promise<boolean>;
  isDone: (stage: Screen) => boolean;
}>({ task: null, reload: async () => null, advance: async () => false, isDone: () => false });
export const useProjectTask = () => useContext(ProjectTaskContext);
