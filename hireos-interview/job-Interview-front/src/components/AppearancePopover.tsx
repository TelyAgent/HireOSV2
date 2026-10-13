import { useStore } from "../store/StoreContext";
import { useEffect, useRef } from "react";
import { AppearancePanel } from "../features/settings/AppearancePanel";

export function AppearancePopover() {
  const { t, resetPrefs, toggleAppearance } = useStore();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Close if click is outside both popover and trigger button
        const target = e.target as HTMLElement;
        if (!target.closest("[data-appearance-trigger]")) {
          toggleAppearance();
        }
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => document.removeEventListener("mousedown", handler);
  }, [toggleAppearance]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t.appearance}
      style={{
        position: "fixed",
        top: 96,
        right: 20,
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 14,
        boxShadow: "0 16px 40px rgba(0,0,0,.22)",
        zIndex: 71,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700 }}>{t.appearance}</div>
      <div style={{ marginTop: 12 }}>
        <AppearancePanel />
      </div>

      <button
        onClick={resetPrefs}
        style={{
          marginTop: 15,
          width: "100%",
          height: 32,
          border: "1px solid var(--line)",
          borderRadius: 9,
          background: "var(--surface-2)",
          color: "var(--ink-2)",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        {t.resetDefaults}
      </button>
    </div>
  );
}