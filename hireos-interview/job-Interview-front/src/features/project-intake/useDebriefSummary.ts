import { useEffect, useState } from 'react';
import { api, type DebriefSummary } from './api';

/** GET /tasks/:id/debrief, read once — the per-card evidence roll-up (latest human score per
 * confirmed capability card) that Overview and the Brief's evidence-gap panel summarize. */
export function useDebriefSummary(taskId: string | null) {
  const [summary, setSummary] = useState<DebriefSummary | null>(null);
  useEffect(() => {
    if (!taskId) { setSummary(null); return; }
    let active = true;
    api<DebriefSummary>(`/tasks/${taskId}/debrief`).then((s) => { if (active) setSummary(s); }).catch(() => { if (active) setSummary(null); });
    return () => { active = false; };
  }, [taskId]);
  return summary;
}
