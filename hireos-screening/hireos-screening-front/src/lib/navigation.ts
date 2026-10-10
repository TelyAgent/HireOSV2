import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Back = one step back through the in-app history, so however deep a flow goes it unwinds
 * the same way it was entered. Only when there is no in-app history (a deep link or a
 * refreshed first page) does it fall back to the page's logical parent.
 */
export function useGoBack(fallback: string) {
  const navigate = useNavigate();
  return useCallback(() => {
    // React Router keeps the position in its own history stack as `idx` on history.state.
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback);
  }, [navigate, fallback]);
}
