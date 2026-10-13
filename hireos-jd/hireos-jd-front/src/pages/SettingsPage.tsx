import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Input, Select, Tag } from "antd";
import { MainInner, AppearancePanel } from "../components/AppShell";
import { Button } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { MembersSection } from "../features/members/MembersSection";
import { ACCOUNT_URL, authFetch, useSessionUser } from "../lib/session";

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
    items: [
      { key: "members", label: "Members & Permissions" },
    ],
  },
];

export function SettingsPage() {
  const { section = "profile" } = useParams();
  const { t } = useStore();
  const navigate = useNavigate();

  return (
    <MainInner variant="flush">
      <div className="settings-shell">
        <div className="settings-nav">
          {SETTINGS_NAV.map((g) => (
            <div key={g.group} className="settings-nav-group">
              <div className="snlabel">{t(g.group)}</div>
              {g.items.map((it) => (
                <div
                  key={it.key}
                  className={`settings-nav-item${section === it.key ? " active" : ""}`}
                  onClick={() => navigate(`/settings/${it.key}`)}
                >
                  {t(it.label)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="settings-content">
          <SettingsSection section={section} />
        </div>
      </div>
    </MainInner>
  );
}

function SettingsHead({ title, scope }: { title: string; scope: string }) {
  return (
    <h2 className="section-title">
      {title}
      <span className="scope-tag">{scope}</span>
    </h2>
  );
}

function SettingsSection({ section }: { section: string }) {
  const { t, resetAppearance } = useStore();

  switch (section) {
    case "profile":
      return <ProfileSection />;

    case "appearance":
      return (
        <>
          <SettingsHead title={t("Appearance")} scope={t("Account — personal")} />
          <p className="tiny" style={{ marginBottom: 16 }}>
            {t("This panel and the header Appearance button control the same preference — changes apply instantly everywhere.")}
          </p>
          <AppearancePanel />
          <Button variant="secondary" onClick={resetAppearance}>
            {t("Reset to defaults")}
          </Button>
        </>
      );

    case "members":
      return <MembersSection />;

    default:
      // Removed sections (overview, AI models, …) and unknown keys land on the profile.
      return <Navigate to="/settings/profile" replace />;
  }
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", interviewer: "Interviewer" };

/** The signed-in HireOS account (hireos-identity); same section as hireos-written-front's settings page. */
function ProfileSection() {
  const { state, t, setLang, person } = useStore();
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

  const displayName = sessionUser?.displayName ?? person?.name ?? "";
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <SettingsHead title={t("My Profile & Preferences")} scope={t("Current user")} />
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-12">
          <span className="avatar-sm" style={{ background: sessionUser?.avatarColor || person?.color || "#64748b", width: 40, height: 40, fontSize: 14 }}>
            {initials}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{displayName}</div>
            <div className="tiny">{sessionUser?.email ?? t("Not signed in — showing the demo role")}</div>
          </div>
        </div>
      </div>
      {sessionUser && (
        <div className="field">
          <label>{t("Display name")}</label>
          <div className="flex gap-8" style={{ maxWidth: 420 }}>
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            <Button variant="primary" disabled={saving || !name.trim() || name.trim() === sessionUser.displayName} onClick={() => void saveName()}>
              {t("Save")}
            </Button>
          </div>
        </div>
      )}
      <div className="field" style={{ maxWidth: 420 }}>
        <label>{t("Language")}</label>
        <Select
          value={state.lang}
          onChange={(lang: "en" | "zh") => setLang(lang)}
          style={{ width: "100%" }}
          options={[
            { value: "en", label: "English" },
            { value: "zh", label: "中文" },
          ]}
        />
      </div>
      {sessionUser && (
        <div className="field">
          <label>{t("Roles")}</label>
          <div>
            {sessionUser.roles.map((role) => (
              <Tag key={role}>{t(ROLE_LABEL[role] ?? role)}</Tag>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
