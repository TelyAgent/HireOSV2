import { useLayoutEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { PEOPLE } from "../data/fixtures/people";
import type { Accent, TextSize, ThemeMode } from "../store/types";
import { Icon } from "./ui/Icons";
import { Button, PersonAvatar, ToastStack } from "./ui/Primitives";
import { Modal } from "./ui/Overlays";

/* ---------------------------------------------------------------
   Nav config — ported from the prototype's NAV_ITEMS/isActiveRoute.
   --------------------------------------------------------------- */
interface NavItem {
  to: string;
  icon: string;
  label: string;
  isActive: (pathname: string) => boolean;
  showCount?: boolean;
}
const NAV_PRIMARY: NavItem[] = [
  { to: "/tasks", icon: "checklist", label: "My Tasks", isActive: (p) => p.startsWith("/tasks"), showCount: true },
  {
    to: "/library",
    icon: "folder_shared",
    label: "Resume Library",
    isActive: (p) => p.startsWith("/library") || p.startsWith("/imports") || p.startsWith("/duplicates") || p.startsWith("/candidates"),
  },
  {
    to: "/jobs",
    icon: "work_outline",
    label: "Jobs",
    // Comparisons only exist in the context of a job's shortlist (entered from that job's
    // screening workspace) -- there's no standalone "the comparison" to link to from a
    // global nav item, so it highlights Jobs instead of getting its own entry.
    isActive: (p) => p.startsWith("/jobs") || p.startsWith("/applications") || p.startsWith("/deliveries") || p.startsWith("/comparisons"),
  },
];
const NAV_WORKSPACE: NavItem[] = [
  { to: "/files", icon: "cloud_upload", label: "Files & Integrations", isActive: (p) => p.startsWith("/files") },
  { to: "/settings/preferences", icon: "tune", label: "Settings", isActive: (p) => p.startsWith("/settings") },
];

export function WorkspaceBanner() {
  const { t } = useStore();
  return (
    <div className="workspace-banner">
      <strong>HireOS Workspace</strong>
      <span className="workspace-note">
        {t("Prototype data only · External sends, real emails, and model calls are simulated.")}
      </span>
      <span className="workspace-state">{t("Resume Screening")}</span>
    </div>
  );
}

export function TopBar({ openTaskCount }: { openTaskCount: number }) {
  const { state, t, toggleLang, toggleAppearance, toggleRoleSwitcher, person } = useStore();
  const langLabel = state.lang === "en" ? "中 / EN" : "EN / 中";
  return (
    <div className="topbar">
      <div className="brand">
        <span className="logo">H</span>
        <span className="brand-name">HireOS Command</span>
        <span className="brand-sep" aria-hidden="true">/</span>
        <span className="brand-context">{t("Resume Screening")}</span>
      </div>
      <div className="topbar-search">
        <Icon name="search" size={18} />
        <input type="text" placeholder={t("Search candidates, jobs, tasks...")} aria-label={t("Search")} />
      </div>
      <div className="topbar-actions">
        <Link to="/tasks" className="icon-btn" title={t("Notifications")} aria-label={t("Notifications")}>
          <Icon name="notifications_none" />
          {openTaskCount > 0 && <span className="dot" />}
        </Link>
        <Button variant="secondary" size="sm" style={{ borderRadius: 20 }} onClick={toggleLang}>
          {langLabel}
        </Button>
        <button className="icon-btn" title={t("Appearance")} aria-label={t("Appearance")} onClick={toggleAppearance}>
          <Icon name="palette" />
        </button>
        <div
          className="role-pill"
          onClick={toggleRoleSwitcher}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggleRoleSwitcher();
            }
          }}
          tabIndex={0}
          role="button"
          aria-label={t("Switch demo role")}
        >
          <PersonAvatar person={person} />
          <span>{person?.name}</span>
          <span className="demo-tag">{t("Demo role")}</span>
        </div>
      </div>
    </div>
  );
}

function NavLinkItem({ item, collapsed, count }: { item: NavItem; collapsed: boolean; count?: number }) {
  const { pathname } = useLocation();
  const { t } = useStore();
  const active = item.isActive(pathname);
  const label = t(item.label);
  return (
    <Link
      to={item.to}
      className={`nav-item${active ? " active" : ""}`}
      aria-label={label}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} />
      {!collapsed && label}
      {count != null && count > 0 && <span className="badge-count">{count}</span>}
    </Link>
  );
}

