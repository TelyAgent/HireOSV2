import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Modal, Radio } from "antd";
import { Icon } from "./ui/Icon";
import { Button } from "./ui/Primitives";
import { useStore } from "../store/StoreContext";
import { USERS } from "../data/users";
import type { UserId } from "../store/types";
import { UserMenu, useSessionUser } from "../lib/session";

interface NavItem { href: string; label: string; ic: string }
interface NavGroup { section: string | null; items: NavItem[] }

const NAV: NavGroup[] = [
  { section: null, items: [
    { href: "/tasks", label: "My Tasks", ic: "checklist" },
    { href: "/question-bank", label: "Question Bank", ic: "quiz" },
  ] },
  { section: "Workspace", items: [
    { href: "/settings", label: "Settings", ic: "tune" },
  ] },
];

function navActive(href: string, pathname: string) {
  if (href === "/tasks") return pathname === "/tasks";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Same sun glyph as hireos-interview's top-bar Appearance button. */
function SunIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}

export function AppShell({ openTaskCount, children }: { openTaskCount: number; children: ReactNode }) {
  const { state, t, toggleLang, toggleSidebar, toggleAppearance, toggleRoleSwitcher } = useStore();
  const sessionUser = useSessionUser();
  const location = useLocation();
  const navigate = useNavigate();
  const toggleLabel = state.sidebarCollapsed ? t("Expand navigation") : t("Collapse navigation");

  return (
    <div className="appshell">
      <nav className={`sidebar ${state.sidebarCollapsed ? "collapsed" : ""}`} aria-label={t("Primary navigation")}>
        <div className="nav-scroll">
          {NAV.map((group, gi) => (
            <div key={gi}>
              {group.section && <div className="nav-section-label">{t(group.section)}</div>}
              {group.items.map((item, ii) => {
                const active = navActive(item.href, location.pathname);
                const label = t(item.label);
                const showCount = item.label === "My Tasks";
                return (
                  <Link key={ii} to={item.href} className={`nav-item ${active ? "active" : ""}`} title={label}>
                    <span className="ic material-icons-o">{item.ic}</span>
                    <span className="grow truncate">{label}</span>
                    {showCount && <span className="count">{openTaskCount}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <button
          className="sidebar-toggle"
          type="button"
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={!state.sidebarCollapsed}
          onClick={toggleSidebar}
        >
          <span className="ic material-icons-o">{state.sidebarCollapsed ? "left_panel_open" : "left_panel_close"}</span>
          {!state.sidebarCollapsed && <span className="truncate">{toggleLabel}</span>}
        </button>
      </nav>

      <div className="main-col">
        <div className="appbar">
          <div className="topbar-logo" aria-hidden="true">H</div>
          <div className="appbar-product">
            <span className="appbar-product-name">HireOS Command</span>
            <span className="appbar-product-sep">/</span>
            <span className="appbar-product-module">{t("Written Test")}</span>
          </div>
          <button className="icon-btn" type="button" title={t("Toggle navigation")} aria-label={t("Toggle navigation")} onClick={toggleSidebar}>
            <Icon name="menu" />
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="topbar-btn lang" aria-label={t("Language")} onClick={toggleLang}>
            {state.lang === "en" ? "中 / EN" : "EN / 中"}
          </button>
          <button className="icon-btn" type="button" title={t("Notifications")} aria-label={t("Notifications")} onClick={() => navigate("/tasks")}>
            <Icon name="notifications_none" />
            <span className="dot" />
          </button>
          <button type="button" className="topbar-btn" aria-label={t("Appearance")} onClick={toggleAppearance}>
            <SunIcon />
            {t("Appearance")}
          </button>
          {sessionUser ? (
            <UserMenu user={sessionUser} labels={{ signOut: t("Sign out") }} />
          ) : (
            <RolePill onClick={toggleRoleSwitcher} />
          )}
        </div>
        <div className="content">{children}</div>
      </div>

      <AppearanceModal />
      <RoleSwitcherModal />
    </div>
  );
}

function RolePill({ onClick }: { onClick: () => void }) {
  const { t, user } = useStore();
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <div className="role-pill" title={t("Switch demo role")} onClick={onClick}>
      <div className="avatar">{initials}</div>
      <span>{user.name}</span>
      <span className="demo-tag">{t("Demo role")}</span>
    </div>
  );
}

/** Theme / accent / text size — shared by the top-bar Appearance dialog and Settings → Appearance. */
export function AppearanceFields() {
  const { state, t, setTheme, setAccent, setTextSize } = useStore();
  return (
    <>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>{t("Theme")}</label>
        <Radio.Group value={state.theme} onChange={(e) => setTheme(e.target.value)}>
          <Radio.Button value="light">{t("Light")}</Radio.Button>
          <Radio.Button value="dark">{t("Dark")}</Radio.Button>
          <Radio.Button value="deep">{t("Deep")}</Radio.Button>
          <Radio.Button value="system">{t("System")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>{t("Accent")}</label>
        <Radio.Group value={state.accent} onChange={(e) => setAccent(e.target.value)}>
          <Radio.Button value="blue">{t("Blue")}</Radio.Button>
          <Radio.Button value="teal">{t("Teal")}</Radio.Button>
          <Radio.Button value="violet">{t("Violet")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="field" style={{ marginBottom: 14 }}>
        <label>{t("Text size")}</label>
        <Radio.Group value={state.textSize} onChange={(e) => setTextSize(e.target.value)}>
          <Radio.Button value="small">{t("Small")}</Radio.Button>
          <Radio.Button value="medium">{t("Medium")}</Radio.Button>
          <Radio.Button value="large">{t("Large")}</Radio.Button>
        </Radio.Group>
      </div>
    </>
  );
}

function AppearanceModal() {
  const { state, t, resetAppearance, toggleAppearance } = useStore();
  return (
    <Modal
      open={state.showAppearance}
      onCancel={toggleAppearance}
      title={t("Appearance")}
      width={640}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Button variant="ghost" onClick={resetAppearance}>{t("Reset to defaults")}</Button>
          <Button variant="primary" onClick={toggleAppearance}>{t("Done")}</Button>
        </div>
      }
    >
      <AppearanceFields />
      <p className="tiny" style={{ margin: 0 }}>
        {t("Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.")}
      </p>
    </Modal>
  );
}

function RoleSwitcherModal() {
  const { state, t, setCurrentUser, toggleRoleSwitcher } = useStore();
  return (
    <Modal open={state.showRoleSwitcher} onCancel={toggleRoleSwitcher} footer={null} title={t("Switch demo role")} width={420}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Object.values(USERS).map((u) => (
          <button
            key={u.id}
            type="button"
            className="task-row"
            style={{ border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", background: u.id === state.currentUser ? "var(--selected-surface)" : "var(--surface)" }}
            onClick={() => setCurrentUser(u.id as UserId)}
          >
            <div className="avatar">{u.initials}</div>
            <div className="task-main">
              <div className="task-title">{u.name}</div>
              <div className="task-sub">{u.role}</div>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  );
}
