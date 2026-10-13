import { Navigate, useNavigate, useParams } from "react-router-dom";
import { MainInner, AppearancePanel, AppearancePreview } from "../components/AppShell";
import { Button } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { PEOPLE } from "../data/fixtures/people";

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
  const { state, t, say, resetAppearance, set, person } = useStore();

  switch (section) {
    case "profile":
      return (
        <>
          <SettingsHead title={t("My Profile & Preferences")} scope={t("Current user")} />
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <div className="flex items-center gap-12">
              <span className="avatar-md" style={{ background: person?.color }}>
                {person?.initials}
              </span>
              <div>
                <div style={{ fontWeight: 500 }}>{person?.name}</div>
                <div className="tiny">
                  {person?.title} • {person?.email}
                </div>
              </div>
            </div>
          </div>
          <div className="field">
            <label>{t("Display name")}</label>
            <input type="text" defaultValue={person?.name} />
          </div>
          <div className="field">
            <label>{t("Language")}</label>
            <select value={state.lang} onChange={(e) => set({ lang: e.target.value as "en" | "zh" })}>
              <option value="en">English</option>
              <option value="zh">中文</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Time zone")}</label>
            <select defaultValue="hcm">
              <option value="hcm">Asia/Ho_Chi_Minh (UTC+7)</option>
              <option value="sg">Asia/Singapore (UTC+8)</option>
            </select>
          </div>
          <div className="field">
            <label>{t("Memberships")}</label>
            <div className="tiny">Sending Labs — {person?.role}</div>
          </div>
          <Button variant="primary" onClick={() => say(t("Saved"), { type: "success" })}>
            {t("Save")}
          </Button>
        </>
      );

    case "appearance":
      return (
        <>
          <SettingsHead title={t("Appearance")} scope={t("Account — personal")} />
          <p className="tiny" style={{ marginBottom: 16 }}>
            {t("This panel and the header Appearance button control the same preference — changes apply instantly everywhere.")}
          </p>
          <AppearancePanel />
          <div style={{ marginBottom: 16 }}>
            <AppearancePreview />
          </div>
          <Button variant="text" onClick={resetAppearance}>
            {t("Reset to defaults")}
          </Button>
        </>
      );

    case "members":
      return (
        <>
          <SettingsHead title={t("Members & Permissions")} scope={t("Permission admin")} />
          <div className="field">
            <input type="text" placeholder={t("Search members…")} />
          </div>
          <div className="card">
            {Object.values(PEOPLE).map((p) => (
              <div key={p.id} className="list-row">
                <span className="avatar-sm" style={{ background: p.color }}>
                  {p.initials}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{p.name}</div>
                  <div className="tiny">{p.email}</div>
                </div>
                <span className="badge badge-neutral">{p.role}</span>
                <Button
                  variant="text"
                  size="sm"
                  onClick={() => say(t("Job scope and restricted-field entitlements are configured per member (demo)"))}
                >
                  {t("Manage scope")}
                </Button>
              </div>
            ))}
          </div>
        </>
      );

    default:
      // Removed sections (overview, AI models, …) and unknown keys land on the profile.
      return <Navigate to="/settings/profile" replace />;
  }
}
