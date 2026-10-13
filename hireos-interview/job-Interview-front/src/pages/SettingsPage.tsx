import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Button, Input, Select, Tag } from "antd";
import { useStore } from "../store/StoreContext";
import { ACCOUNT_URL, authFetch, useSessionUser } from "../lib/session";
import { AppearancePanel } from "../features/settings/AppearancePanel";
import { MembersSection } from "../features/settings/MembersSection";
import { useSettingsT } from "../features/settings/i18n";

/* Same structure as the JD / Screening / Written settings pages: a section nav on the left, one section at a time. */
const SETTINGS_NAV = [
  {
    group: "Personal",
    items: [
      { key: "profile", label: "My Profile & Preferences" },
      { key: "appearance", label: "Appearance" },
    ],
  },
  {
    group: "Workspace",
    items: [{ key: "members", label: "Members & Permissions" }],
  },
];

export function SettingsPage() {
  const { section = "profile" } = useParams();
  const t = useSettingsT();
  const navigate = useNavigate();

  return (
    <div className="hs-shell">
      <div className="hs-nav">
        {SETTINGS_NAV.map((g) => (
          <div key={g.group} className="hs-nav-group">
            <div className="hs-nav-label">{t(g.group)}</div>
            {g.items.map((it) => (
              <div key={it.key} className={`hs-nav-item${section === it.key ? " active" : ""}`} onClick={() => navigate(`/settings/${it.key}`)}>
                {t(it.label)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="hs-content">
        <SettingsSection section={section} />
      </div>
    </div>
  );
}

function SettingsHead({ title, scope }: { title: string; scope: string }) {
  return (
    <h2 className="hs-title">
      {title}
      <span className="hs-scope">{scope}</span>
    </h2>
  );
}

function SettingsSection({ section }: { section: string }) {
  const { resetPrefs } = useStore();
  const t = useSettingsT();
  switch (section) {
    case "profile":
      return <ProfileSection />;
    case "appearance":
      return (
        <>
          <SettingsHead title={t("Appearance")} scope={t("Account — personal")} />
          <p className="hs-tiny" style={{ marginBottom: 16 }}>
            {t("This panel and the header Appearance button control the same preference — changes apply instantly everywhere.")}
          </p>
          <AppearancePanel />
          <Button onClick={resetPrefs}>{t("Reset to defaults")}</Button>
        </>
      );
    case "members":
      return <MembersSection />;
    default:
      return <Navigate to="/settings/profile" replace />;
  }
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", interviewer: "Interviewer" };

/** The signed-in HireOS account (hireos-identity); same section as the other subsystems' settings pages. */
function ProfileSection() {
  const { state, set, role } = useStore();
  const t = useSettingsT();
  const { message } = AntApp.useApp();
  const sessionUser = useSessionUser();
  const [name, setName] = useState(sessionUser?.displayName ?? "");
  const [saving, setSaving] = useState(false);

  const saveName = async () => {
    setSaving(true);
    try {
      const response = await authFetch(`${ACCOUNT_URL}api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name.trim() }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      message.success(t("Saved — the new name shows everywhere after a refresh"));
    } catch {
      message.error(t("Something went wrong — please try again."));
    } finally {
      setSaving(false);
    }
  };

  const displayName = sessionUser?.displayName ?? role.name;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <SettingsHead title={t("My Profile & Preferences")} scope={t("Current user")} />
      <div className="hs-card hs-pad" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span className="hs-avatar" style={{ background: sessionUser?.avatarColor || "var(--brand)", width: 40, height: 40, fontSize: 14 }}>
          {initials}
        </span>
        <div>
          <div style={{ fontWeight: 600 }}>{displayName}</div>
          <div className="hs-tiny">{sessionUser?.email ?? t("Not signed in — showing the demo role")}</div>
        </div>
      </div>
      {sessionUser && (
        <div className="hs-field">
          <div className="hs-label">{t("Display name")}</div>
          <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            <Button type="primary" loading={saving} disabled={!name.trim() || name.trim() === sessionUser.displayName} onClick={() => void saveName()}>
              {t("Save")}
            </Button>
          </div>
        </div>
      )}
      <div className="hs-field" style={{ maxWidth: 420 }}>
        <div className="hs-label">{t("Language")}</div>
        <Select
          value={state.lang}
          onChange={(lang: "en" | "zh") => set({ lang })}
          style={{ width: "100%" }}
          options={[
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
          ]}
        />
      </div>
      {sessionUser && (
        <div className="hs-field">
          <div className="hs-label">{t("Roles")}</div>
          <div>
            {sessionUser.roles.map((r) => (
              <Tag key={r}>{t(ROLE_LABEL[r] ?? r)}</Tag>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
