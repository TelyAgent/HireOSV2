import { useStore } from "../store/StoreContext";
import { useEffect, useRef } from "react";

export function AppearancePopover() {
  const { state, t, setTheme, setAccent, setTextSize, resetPrefs, toggleAppearance } =
    useStore();
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

  const themes = [
    { k: "light", label: t.light },
    { k: "dark", label: t.dark },
    { k: "deep", label: t.deep },
    { k: "system", label: t.system },
  ] as const;

  const accents = [
    { k: "blue", label: "Blue", hex: "#2563eb" },
    { k: "teal", label: "Teal", hex: "#0d9488" },
    { k: "violet", label: "Violet", hex: "#7c3aed" },
  ] as const;

  const sizes = ["small", "medium", "large"] as const;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t.appearance}
      style={{
        position: "fixed",
        top: 96,
        right: 20,
        width: 280,
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

      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-3)",
          letterSpacing: ".04em",
        }}
      >
        {t.theme}
      </div>
      <div
        style={{
          marginTop: 7,
          display: "grid",
          gridTemplateColumns: "repeat(2,1fr)",
          gap: 7,
        }}
      >
        {themes.map((tk) => {
          const active = state.theme === tk.k;
          return (
            <button
              key={tk.k}
              onClick={() => setTheme(tk.k as any)}
              style={{
                height: 32,
                border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
                borderRadius: 8,
                background: active ? "var(--brand-soft)" : "var(--surface)",
                color: active ? "var(--brand)" : "var(--ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tk.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-3)",
          letterSpacing: ".04em",
        }}
      >
        {t.accentColor}
      </div>
      <div style={{ marginTop: 7, display: "flex", gap: 9 }}>
        {accents.map((a) => {
          const active = state.accent === a.k;
          return (
            <button
              key={a.k}
              aria-label={a.label}
              onClick={() => setAccent(a.k as any)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: a.hex,
                border: `2px solid ${
                  active
                    ? state.theme === "dark" || state.theme === "deep"
                      ? "#fff"
                      : "#111"
                    : "transparent"
                }`,
                cursor: "pointer",
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          fontSize: 11,
          fontWeight: 600,
          color: "var(--ink-3)",
          letterSpacing: ".04em",
        }}
      >
        {t.textSize}
      </div>
      <div
        style={{
          marginTop: 7,
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: 7,
        }}
      >
        {sizes.map((s) => {
          const active = state.textSize === s;
          return (
            <button
              key={s}
              onClick={() => setTextSize(s)}
              style={{
                height: 32,
                border: `1px solid ${active ? "var(--brand)" : "var(--line)"}`,
                borderRadius: 8,
                background: active ? "var(--brand-soft)" : "var(--surface)",
                color: active ? "var(--brand)" : "var(--ink)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t[s]}
            </button>
          );
        })}
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