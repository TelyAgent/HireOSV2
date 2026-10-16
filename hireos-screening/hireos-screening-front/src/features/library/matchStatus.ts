/** F04 FR-5: the matching state, with its reason on hover. Linked roles have their own column (#174). */
export const MATCH_STATUS_BADGE: Record<string, { tone: "success" | "info" | "neutral" | "danger" | "warning" | "outline"; label: string }> = {
  not_started: { tone: "outline", label: "Not matched yet" },
  running: { tone: "info", label: "Checking…" },
  recommendations: { tone: "info", label: "Has recommendations" },
  recommendations_handled: { tone: "neutral", label: "Recommendations handled" },
  no_match: { tone: "neutral", label: "No matching roles" },
  no_open_jobs: { tone: "neutral", label: "No open roles" },
  insufficient_data: { tone: "warning", label: "Not enough information" },
  failed: { tone: "danger", label: "Matching failed" },
};
