import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiError, type BriefState } from "./api";

const POLL_MS = 3000;

/**
 * Loads the real Interview Brief question state for a Job — one STAR set per confirmed
 * capability card — and exposes `generate`. Polls while a generation is in flight, same
 * pattern as useRubric.
 */
export function useBrief(jobId: string | null, previewKey?: string) {
  const endpoint = previewKey === undefined ? 'brief-questions' : 'rubric-questions';
  const scope = JSON.stringify([jobId, endpoint, previewKey]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const [loadedScope, setLoadedScope] = useState('');
  const [state, setState] = useState<BriefState | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!jobId) return Promise.resolve(null);
    return api<BriefState>(`/jobs/${jobId}/${endpoint}`)
      .then((s) => { if (activeScope.current !== scope) return null; setState(s); setLoadedScope(scope); setError(""); return s; })
      .catch((e: ApiError) => { if (activeScope.current === scope) setError(e.code); return null; });
  }, [jobId, endpoint, scope]);

  useEffect(() => {
    activeScope.current = scope;
    if (!jobId) { setState(null); setLoading(false); setError(""); return; }
    setLoading(true);
    setError('');
    load().finally(() => { if (activeScope.current === scope) setLoading(false); });
    return () => { activeScope.current = ''; };
  }, [jobId, load, scope]);

  useEffect(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    const status = loadedScope === scope ? state?.generation?.status : null;
    if (status === "queued" || status === "parsing") {
      pollTimer.current = setTimeout(load, POLL_MS);
    }
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [state, load, loadedScope, scope]);

  const generate = useCallback(async () => {
    if (!jobId) return;
    await api(`/jobs/${jobId}/${endpoint}`, { method: "POST" });
    if (activeScope.current !== scope) return;
    await load();
  }, [jobId, load, endpoint, scope]);

  return { state: loadedScope === scope ? state : null, loading, error, generate, reload: load };
}
