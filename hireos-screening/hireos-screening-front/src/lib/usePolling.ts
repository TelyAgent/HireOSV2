import { useCallback, useEffect, useRef, useState } from "react";

/** How long background work (matching, screening, parsing) is polled before telling the user (issue #23). */
export const STILL_PROCESSING_AFTER_MS = 90_000;

/**
 * Polls `tick` every `intervalMs` while `active`. After `limitMs` it stops and reports `overdue`
 * instead of silently giving up, so the page can say "still processing" and offer a retry;
 * `retry()` polls for another window.
 */
export function useBoundedPolling(active: boolean, tick: () => void, intervalMs: number, limitMs = STILL_PROCESSING_AFTER_MS) {
  const [overdue, setOverdue] = useState(false);
  const [round, setRound] = useState(0);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!active) {
      setOverdue(false);
      return;
    }
    if (overdue) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > limitMs) {
        window.clearInterval(timer);
        setOverdue(true);
        return;
      }
      tickRef.current();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [active, overdue, round, intervalMs, limitMs]);

  const retry = useCallback(() => {
    setOverdue(false);
    setRound((n) => n + 1);
    tickRef.current();
  }, []);

  return { overdue, retry };
}
