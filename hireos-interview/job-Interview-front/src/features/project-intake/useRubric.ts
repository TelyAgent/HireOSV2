import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiError, type CardInput, type RubricState } from "./api";

const POLL_MS = 3000;

/**
 * Loads the real Requirements & Rubric state for a Job (JD-level, shared by every
 * candidate task under it) and exposes the actions that drive it: generate, edit the
 * current draft, confirm, and start a new version. Polls while a generation is in
 * flight, same pattern the Project Intake plan calls for around ParseJob status.
 */
export function useRubric(jobId: string | null) {
  const [state, setState] = useState<RubricState | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState("");
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(() => {
    if (!jobId) return Promise.resolve(null);
    return api<RubricState>(`/jobs/${jobId}/rubric`)
      .then((s) => { setState(s); setError(""); return s; })
      .catch((e: ApiError) => { setError(e.code); return null; });
  }, [jobId]);

  useEffect(() => {
    if (!jobId) { setState(null); setLoading(false); setError(""); return; }
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [jobId, load]);

  // Re-poll while a generation is queued/parsing; stop as soon as it lands.
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
    await api(`/jobs/${jobId}/capability-cards`, { method: "POST" });
    await load();
  }, [jobId, load]);

  const updateCards = useCallback(async (version: number, cards: CardInput[]) => {
    if (!jobId) return;
    await api(`/jobs/${jobId}/rubric`, { method: "PATCH", body: JSON.stringify({ version, cards }) });
    await load();
  }, [jobId, load]);

  const confirm = useCallback(async (version: number) => {
    if (!jobId) return;
    await api(`/jobs/${jobId}/rubric/confirm`, { method: "POST", body: JSON.stringify({ version }) });
    await load();
  }, [jobId, load]);

  const newVersion = useCallback(async () => {
    if (!jobId) return;
    await api(`/jobs/${jobId}/rubric/new-version`, { method: "POST" });
    await load();
  }, [jobId, load]);

  return { state, loading, error, generate, updateCards, confirm, newVersion, reload: load };
}