export function SideNav({ openTaskCount }: { openTaskCount: number }) {
  const { state, t } = useStore();
  const collapsed = state.sidenavCollapsed;
  return (
    <nav className={`sidenav${collapsed ? " collapsed" : ""}`} aria-label="Primary">
      <div className="sidenav-section">
        {NAV_PRIMARY.map((item) => (
          <NavLinkItem key={item.to} item={item} collapsed={collapsed} count={item.showCount ? openTaskCount : undefined} />
        ))}
      </div>
      <div className="sidenav-section">
        {!collapsed && <div className="sidenav-label">{t("Workspace")}</div>}
        {NAV_WORKSPACE.map((item) => (
          <NavLinkItem key={item.to} item={item} collapsed={collapsed} />
        ))}
      </div>
      {!collapsed && (
        <div className="sidenav-section sidenav-demo">
          <div className="sidenav-label">{t("Demo")}</div>
          <div style={{ padding: "8px 12px", fontSize: "var(--fs-xs)", color: "var(--text-tertiary)", lineHeight: 1.5 }}>
            {t("All data on this prototype is fictional. External sends, real emails and model calls are simulated.")}
          </div>
        </div>
      )}
    </nav>
  );
}

function AppearanceModal() {
  const { state, t, setTheme, setAccent, setTextSize, resetAppearance, toggleAppearance } = useStore();
  const themes: ThemeMode[] = ["light", "dark", "deep", "system"];
  const accents: Accent[] = ["blue", "teal", "violet"];
  const sizes: TextSize[] = ["small", "medium", "large"];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <Modal
      open={state.showAppearance}
      onClose={toggleAppearance}
      title={t("Appearance")}
      footer={
        <>
          <Button variant="text" onClick={resetAppearance}>
            {t("Reset to defaults")}
          </Button>
          <Button variant="primary" onClick={toggleAppearance}>
            {t("Done")}
          </Button>
        </>
      }
    >
      <div className="field">
        <label>{t("Theme")}</label>
        <div className="flex gap-8 flex-wrap">
          {themes.map((th) => (
            <Button key={th} size="sm" variant={state.theme === th ? "primary" : "secondary"} onClick={() => setTheme(th)}>
              {t(cap(th))}
            </Button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("Accent color")}</label>
        <div className="flex gap-8 flex-wrap">
          {accents.map((ac) => (
            <Button key={ac} size="sm" variant={state.accent === ac ? "primary" : "secondary"} onClick={() => setAccent(ac)}>
              {t(cap(ac))}
            </Button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("Text size")}</label>
        <div className="flex gap-8 flex-wrap">
          {sizes.map((sz) => (
            <Button key={sz} size="sm" variant={state.textSize === sz ? "primary" : "secondary"} onClick={() => setTextSize(sz)}>
              {t(cap(sz))}
            </Button>
          ))}
        </div>
      </div>
      <p className="tiny">
        {t(
          "Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.",
        )}
      </p>
    </Modal>
  );
}

function RoleSwitcherModal() {
  const { state, t, setCurrentUser, toggleRoleSwitcher } = useStore();
  return (
    <Modal open={state.showRoleSwitcher} onClose={toggleRoleSwitcher} title={t("Switch demo role")}>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t(
          'This switches which person\'s "My Tasks" and permissions the prototype shows. It does not represent real authentication.',
        )}
      </p>
      {Object.values(PEOPLE).map((p) => (
        <div
          key={p.id}
          className={`radio-card${state.currentUser === p.id ? " selected" : ""}`}
          style={{ marginBottom: 8 }}
          onClick={() => setCurrentUser(p.id)}
        >
          <PersonAvatar person={p} size="md" />
          <div>
            <div style={{ fontWeight: 500 }}>{p.name}</div>
            <div className="tiny">
              {p.title} · {p.role}
            </div>
          </div>
        </div>
      ))}
    </Modal>
  );
}

export function AppShell({ children, openTaskCount = 0 }: { children: ReactNode; openTaskCount?: number }) {
  const { state } = useStore();

  const effectiveDark = state.theme === "system" ? state.systemDark : state.theme === "dark" || state.theme === "deep";
  const themeAttr = state.theme === "system" ? (effectiveDark ? undefined : "light") : state.theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (themeAttr) root.setAttribute("data-theme", themeAttr);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-accent", state.accent);
    root.setAttribute("data-text", state.textSize);
  }, [themeAttr, state.accent, state.textSize]);

  return (
    <div id="app">
      <WorkspaceBanner />
      <TopBar openTaskCount={openTaskCount} />
      <div className="shell">
        <SideNav openTaskCount={openTaskCount} />
        <main className="main">
          <div className="main-inner wide">{children}</div>
        </main>
      </div>
      <AppearanceModal />
      <RoleSwitcherModal />
      <ToastStack />
    </div>
  );
}
