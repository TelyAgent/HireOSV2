import { useLayoutEffect, type ReactNode } from "react";
import { Radio } from "antd";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Icon } from "./ui/Icons";
import { Button } from "./ui/Primitives";
import { CloseButton, ModalBody, ModalFooter, ModalHeader, OverlayHost } from "./ui/Overlays";
import { PEOPLE } from "../data/fixtures/people";
import { UserMenu, useSessionUser } from "../lib/session";
import type { Accent, TextSize, ThemeMode } from "../store/types";

/* ---------------------------------------------------------------
   Nav config — ported from the prototype's NAV / NAV_SHARED.
   --------------------------------------------------------------- */
interface NavItem {
  to: string;
  icon: string;
  label: string;
  match: string;
}
const NAV_PRIMARY: NavItem[] = [
  { to: "/jobs", icon: "work", label: "Job Library", match: "/jobs" },
];
const NAV_SHARED: NavItem[] = [
  { to: "/settings/profile", icon: "settings", label: "Settings", match: "/settings" },
];

/** The page body wrapper — mirrors the prototype's `setMain(html, widthClass)`. */
export function MainInner({ variant, children }: { variant?: "wide" | "flush"; children: ReactNode }) {
  return <div className={`main-inner${variant ? " " + variant : ""}`}>{children}</div>;
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

function TopBar() {
  const { state, t, toggleLang, openModal, person } = useStore();
  const navigate = useNavigate();
  const langLabel = state.lang === "en" ? "中 / EN" : "EN / 中";
  const sessionUser = useSessionUser();

  return (
    <div className="topbar">
      <div className="brand" onClick={() => navigate("/jobs")}>
        <span className="logo">H</span>
        <div>
          HireOS Command<small>{t("JD Management")}</small>
        </div>
      </div>
      <div className="topbar-actions">
        <button type="button" className="topbar-btn lang" onClick={toggleLang} title={t("Switch language")} aria-label={t("Switch language")}>
          {langLabel}
        </button>
        <button
          type="button"
          className="topbar-btn"
          aria-label={t("Appearance")}
          onClick={() => openModal(<AppearanceModal />, { overlayClass: "appearance-overlay" })}
        >
          <SunIcon />
          {t("Appearance")}
        </button>
        {sessionUser ? (
          <UserMenu user={sessionUser} labels={{ signOut: t("Sign out") }} />
        ) : (
          <div
            className="role-pill"
            onClick={() => openModal(<RoleSwitcherModal />)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openModal(<RoleSwitcherModal />);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={t("Switch demo role")}
          >
            <span className="avatar" style={{ background: person?.color }}>
              {person?.initials}
            </span>
            <span>{person?.name}</span>
            <span className="demo-tag">{t("Demo role")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NavLinkItem({ item }: { item: NavItem }) {
  const { pathname } = useLocation();
  const { t } = useStore();
  const active = pathname === item.match || pathname.startsWith(item.match + "/");
  const label = t(item.label);
  return (
    <Link
      to={item.to}
      className={`nav-item${active ? " active" : ""}`}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span className="nav-label">{label}</span>
    </Link>
  );
}

function SideNav() {
  const { state, t, toggleSidenav } = useStore();
  const collapsed = state.sidenavCollapsed;
  const toggleLabel = collapsed ? t("Expand navigation") : t("Collapse navigation");
  return (
    <nav className={`sidenav${collapsed ? " collapsed" : ""}`} aria-label={t("Primary navigation")}>
      <div className="sidenav-section">
        {NAV_PRIMARY.map((item) => (
          <NavLinkItem key={item.to} item={item} />
        ))}
      </div>
      <div className="sidenav-section">
        <div className="sidenav-label">{t("Shared")}</div>
        {NAV_SHARED.map((item) => (
          <NavLinkItem key={item.to} item={item} />
        ))}
      </div>
      <button
        className="sidenav-toggle"
        type="button"
        title={toggleLabel}
        aria-label={toggleLabel}
        aria-expanded={!collapsed}
        onClick={toggleSidenav}
      >
        <Icon name={collapsed ? "left_panel_open" : "left_panel_close"} />
        <span className="toggle-label">{toggleLabel}</span>
      </button>
    </nav>
  );
}

/* ---------------------------------------------------------------
   Appearance / role / demo modals
   --------------------------------------------------------------- */
/** Theme / accent / text size — same controls as hireos-written-front's Settings → Appearance. */
export function AppearancePanel() {
  const { state, t, setTheme, setAccent, setTextSize } = useStore();
  return (
    <>
      <div className="field">
        <label>{t("Theme")}</label>
        <Radio.Group value={state.theme} onChange={(e) => setTheme(e.target.value as ThemeMode)}>
          <Radio.Button value="light">{t("Light")}</Radio.Button>
          <Radio.Button value="dark">{t("Dark")}</Radio.Button>
          <Radio.Button value="deep">{t("Deep")}</Radio.Button>
          <Radio.Button value="system">{t("System")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="field">
        <label>{t("Accent")}</label>
        <Radio.Group value={state.accent} onChange={(e) => setAccent(e.target.value as Accent)}>
          <Radio.Button value="blue">{t("Blue")}</Radio.Button>
          <Radio.Button value="teal">{t("Teal")}</Radio.Button>
          <Radio.Button value="violet">{t("Violet")}</Radio.Button>
        </Radio.Group>
      </div>
      <div className="field">
        <label>{t("Text size")}</label>
        <Radio.Group value={state.textSize} onChange={(e) => setTextSize(e.target.value as TextSize)}>
          <Radio.Button value="small">{t("Small")}</Radio.Button>
          <Radio.Button value="medium">{t("Medium")}</Radio.Button>
          <Radio.Button value="large">{t("Large")}</Radio.Button>
        </Radio.Group>
      </div>
    </>
  );
}

function AppearanceModal() {
  const { t, resetAppearance, closeModal } = useStore();
  return (
    <>
      <ModalHeader title={t("Appearance")} />
      <ModalBody>
        <AppearancePanel />
        <p className="tiny">
          {t(
            "Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.",
          )}
        </p>
      </ModalBody>
      <ModalFooter>
        <Button variant="text" onClick={resetAppearance}>
          {t("Reset to defaults")}
        </Button>
        <Button variant="primary" onClick={closeModal}>
          {t("Done")}
        </Button>
      </ModalFooter>
    </>
  );
}

function RoleSwitcherModal() {
  const { state, t, setCurrentUser } = useStore();
  return (
    <>
      <ModalHeader title={t("Switch demo role")} />
      <ModalBody>
        <p className="tiny" style={{ marginBottom: 12 }}>
          {t("Role switching is a demo control for this prototype, not a production permission model.")}
        </p>
        {Object.values(PEOPLE).map((p) => (
          <div
            key={p.id}
            className="list-row"
            style={{ cursor: "pointer", borderRadius: 8 }}
            onClick={() => setCurrentUser(p.id)}
          >
            <span className="avatar-md" style={{ background: p.color }}>
              {p.initials}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>
                {p.name} {p.id === state.currentUserId && <span className="badge badge-info">{t("Current")}</span>}
              </div>
              <div className="tiny">
                {p.title} — {p.role}
              </div>
            </div>
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <CloseButton />
      </ModalFooter>
    </>
  );
}

/* ---------------------------------------------------------------
   Shell
   --------------------------------------------------------------- */
export function AppShell({ children }: { children: ReactNode }) {
  const { state } = useStore();

  const effectiveDark = state.theme === "system" ? state.systemDark : state.theme === "dark" || state.theme === "deep";
  const themeAttr = state.theme === "system" ? (effectiveDark ? undefined : "light") : state.theme;

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (themeAttr) root.setAttribute("data-theme", themeAttr);
    else root.removeAttribute("data-theme");
    root.setAttribute("data-accent", state.accent);
    root.setAttribute("data-text", state.textSize);
    root.setAttribute("lang", state.lang === "zh" ? "zh-CN" : "en");
  }, [themeAttr, state.accent, state.textSize, state.lang]);

  return (
    <div id="app">
      <TopBar />
      <div className="shell">
        <SideNav />
        <main className="main">{children}</main>
      </div>
      <OverlayHost />
    </div>
  );
}
