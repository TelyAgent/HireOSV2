import { useEffect, useLayoutEffect, useState } from "react";
import { useStore } from "../store/StoreContext";
import {
  CloseSvg,
  SunSvg,
} from "./ui/Icons";
import { AppearancePopover } from "./AppearancePopover";

export function TopBar() {
  const { state, t, go, role, set, toggleLang, toggleAppearance } = useStore();
  const langLabel = state.lang === "en" ? "中 / EN" : "EN / 中";

  return (
    <div
      style={{
        height: 56,
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "0 20px 0 0",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          width: 52,
          flex: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "var(--brand)",
            color: "var(--brand-ink)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          H
        </div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
        {t.hireosCommand}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>/</div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{t.interview}</div>

      <div style={{ flex: 1 }} />

      <button
        onClick={toggleLang}
        style={{
          height: 32,
          padding: "0 11px",
          border: "1px solid var(--line)",
          borderRadius: 9,
          background: "var(--surface)",
          cursor: "pointer",
          fontSize: 12.5,
          color: "var(--ink-2)",
          fontWeight: 600,
        }}
      >
        {langLabel}
      </button>
      <div style={{ position: "relative" }}>
        <button
          onClick={toggleAppearance}
          style={{
            height: 32,
            padding: "0 11px",
            border: "1px solid var(--line)",
            borderRadius: 9,
            background: "var(--surface)",
            cursor: "pointer",
            fontSize: 12.5,
            color: "var(--ink-2)",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <SunSvg size={14} />
          {t.appearance}
        </button>
        {state.showAppearance && <AppearancePopover />}
      </div>
      <button
        onClick={() => set({ showCreateModal: true })}
        style={{
          height: 32,
          padding: "0 12px",
          border: "1px solid var(--line-strong)",
          borderRadius: 9,
          background: "var(--surface)",
          color: "var(--ink)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {t.newProject}
      </button>

      <RoleButton role={role} />
    </div>
  );
}

function RoleButton({ role }: { role: { initials: string; name: string; title: string } }) {
  const { cycleRole, state } = useStore();
  return (
    <button
      onClick={cycleRole}
      style={{
        height: 40,
        padding: "0 10px 0 6px",
        border: "1px solid var(--line)",
        borderRadius: 11,
        background: "var(--surface)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: "var(--brand)",
          color: "var(--brand-ink)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        {role.initials}
      </div>
      <div style={{ textAlign: "left" }}>
        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
          {role.name}
        </div>
        <div
          style={{
            fontSize: 10.5,
            color: "var(--ink-3)",
            lineHeight: 1.2,
          }}
        >
          {state.lang === "zh" ? role.title.match(/[\u4e00-\u9fa5]/) ? role.title : (role.title + " (英)") : role.title}
        </div>
      </div>
    </button>
  );
}

/**
 * Same look as the other subsystems' side nav (hireos-written-front / hireos-jd-front): 220px wide
 * with icon + label, a "Workspace" group for Settings, and a collapse toggle pinned to the bottom;
 * collapsed it becomes a 52px icon-only rail with the label in the native tooltip.
 */
export function SideNav() {
  const { state, t, go, set, say } = useStore();
  const collapsed = state.sidenavCollapsed;
  const toggleLabel = collapsed ? t.expandNav : t.collapseNav;

  const navItem = (active: boolean): React.CSSProperties => ({
    width: collapsed ? 40 : "100%",
    height: 40,
    margin: collapsed ? "0 auto 4px" : "0 0 4px",
    padding: collapsed ? 0 : "0 12px",
    border: 0,
    borderRadius: 11,
    background: active ? "var(--brand-soft)" : "transparent",
    color: active ? "var(--brand-strong)" : "var(--ink-2)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "flex-start",
    gap: 12,
    fontSize: 12,
    fontWeight: active ? 700 : 600,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  });
  const icon = (name: string) => (
    <span className="material-symbols-rounded" style={{ fontSize: 20, width: 20, flex: "none" }}>
      {name}
    </span>
  );
  const label = (text: string) => (collapsed ? null : <span>{text}</span>);

  return (
    <div
      role="navigation"
      aria-label={t.primaryNav}
      style={{
        width: collapsed ? 52 : 220,
        flex: "none",
        borderRight: "1px solid var(--line)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        transition: "width .15s ease",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
        <button
          aria-label={t.sideHome}
          title={collapsed ? t.sideHome : undefined}
          onClick={() => go("home")}
          style={navItem(state.screen === "home")}
        >
          {icon("home")}
          {label(t.sideHome)}
        </button>
        {!collapsed && (
          <div
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
              padding: "14px 10px 6px",
              whiteSpace: "nowrap",
            }}
          >
            {t.sideWorkspace}
          </div>
        )}
        <button
          aria-label={t.sideSettings}
          title={collapsed ? t.sideSettings : undefined}
          onClick={() =>
            say(
              state.lang === "zh"
                ? "设置模块不在当前演示范围内。"
                : "Settings module is not part of this demo.",
            )
          }
          style={navItem(false)}
        >
          {icon("tune")}
          {label(t.sideSettings)}
        </button>
      </div>
      <button
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        title={toggleLabel}
        onClick={() => set({ sidenavCollapsed: !collapsed })}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 12,
          height: 44,
          padding: collapsed ? 0 : "0 20px",
          border: 0,
          borderTop: "1px solid var(--line)",
          background: "transparent",
          color: "var(--ink-2)",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
          whiteSpace: "nowrap",
          flex: "none",
        }}
      >
        {icon(collapsed ? "left_panel_open" : "left_panel_close")}
        {label(toggleLabel)}
      </button>
    </div>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const { state } = useStore();

  // Compute root style based on theme + accent
  const effective = state.theme === "system" ? (state.systemDark ? "dark" : "light") : state.theme;
  const dark = effective === "dark" || effective === "deep";
  const deep = effective === "deep";

  const accents = {
    blue: {
      brand: "#2563eb",
      darkBrand: "#93c5fd",
      soft: dark ? "rgba(96,165,250,.18)" : "#dbeafe",
      strong: "#1d4ed8",
      darkStrong: "#1e40af",
      ai: "#7c3aed",
      darkAi: "#c4b5fd",
      aiSoft: dark ? "rgba(167,139,250,.18)" : "#f3e8ff",
    },
    teal: {
      brand: "#0d9488",
      darkBrand: "#5eead4",
      soft: dark ? "rgba(45,212,191,.16)" : "rgba(13,148,136,.12)",
      strong: "#0f766e",
      darkStrong: "#0f766e",
      ai: "#7c3aed",
      darkAi: "#c4b5fd",
      aiSoft: dark ? "rgba(167,139,250,.18)" : "#f3e8ff",
    },
    violet: {
      brand: "#7c3aed",
      darkBrand: "#c4b5fd",
      soft: dark ? "rgba(167,139,250,.18)" : "#ede9fe",
      strong: "#6d28d9",
      darkStrong: "#5b21b6",
      ai: "#0d9488",
      darkAi: "#5eead4",
      aiSoft: dark ? "rgba(45,212,191,.16)" : "#ccfbf1",
    },
  };
  const ac = accents[state.accent];
  const accentHex = dark ? ac.darkBrand : ac.brand;
  const brandSoft = ac.soft;
  const brandStrong = dark ? ac.darkStrong : ac.strong;
  const aiColor = dark ? ac.darkAi : ac.ai;
  const aiSoftColor = ac.aiSoft;

  const baseFontSize =
    state.textSize === "small" ? 12 : state.textSize === "large" ? 15 : 13;

  const mainBg =
    deep
      ? "#0a0f1f"
      : dark
        ? "#0f172a"
        : state.accent === "blue"
          ? "#EEF0F4"
          : state.accent === "violet"
            ? "#F4F4FA"
            : "#eef2f6";

  const rootStyle: React.CSSProperties = {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontSize: baseFontSize,
    lineHeight: 1.35,
    color: "var(--ink)",
    colorScheme: dark ? "dark" : "light",
  } as React.CSSProperties;

  const cssVars: React.CSSProperties = {
    ["--brand" as any]: accentHex,
    ["--brand-ink" as any]: dark ? "#062a2a" : "#ffffff",
    ["--ink" as any]: dark ? "#f8fafc" : "#111827",
    ["--ink-2" as any]: dark ? "#d6deea" : "#4b5563",
    ["--ink-3" as any]: dark ? "#aab8ca" : "#9ca3af",
    ["--line" as any]: dark ? "#334155" : "#e5e7eb",
    ["--line-strong" as any]: dark ? "#475569" : "#d1d5db",
    ["--surface" as any]: deep ? "#16213a" : dark ? "#1e293b" : "#ffffff",
    ["--surface-2" as any]: deep ? "#0b1526" : dark ? "#0f172a" : "#f8fafc",
    ["--surface-3" as any]: deep ? "#1f2d4d" : dark ? "#334155" : "#f1f5f9",
    ["--bg" as any]: deep ? "#0a0f1f" : dark ? "#0f172a" : "#eef2f6",
    ["--scroll-thumb" as any]: dark ? "#475569" : "#d1d5db",
    ["--brand-soft" as any]: brandSoft,
    ["--brand-strong" as any]: brandStrong,
    ["--ok" as any]: dark ? "#6ee7b7" : "#059669",
    ["--ok-soft" as any]: dark ? "rgba(16,185,129,.18)" : "#d1fae5",
    ["--warn" as any]: dark ? "#fcd34d" : "#b45309",
    ["--warn-soft" as any]: dark ? "rgba(245,158,11,.18)" : "#fef3c7",
    ["--bad" as any]: dark ? "#fda4af" : "#dc2626",
    ["--bad-ink" as any]: dark ? "#4c0519" : "#ffffff",
    ["--bad-soft" as any]: dark ? "rgba(244,63,94,.18)" : "#fee2e2",
    ["--ai" as any]: aiColor,
    ["--ai-soft" as any]: aiSoftColor,
  };

  // Mirror CSS variables onto <html> so that antd Modal (which uses a Portal
  // and renders outside the .hireos-root subtree) still inherits the theme
  // tokens (--brand, --surface, --ink, etc.).
  useLayoutEffect(() => {
    const root = document.documentElement;
    for (const [k, v] of Object.entries(cssVars)) {
      if (typeof v === "string") root.style.setProperty(k, v);
    }
    return () => {
      // Clean up only the variables we set, so a later re-mount doesn't pile up.
      for (const k of Object.keys(cssVars)) root.style.removeProperty(k);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    accentHex,
    brandSoft,
    brandStrong,
    aiColor,
    aiSoftColor,
    dark,
    deep,
  ]);

  const isHome = state.screen === "home";
  const isLive = state.screen === "live";
  const isProject = !isHome;

  const mainAreaStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: isLive ? "hidden" : "auto",
    backgroundColor: mainBg,
  };

  return (
    <div
      className="hireos-root"
      data-text-size={state.textSize}
      style={{ ...rootStyle, ...cssVars }}
    >
      <TopBar />
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        <SideNav />
        <div role="main" style={mainAreaStyle}>
          {children}
        </div>
      </div>
    </div>
  );
}
