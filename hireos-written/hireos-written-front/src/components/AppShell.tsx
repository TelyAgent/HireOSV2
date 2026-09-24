import { type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Modal, Radio } from "antd";
import { Icon } from "./ui/Icon";
import { Button, ToastHost } from "./ui/Primitives";
import { useStore } from "../store/StoreContext";
import { USERS } from "../data/users";
import type { UserId } from "../store/types";
import { fmtDate, nowISO } from "../data/fixtures";

interface NavItem { href: string; label: string; ic: string }
interface NavGroup { section: string | null; items: NavItem[] }

const NAV_STANDALONE: NavGroup[] = [
  { section: null, items: [
    { href: "/tasks", label: "My Tasks", ic: "checklist" },
    { href: "/question-bank", label: "Question Bank", ic: "quiz" },
  ] },
  { section: "Workspace", items: [
    { href: "/files", label: "Files & Integrations", ic: "cloud_upload" },
    { href: "/settings", label: "Settings", ic: "tune" },
  ] },
];

const NAV_SHELL: NavGroup[] = [
  { section: "Command", items: [
    { href: "/tasks", label: "My Focus", ic: "track_changes" },
    { href: "/assessments", label: "Jobs", ic: "work_outline" },
    { href: "/settings", label: "Settings", ic: "tune" },
  ] },
  { section: "Assessment (embedded)", items: [
    { href: "/tasks", label: "My Tasks", ic: "checklist" },
    { href: "/assessments", label: "Assessments", ic: "work_outline" },
    { href: "/question-bank", label: "Question Bank", ic: "quiz" },
    { href: "/comparisons", label: "Comparisons", ic: "compare_arrows" },
  ] },
];

function navActive(href: string, pathname: string) {
  if (href === "/tasks") return pathname === "/tasks";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ openTaskCount, children }: { openTaskCount: number; children: ReactNode }) {
  const { state, t, toggleLang, toggleSidebar, toggleAppearance, toggleRoleSwitcher, set } = useStore();
  const location = useLocation();
  const navigate = useNavigate();
  const navGroups = state.shellMode === "shell" ? NAV_SHELL : NAV_STANDALONE;

  return (
    <div className="appshell">
      <nav className={`sidebar ${state.sidebarCollapsed ? "collapsed" : ""}`} aria-label="Primary navigation">
        <div className="nav-scroll">
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.section && <div className="nav-section-label">{t(group.section)}</div>}
              {group.items.map((item, ii) => {
                const active = navActive(item.href, location.pathname);
                const label = t(item.label);
                const showCount = item.label === "My Tasks" || item.label === "My Focus";
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
          <button className="topbar-search" type="button" title={t("Search")} aria-label={t("Search")}>
            <Icon name="search" style={{ fontSize: 18 }} />
            <span>{t("Search projects, candidates...")}</span>
          </button>
          <div style={{ flex: 1 }} />
          <button className="lang-switch" type="button" title={t("Language")} aria-label={t("Language")} onClick={toggleLang}>
            <span className={state.lang === "en" ? "on" : ""}>EN</span>
            <span className={state.lang === "zh" ? "on" : ""}>中</span>
          </button>
          <button className="icon-btn" type="button" title={t("Notifications")} aria-label={t("Notifications")} onClick={() => navigate("/tasks")}>
            <Icon name="notifications_none" />
            <span className="dot" />
          </button>
          <button className="icon-btn" type="button" title={t("Appearance")} aria-label={t("Appearance")} onClick={toggleAppearance}>
            <Icon name="palette" />
          </button>
          <div
            className={`badge ${state.shellMode === "shell" ? "info" : "neutral"}`}
            style={{ cursor: "pointer" }}
            onClick={() => set({ shellMode: state.shellMode === "shell" ? "standalone" : "shell" })}
            title={t("Demo tools")}
          >
            {state.shellMode === "shell" ? t("Workspace Shell") : t("Standalone entry")}
          </div>
          <RolePill onClick={toggleRoleSwitcher} />
        </div>
        <div className="content">{children}</div>
      </div>

      <AppearanceModal />
      <RoleSwitcherModal />
      <ToastHost />
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

function AppearanceModal() {
  const { state, t, setTheme, setAccent, setTextSize, resetAppearance, toggleAppearance, advanceClock } = useStore();
  return (
    <Modal open={state.showAppearance} onCancel={toggleAppearance} footer={null} title={t("Appearance")} width={440}>
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
      <div className="tiny" style={{ marginBottom: 14 }}>
        {t("Applies instantly across tables, menus, evidence highlights and overlays. Saved for this account")}
        {t("— demo uses local storage, not real cloud sync across devices.")}
      </div>
      <div className="divider" style={{ margin: "14px 0" }} />
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Demo clock — {fmtDate(nowISO(state.clockOffsetMin))} ({t("Asia/Shanghai")})</label>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => advanceClock(6)}>+6h</Button>
          <Button size="sm" onClick={() => advanceClock(24)}>+1 day</Button>
          <Button size="sm" onClick={() => advanceClock(72)}>+3 days</Button>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
        <Button onClick={resetAppearance}>{t("Reset to defaults")}</Button>
        <Button variant="primary" onClick={toggleAppearance}>{t("Done")}</Button>
      </div>
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
