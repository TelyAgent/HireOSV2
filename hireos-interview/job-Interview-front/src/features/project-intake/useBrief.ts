import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiError, type BriefState } from "./api";

const POLL_MS = 3000;

/**
 * Loads the real Interview Brief question state for a Job — one STAR set per confirmed
 * capability card — and exposes `generate`. Polls while a generation is in flight, same
 * pattern as useRubric.
 */
export function useBrief(jobId: string | null) {
  const [state, setState] = useState<BriefState | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!jobId) return Promise.resolve(null);
    return api<BriefState>(`/jobs/${jobId}/brief-questions`)
      .then((s) => { setState(s); setError(""); return s; })
      .catch((e: ApiError) => { setError(e.code); return null; });
  }, [jobId]);

  useEffect(() => {
    if (!jobId) { setState(null); setLoading(false); setError(""); return; }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [jobId, load]);

  useEffect(() => {
    if (pollTimer.current) { clearTimeout(pollTimer.current); pollTimer.current = null; }
    const status = state?.generation?.status;
    if (status === "queued" || status === "parsing") {
      pollTimer.current = setTimeout(load, POLL_MS);
    }
    return () => { if (pollTimer.current) clearTimeout(pollTimer.current); };
  }, [state, load]);

  const generate = useCallback(async () => {
    if (!jobId) return;
    await api(`/jobs/${jobId}/brief-questions`, { method: "POST" });
    await load();
  }, [jobId, load]);

  return { state, loading, error, generate, reload: load };
}
