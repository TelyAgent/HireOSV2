import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type CandidateClaims = {
  taskId: string; rubricVersionId: string | null; materialId: string | null; materialName: string | null;
  status: string; cards: { cardId: string; claims: { segmentId: string; quote: string }[] }[];
};

export function useCandidateClaims(taskId: string | null, rubricId: string | null, version: number | undefined) {
  const scope = JSON.stringify([taskId, rubricId, version]);
  const [snapshot, setSnapshot] = useState<{ scope: string; data: CandidateClaims } | null>(null);
  const data = snapshot?.scope === scope ? snapshot.data : null;
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    setSnapshot(null); setError(false);
    if (!taskId || !rubricId) return;
    const load = async () => {
      try {
        const response = await api<CandidateClaims>(`/tasks/${taskId}/rubric-claims`);
        if (!active) return;
        setSnapshot({ scope, data: response }); setError(false);
        if (['queued', 'parsing'].includes(response.status)) timer = setTimeout(load, 3000);
      } catch { if (active) setError(true); }
    };
    void load();
    return () => { active = false; clearTimeout(timer); };
  }, [taskId, rubricId, scope, retry]);
  const generate = useCallback(async () => {
    if (!taskId || busy) return;
    setBusy(true);
    try { await api(`/tasks/${taskId}/rubric-claims`, { method: 'POST' }); setRetry(n => n + 1); }
    catch { setError(true); }
    finally { setBusy(false); }
  }, [taskId, busy]);
  return { data: data?.taskId === taskId && data.rubricVersionId === rubricId ? data : null, error, busy, generate };
}
