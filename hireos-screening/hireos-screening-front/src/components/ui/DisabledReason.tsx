import type { ReactNode } from "react";

/**
 * Why a control is disabled, always visible under it (issue #23) — a `title` tooltip needs a hover
 * and never shows on touch screens. Wrap the button and pass the reason (or nothing when enabled).
 */
export function WithDisabledReason({ reason, children, align = "end" }: { reason?: string | null; children: ReactNode; align?: "start" | "end" }) {
  return (
    <span className={`with-disabled-reason align-${align}`}>
      {children}
      {reason ? (
        <span className="disabled-reason" role="status">
          {reason}
        </span>
      ) : null}
    </span>
  );
}
