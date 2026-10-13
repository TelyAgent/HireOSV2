import { Link, NavLink } from "react-router-dom";
import { initials, type Me } from "../api";
import { useI18n } from "../i18n";

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">H</span>
      <span className="brand-name">HireOS Command</span>
    </div>
  );
}

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button type="button" className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
      EN / 中
    </button>
  );
}

export function Avatar({ name, color, size = 28 }: { name: string; color: string | null; size?: number }) {
  return (
    <span className="avatar" style={{ background: color || "#64748b", width: size, height: size, fontSize: size * 0.4 }}>
      {initials(name)}
    </span>
  );
}

export function AppHeader({ me }: { me: Me }) {
  const { t } = useI18n();
  return (
    <header className="app-header">
      <Link to="/" className="app-brand">
        <span className="brand-mark small">H</span>
        <span>HireOS Command</span>
        <span className="app-section">/ {t("Account")}</span>
      </Link>
      <nav className="app-nav">
        <NavLink to="/" end>
          {t("Profile")}
        </NavLink>
        {me.roles.includes("admin") && <NavLink to="/members">{t("Members")}</NavLink>}
      </nav>
      <div className="app-header-right">
        <LangToggle />
        <span className="app-user">
          <Avatar name={me.user.displayName} color={me.user.avatarColor} />
          {me.user.displayName}
        </span>
      </div>
    </header>
  );
}
