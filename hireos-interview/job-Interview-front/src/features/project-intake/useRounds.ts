import { useEffect, useState } from 'react';
import { api, type Round } from './api';

/** Loads a task's real interview rounds (full detail — schedule, transcript, review state). */
export function useRounds(taskId: string | null) {
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(!!taskId);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!taskId) { setRounds([]); setLoading(false); return; }
    let active = true;
    setLoading(true);
    api<Round[]>(`/tasks/${taskId}/rounds`)
      .then((value) => { if (active) setRounds(value); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId, reloadKey]);

  return { rounds, loading, reload: () => setReloadKey((n) => n + 1) };
}
