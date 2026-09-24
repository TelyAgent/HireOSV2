import { useEffect, useState } from 'react';
import { api, type ApiError, type Task } from './api';

/** Loads the real InterviewTask (with its Job + Candidate) backing the current project-flow pages. */
export function useTask(taskId: string | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(!!taskId);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!taskId) { setTask(null); setLoading(false); setError(''); return; }
    let active = true;
    setLoading(true);
    api<Task>(`/tasks/${taskId}`)
      .then((t) => { if (active) { setTask(t); setError(''); } })
      .catch((e: ApiError) => { if (active) setError(e.code); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, reloadKey]);

  return { task, loading, error, reload: () => setReloadKey((n) => n + 1) };
}
