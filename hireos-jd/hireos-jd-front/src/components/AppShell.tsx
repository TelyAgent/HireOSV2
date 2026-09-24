import { useLayoutEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { Icon } from "./ui/Icons";
import { Button, StatusBadge, ToastStack } from "./ui/Primitives";
import { CloseButton, ModalBody, ModalFooter, ModalHeader, OverlayHost } from "./ui/Overlays";
import { PEOPLE } from "../data/fixtures/people";
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
  { to: "/home", icon: "home", label: "Home", match: "/home" },
  { to: "/jobs", icon: "work", label: "Job Library", match: "/jobs" },
  { to: "/templates", icon: "dashboard_customize", label: "Templates", match: "/templates" },
];
const NAV_SHARED: NavItem[] = [
  { to: "/files", icon: "cloud_upload", label: "Files & Integrations", match: "/files" },
  { to: "/settings/overview", icon: "settings", label: "Settings", match: "/settings" },
];

/** The page body wrapper — mirrors the prototype's `setMain(html, widthClass)`. */
export function MainInner({ variant, children }: { variant?: "wide" | "flush"; children: ReactNode }) {
  return <div className={`main-inner${variant ? " " + variant : ""}`}>{children}</div>;
}

function TopBar() {
  const { state, t, toggleLang, openModal, person } = useStore();
  const navigate = useNavigate();
  const langLabel = state.lang === "en" ? "中 / EN" : "EN / 中";

  return (
    <div className="topbar">
      <div className="brand" onClick={() => navigate("/home")}>
        <span className="logo">H</span>
        <div>
          HireOS Command<small>{t("JD Management")}</small>
        </div>
      </div>
      <div className="topbar-search">
        <Icon name="search" size={18} />
        <input
          type="text"
          placeholder={t("Search jobs, requirements, tasks... (e.g. Roles in Vietnam that need finance experience)")}
          aria-label={t("Search")}
        />
      </div>
      <div className="topbar-actions">
        <Button
          variant="secondary"
          size="sm"
          style={{ borderRadius: 20 }}
          onClick={toggleLang}
          title={t("Switch language")}
          aria-label={t("Switch language")}
        >
          {langLabel}
        </Button>
        <button
          className="icon-btn"
          title={t("Appearance")}
          aria-label={t("Appearance")}
          onClick={() => openModal(<AppearanceModal />, { wide: true })}
        >
          <Icon name="palette" />
        </button>
        <button
          className="icon-btn"
          title={t("Demo tools")}
          aria-label={t("Demo tools")}
          onClick={() => openModal(<DemoToolsModal />)}
        >
          <Icon name="science" />
        </button>
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
    <nav className={`sidenav${collapsed ? " collapsed" : ""}`} aria-label="Primary">
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
      <div className="sidenav-section sidenav-standalone-note">
        <div className="sidenav-label">Sending Labs</div>
        <div
          className="nav-item"
          title={t("Standalone mode — no Shell installed")}
          style={{ cursor: "default", color: "var(--text-tertiary)", fontSize: "var(--fs-xs)", padding: "8px 12px" }}
        >
          <Icon name="info" size={16} />
          <span className="nav-label">{t("Standalone mode — no Shell installed")}</span>
        </div>
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
const THEME_SWATCH: Record<ThemeMode, string> = {
  light: "#fff",
  dark: "#292a2d",
  deep: "#132a3e",
  system: "linear-gradient(90deg,#fff 50%,#292a2d 50%)",
};

export function AppearancePanel() {
  const { state, t, setLang, setTheme, setAccent, setTextSize } = useStore();
  const themes: ThemeMode[] = ["light", "dark", "deep", "system"];
  const sizes: TextSize[] = ["small", "medium", "large"];
  const accents: { key: Accent; color: string; label: string }[] = [
    { key: "teal", color: "#0d9488", label: "Teal" },
    { key: "blue", color: "#2563eb", label: "Blue" },
    { key: "violet", color: "#7c3aed", label: "Violet" },
  ];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <>
      <div className="field">
        <label>{t("Language")}</label>
        <div className="flex gap-10">
          <Button variant={state.lang === "en" ? "primary" : "secondary"} size="sm" onClick={() => setLang("en")}>
            English
          </Button>
          <Button variant={state.lang === "zh" ? "primary" : "secondary"} size="sm" onClick={() => setLang("zh")}>
            中文
          </Button>
        </div>
      </div>
      <div className="field">
        <label>{t("Theme")}</label>
        <div className="flex gap-10">
          {themes.map((th) => (
            <div
              key={th}
              className={`theme-card${state.theme === th ? " selected" : ""}`}
              style={{ flex: 1 }}
              onClick={() => setTheme(th)}
            >
              <div className="theme-swatch" style={{ border: "1px solid var(--border)" }}>
                <div style={{ background: THEME_SWATCH[th] }} />
              </div>
              <div style={{ fontSize: "var(--fs-xs)", fontWeight: 600 }}>{t(cap(th))}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("Accent color")}</label>
        <div className="flex gap-10">
          {accents.map((a) => (
            <span
              key={a.key}
              className={`accent-dot${state.accent === a.key ? " selected" : ""}`}
              style={{ background: a.color }}
              title={t(a.label)}
              onClick={() => setAccent(a.key)}
            />
          ))}
        </div>
      </div>
      <div className="field">
        <label>{t("Text size")}</label>
        <div className="flex gap-10">
          {sizes.map((s) => (
            <div key={s} className={`size-card${state.textSize === s ? " selected" : ""}`} onClick={() => setTextSize(s)}>
              <div style={{ fontSize: s === "small" ? 12 : s === "large" ? 18 : 15, fontWeight: 600 }}>Aa</div>
              <div className="tiny">{t(cap(s))}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function AppearancePreview() {
  const { t } = useStore();
  return (
    <div className="card card-pad" style={{ background: "var(--surface-alt)", border: "none" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {t("Live preview")}
      </div>
      <div className="page-title" style={{ fontSize: "var(--fs-lg)", marginBottom: 4 }}>
        Senior Backend Engineer
      </div>
      <div className="flex gap-6" style={{ marginBottom: 8 }}>
        <StatusBadge kind="hiring_status" value="open" />
        <StatusBadge kind="approval_status" value="pending" />
      </div>
      <Button variant="primary" size="sm">
        {t("Submit for approval")}
      </Button>{" "}
      <Button variant="secondary" size="sm">
        {t("Preview")}
      </Button>
    </div>
  );
}

function AppearanceModal() {
  const { t, resetAppearance, closeModal } = useStore();
  return (
    <>
      <ModalHeader title={t("Appearance")} />
      <ModalBody>
        <AppearancePanel />
        <AppearancePreview />
        <p className="tiny" style={{ marginTop: 10 }}>
          {t(
            "Preferences are saved for this session and this demo role. Production HireOS syncs Appearance to your account across devices.",
          )}
        </p>
      </ModalBody>
      <ModalFooter spread>
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

function DemoToolsModal() {
  const { t } = useStore();
  return (
    <>
      <ModalHeader title={t("Demo tools")} />
      <ModalBody>
        <p className="tiny" style={{ marginBottom: 10 }}>
          {t(
            "This prototype runs standalone (no Shell / other L2 modules installed). Files & Integrations, Settings and AI Models are the shared public capabilities — fully usable here.",
          )}
        </p>
        <div className="card card-pad" style={{ background: "var(--surface-alt)", border: "none" }}>
          <div className="tiny" style={{ marginBottom: 6 }}>
            {t("Workspace")}
          </div>
          <div style={{ fontWeight: 500 }}>
            Sending Labs <span className="tiny">(ws-demo)</span>
          </div>
        </div>
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
      <ToastStack />
    </div>
  );
}
