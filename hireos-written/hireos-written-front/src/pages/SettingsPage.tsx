import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Input, Select, Tag } from "antd";
import { Icon } from "../components/ui/Icon";
import { Badge, Button, Card, EmptyState } from "../components/ui/Primitives";
import { AppearanceFields } from "../components/AppShell";
import { SettingsHead } from "../components/SettingsHead";
import { useStore } from "../store/StoreContext";
import { MailAccountDrawer } from "../components/MailAccountDrawer";
import { MembersSection } from "../features/members/MembersSection";
import { ACCOUNT_URL, authFetch, useSessionUser } from "../lib/session";
import { deleteMailAccount, listMailAccounts, setMailAccountEnabled, type MailAccount } from "../data/writtenApi";

/* Same structure as hireos-jd-front's settings page: a section nav on the left, one section at a time. */
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
      { key: "mailbox", label: "Corporate mailbox" },
    ],
  },
];

export function SettingsPage() {
  const { section = "profile" } = useParams();
  const { t } = useStore();
  const navigate = useNavigate();

  return (
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
          <AppearanceFields />
          <Button onClick={resetAppearance}>{t("Reset to defaults")}</Button>
        </>
      );
    case "members":
      return <MembersSection />;
    case "mailbox":
      return <MailAccountsSection />;
    default:
      // Removed sections and unknown keys land on the profile.
      return <Navigate to="/settings/profile" replace />;
  }
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", interviewer: "Interviewer" };

/** The signed-in HireOS account (hireos-identity); the display name is shared by every subsystem. */
function ProfileSection() {
  const { state, t, set, user: demoUser } = useStore();
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

  const displayName = sessionUser?.displayName ?? demoUser.name;
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  return (
    <>
      <SettingsHead title={t("My Profile & Preferences")} scope={t("Current user")} />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="avatar-sm" style={{ background: sessionUser?.avatarColor || "#64748b", width: 40, height: 40, fontSize: 14 }}>
            {initials}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{displayName}</div>
            <div className="tiny">{sessionUser?.email ?? t("Not signed in — showing the demo role")}</div>
          </div>
        </div>
      </Card>
      {sessionUser && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>{t("Display name")}</label>
          <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
            <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
            <Button variant="primary" disabled={saving || !name.trim() || name.trim() === sessionUser.displayName} onClick={() => void saveName()}>
              {t("Save")}
            </Button>
          </div>
        </div>
      )}
      <div className="field" style={{ marginBottom: 14, maxWidth: 420 }}>
        <label>{t("Language")}</label>
        <Select
          value={state.lang}
          onChange={(lang: "en" | "zh") => set({ lang })}
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

/**
 * Ported from hireos-screening-front's "企业邮箱" (corporate mailbox) settings section — outbound
 * (SMTP-send) half only. Screening's own version also handles inbound resume import via IMAP, which
 * this app has no use for (there is no "import candidate material from email" feature here); the
 * account configured here is used purely to send real assessment invitation emails to candidates
 * (see SendToCandidateDrawer), replacing what used to be a fully simulated "(模拟)" send.
 */
function MailAccountsSection() {
  const { t } = useStore();
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null);
  const [editing, setEditing] = useState<MailAccount | null | undefined>(undefined);

  const load = () => listMailAccounts().then(setAccounts).catch(() => setAccounts([]));
  useEffect(() => {
    load();
  }, []);

  if (!accounts) return null;

  return (
    <>
      <SettingsHead title={t("Corporate mailbox")} scope={t("Workspace")} />
      <div className="tiny" style={{ marginBottom: 12 }}>
        {t("Used to send real assessment invitation emails to candidates.")}
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon="forum" title="No mailbox account connected yet." sub="Connect one to send real invitation emails instead of a simulated placeholder." />
      ) : (
        <div className="flex-col gap-12" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {accounts.map((account) => (
            <MailAccountCard key={account.id} account={account} onEdit={() => setEditing(account)} onChanged={load} />
          ))}
        </div>
      )}

      <Button size="sm" style={{ marginTop: accounts.length ? 12 : 16 }} onClick={() => setEditing(null)}>
        <Icon name="add" style={{ fontSize: 16, verticalAlign: "text-bottom" }} /> {t("Add mailbox account")}
      </Button>

      {editing !== undefined && (
        <MailAccountDrawer
          account={editing}
          onClose={() => setEditing(undefined)}
          onSaved={load}
        />
      )}
    </>
  );
}

function MailAccountCard({ account, onEdit, onChanged }: { account: MailAccount; onEdit: () => void; onChanged: () => void }) {
  const { t, say } = useStore();
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleEnabled() {
    setToggling(true);
    try {
      await setMailAccountEnabled(account.id, !account.enabled);
      onChanged();
    } catch {
      say(t("Could not update this mailbox."), { type: "danger" });
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMailAccount(account.id);
      say(t("Mailbox account removed."), { type: "success" });
      onChanged();
    } catch {
      say(t("Could not remove this mailbox."), { type: "danger" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="card card-pad" style={{ opacity: account.enabled ? 1 : 0.6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Icon name="forum" />
          <div>
            <div style={{ fontWeight: 600 }}>{account.name || account.email}</div>
            <div className="tiny">{account.email}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Badge tone={account.enabled ? "success" : "neutral"}>{account.enabled ? t("Enabled") : t("Disabled")}</Badge>
          <Button size="sm" variant="ghost" onClick={toggleEnabled} disabled={toggling}>{account.enabled ? t("Disable") : t("Enable")}</Button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
        <div className="tiny">
          {t("Provider:")} {account.provider} · {t("Status:")}{" "}
          {account.status === "connected" ? <Badge tone="success">{t("Connected")}</Badge> : <Badge tone="danger" title={account.lastError ?? undefined}>{t("Connection error")}</Badge>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={onEdit}>{t("Edit")}</Button>
          <Button size="sm" variant="danger" onClick={handleDelete} disabled={deleting}>{t("Remove")}</Button>
        </div>
      </div>
    </div>
  );
}
