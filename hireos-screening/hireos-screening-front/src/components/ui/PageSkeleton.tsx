import { useStore } from "../../store/StoreContext";

/**
 * Loading state for detail pages (issue #23): a title bar and a few grey rows instead of a blank
 * content area, so a slow request doesn't look like a broken page.
 */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  const { t } = useStore();
  return (
    <div className="page-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">{t("Loading…")}</span>
      <div className="sk-line sk-title" />
      <div className="sk-line sk-subtitle" />
      <div className="card card-pad sk-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="sk-line" style={{ width: `${92 - i * 11}%` }} />
        ))}
      </div>
    </div>
  );
}
