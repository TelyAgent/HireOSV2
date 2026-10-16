import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { App as AntApp, Input, Select, Tag } from "antd";
import { useStore } from "../store/StoreContext";
import {
  listCorporateMailboxes,
  createCorporateMailbox,
  updateCorporateMailbox,
  deleteCorporateMailbox,
  setCorporateMailboxEnabled,
  testCorporateMailbox,
  syncCorporateMailbox,
  type MailboxFormInput,
  type MailboxCheck,
} from "../data/api/settings";
import { ApiError } from "../data/api/shared";
import type { CorporateMailbox, MailboxProvider } from "../data/fixtures/corporateMailbox";
import { relTime } from "../lib/format";
import { Badge, Button, EmptyState } from "../components/ui/Primitives";
import { AppearancePanel } from "../components/AppShell";
import { MembersSection } from "../features/members/MembersSection";
import { ACCOUNT_URL, authFetch, useSessionUser } from "../lib/session";
import { Icon } from "../components/ui/Icons";
import { Drawer, ConfirmDialog } from "../components/ui/Overlays";
import { WithDisabledReason } from "../components/ui/DisabledReason";
import { useFieldValidation } from "../lib/useFieldValidation";

interface ProviderPreset {
  label: string;
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  helpUrl?: string;
}

const PROVIDER_PRESETS: Record<MailboxProvider, ProviderPreset> = {
  gmail: { label: "Gmail", imapHost: "imap.gmail.com", imapPort: 993, smtpHost: "smtp.gmail.com", smtpPort: 587, smtpSecure: false, helpUrl: "https://support.google.com/mail/answer/185833" },
  outlook: { label: "Outlook", imapHost: "outlook.office365.com", imapPort: 993, smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false, helpUrl: "https://support.microsoft.com/office/8361e398-8af4-4e97-b147-6c6c4ac95353" },
  qq: { label: "QQ 邮箱", imapHost: "imap.qq.com", imapPort: 993, smtpHost: "smtp.qq.com", smtpPort: 587, smtpSecure: false, helpUrl: "https://help.mail.qq.com/detail/106/985" },
  "163": { label: "163.com", imapHost: "imap.163.com", imapPort: 993, smtpHost: "smtp.163.com", smtpPort: 465, smtpSecure: true, helpUrl: "https://help.mail.163.com/faqDetail.do?code=d7a5dc8471cd0c0e8b4b8f4f8e49998b374173cfe9171305fa1ce630d7f67ac286624f309a1a7089" },
  "126": { label: "126.com", imapHost: "imap.126.com", imapPort: 993, smtpHost: "smtp.126.com", smtpPort: 465, smtpSecure: true },
  custom: { label: "自定义 / Custom", imapHost: "", imapPort: 993, smtpHost: "", smtpPort: 587, smtpSecure: false },
};

function CorporateMailboxDrawer({
  mailbox,
  onClose,
  onSaved,
  onDeleted,
}: {
  mailbox: CorporateMailbox | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { t, say } = useStore();
  const isNew = !mailbox;
  const [name, setName] = useState(mailbox?.name || "");
  const [provider, setProvider] = useState<MailboxProvider>(mailbox?.provider || "gmail");
  const [email, setEmail] = useState(mailbox?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [imapHost, setImapHost] = useState(mailbox?.imapHost || PROVIDER_PRESETS.gmail.imapHost);
  const [imapPort, setImapPort] = useState(mailbox?.imapPort ?? PROVIDER_PRESETS.gmail.imapPort);
  const [imapTls, setImapTls] = useState(mailbox?.imapTls ?? true);
  const [smtpHost, setSmtpHost] = useState(mailbox?.smtpHost || PROVIDER_PRESETS.gmail.smtpHost);
  const [smtpPort, setSmtpPort] = useState(mailbox?.smtpPort ?? PROVIDER_PRESETS.gmail.smtpPort);
  const [smtpSecure, setSmtpSecure] = useState(mailbox?.smtpSecure ?? false);
  const [mailboxFolder, setMailboxFolder] = useState(mailbox?.mailbox || "INBOX");
  const [inbound, setInbound] = useState(mailbox?.purposes.inbound ?? true);
  const [outbound, setOutbound] = useState(mailbox?.purposes.outbound ?? true);
  const [showAdvanced, setShowAdvanced] = useState(provider === "custom");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<MailboxCheck[] | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const preset = PROVIDER_PRESETS[provider];

  const handleProviderChange = (next: MailboxProvider) => {
    setProvider(next);
    setTestResult(null);
    if (next === "custom") {
      setShowAdvanced(true);
      return;
    }
    const p = PROVIDER_PRESETS[next];
    setImapHost(p.imapHost);
    setImapPort(p.imapPort);
    setImapTls(true);
    setSmtpHost(p.smtpHost);
    setSmtpPort(p.smtpPort);
    setSmtpSecure(p.smtpSecure);
  };

  const buildInput = (): MailboxFormInput => ({
    name: name.trim() || undefined,
    provider,
    email: email.trim(),
    password: password.trim() || undefined,
    imapHost: imapHost.trim(),
    imapPort,
    imapTls,
    smtpHost: smtpHost.trim(),
    smtpPort,
    smtpSecure,
    mailbox: mailboxFolder.trim() || "INBOX",
    purposes: { inbound, outbound },
  });

  // The saved code belongs to the server and account it was saved for (#125 #127): changing either needs it again.
  const same = (x: string | undefined, y: string) => (x ?? "").trim().toLowerCase() === y.trim().toLowerCase();
  const connectionChanged = !!mailbox && (
    !same(mailbox.email, email) || !same(mailbox.imapHost, imapHost) || !same(mailbox.smtpHost, smtpHost)
    || mailbox.imapPort !== imapPort || mailbox.smtpPort !== smtpPort || mailbox.imapTls !== imapTls || mailbox.smtpSecure !== smtpSecure
  );

  // Each field reports its own problem next to it (#26 AC-1); a failed save focuses the first one.
  const fields = useFieldValidation({
    email: () => (!email.trim() ? t("Mailbox address is required.") : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t("Enter a valid email address.") : null),
    password: () =>
      password.trim()
        ? null
        : !mailbox?.hasPassword
          ? t("An authorization code is required for the first connection.")
          : connectionChanged
            ? t("The server or account changed — enter the authorization code again. The saved one is only used for the server it was saved for.")
            : null,
    imapHost: () => (!imapHost.trim() ? t("IMAP server address is required.") : null),
    smtpHost: () => (!smtpHost.trim() ? t("SMTP server address is required.") : null),
  });
  const validate = (): boolean =>
    fields.validateAll((key) => {
      // Server fields live in the collapsed "advanced" section; open it so the error can be seen.
      if (key === "imapHost" || key === "smtpHost") setShowAdvanced(true);
    });

  const handleTest = async () => {
    if (!validate()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testCorporateMailbox(buildInput(), mailbox?.id);
      setTestResult(result.checks);
      if (result.verdict !== "pass") say(t("Connectivity test failed — see details below."), { type: "error" });
      else say(t("Connectivity test passed"), { type: "success" });
    } catch (error) {
      say(error instanceof ApiError ? error.message : t("Could not test this mailbox."), { type: "error" });
    }
    setTesting(false);
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (isNew) await createCorporateMailbox(buildInput());
      else await updateCorporateMailbox(mailbox.id, buildInput());
      say(t("Corporate mailbox saved and verified"), { type: "success" });
      onSaved();
    } catch (error) {
      if (error instanceof ApiError && (error.code === "CREDENTIALS_REQUIRED" || error.code === "MAILBOX_VERIFICATION_FAILED")) {
        say(error.message, { type: "error" });
      } else {
        say(t("Could not save the corporate mailbox."), { type: "error" });
      }
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!mailbox) return;
    setDeleting(true);
    try {
      await deleteCorporateMailbox(mailbox.id);
      say(t("Corporate mailbox removed"), { type: "success" });
      onDeleted();
    } catch {
      say(t("Could not remove this mailbox."), { type: "error" });
    }
    setDeleting(false);
  };

  return (
    <>
    <Drawer
      open
      onClose={onClose}
      title={isNew ? t("Add corporate mailbox") : t("Configure corporate mailbox")}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting} style={{ marginRight: "auto" }}>
              {t("Delete")}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {t("Save and verify")}
          </Button>
        </>
      }
    >
      <div className="card-pad">
        <p className="tiny" style={{ marginBottom: 16 }}>
          {t("Credentials are submitted to secure server-side storage only — they are never shown again after saving.")}
        </p>
        <div className="flex gap-16">
          <div className="field" style={{ flex: 1 }}>
            <label>{t("Account name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. Recruiting mailbox")} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t("Mailbox provider")}</label>
            <select value={provider} onChange={(e) => handleProviderChange(e.target.value as MailboxProvider)}>
              {(Object.keys(PROVIDER_PRESETS) as MailboxProvider[]).map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_PRESETS[p].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-16">
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={fields.labelFor("email")}>
              {t("Mailbox address")}
              <span className="required-mark">*</span>
            </label>
            <input type="text" {...fields.field("email")} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
            {fields.error("email")}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label htmlFor={fields.labelFor("password")}>
              {t("Authorization code")}
              {(!mailbox?.hasPassword || connectionChanged) && <span className="required-mark">*</span>}
            </label>
            <div style={{ position: "relative" }}>
              <input
                {...fields.field("password", { required: !mailbox?.hasPassword || connectionChanged })}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\s+/g, ""))}
                placeholder={mailbox?.hasPassword && !connectionChanged ? t("Already saved; leave blank to keep it") : t("Enter authorization code")}
                style={{ paddingRight: 34 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? t("Hide") : t("Show")}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 4, color: "var(--text-secondary)" }}
              >
                <Icon name={showPassword ? "visibility_off" : "visibility"} size={16} />
              </button>
            </div>
            {fields.error("password")}
          </div>
        </div>
        <div className="card-pad" style={{ background: "var(--info-bg, #eff6ff)", borderRadius: 8, marginBottom: 16 }}>
          <p className="tiny" style={{ margin: 0 }}>
            {t("If two-factor authentication is enabled, use an app-specific password (App Password), not your regular mailbox login password.")}
          </p>
          {preset.helpUrl && (
            <a href={preset.helpUrl} target="_blank" rel="noreferrer" className="tiny" style={{ display: "inline-block", marginTop: 4 }}>
              {t("How to enable IMAP/SMTP and get an authorization code")} ↗
            </a>
          )}
        </div>

        <div>
          <button type="button" className="btn btn-text btn-sm" onClick={() => setShowAdvanced(!showAdvanced)} style={{ paddingLeft: 0 }}>
            <Icon name={showAdvanced ? "expand_more" : "chevron_right"} size={16} />
            {t("Advanced settings")}
          </button>
          {showAdvanced && (
            <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: 12, marginTop: 8, marginBottom: 8 }}>
              <div className="flex gap-16">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor={fields.labelFor("imapHost")}>
                    {t("IMAP host")}
                    <span className="required-mark">*</span>
                  </label>
                  <input type="text" {...fields.field("imapHost")} value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                  {fields.error("imapHost")}
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t("IMAP port")}</label>
                  <input type="number" value={imapPort} onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)} />
                </div>
              </div>
              <div className="flex gap-16">
                <div className="field" style={{ flex: 1 }}>
                  <label htmlFor={fields.labelFor("smtpHost")}>
                    {t("SMTP host")}
                    <span className="required-mark">*</span>
                  </label>
                  <input type="text" {...fields.field("smtpHost")} value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
                  {fields.error("smtpHost")}
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t("SMTP port")}</label>
                  <input type="number" value={smtpPort} onChange={(e) => setSmtpPort(parseInt(e.target.value, 10) || 587)} />
                </div>
              </div>
              <div className="field">
                <label>{t("Mailbox folder to read")}</label>
                <input type="text" value={mailboxFolder} onChange={(e) => setMailboxFolder(e.target.value)} />
              </div>
              <label className="flex items-center gap-8" style={{ marginBottom: 8, fontSize: "var(--fs-sm)" }}>
                <input type="checkbox" checked={imapTls} onChange={(e) => setImapTls(e.target.checked)} /> IMAP TLS
              </label>
              <label className="flex items-center gap-8" style={{ fontSize: "var(--fs-sm)" }}>
                <input type="checkbox" checked={smtpSecure} onChange={(e) => setSmtpSecure(e.target.checked)} /> SMTP SSL
              </label>
            </div>
          )}
        </div>

        <div className="field" style={{ marginTop: 16 }}>
          <label>{t("Mailbox purposes")}</label>
          <div className="list-row" style={{ padding: "8px 2px" }}>
            <input type="checkbox" checked={inbound} onChange={(e) => setInbound(e.target.checked)} />
            <div>{t("Used for inbound / Recruiting Inbox")}</div>
          </div>
          <div className="list-row" style={{ padding: "8px 2px" }}>
            <input type="checkbox" checked={outbound} onChange={(e) => setOutbound(e.target.checked)} />
            <div>{t("Used for outbound / Outbound Email")}</div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 8 }}>
          <Button variant="secondary" size="sm" icon="wifi_tethering" onClick={handleTest} disabled={testing}>
            {testing ? t("Testing…") : t("Test connectivity")}
          </Button>
          {testResult && (
            <div className="flex gap-8 flex-wrap" style={{ marginTop: 10 }}>
              {testResult.map((check) => (
                <div
                  key={check.code}
                  className="tiny"
                  style={{
                    flex: "1 1 200px",
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${check.level === "pass" ? "var(--success-border, #86efac)" : "var(--danger-border, #fca5a5)"}`,
                    background: check.level === "pass" ? "var(--success-bg, #f0fdf4)" : "var(--danger-bg, #fef2f2)",
                  }}
                >
                  <div style={{ fontWeight: 600 }}>
                    {check.code.toUpperCase()} {check.level === "pass" ? "✓" : "✗"}
                  </div>
                  <div>{check.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
    {confirmingDelete && (
      <ConfirmDialog
        open
        onClose={() => setConfirmingDelete(false)}
        title={t("Remove corporate mailbox")}
        body={t("This removes the saved connection. It doesn't affect anything already synced.")}
        confirmLabel={t("Delete")}
        danger
        onConfirm={handleDelete}
      />
    )}
    </>
  );
}

function MailboxCard({ mailbox, onEdit, onSync, syncing }: { mailbox: CorporateMailbox; onEdit: () => void; onSync: () => void; syncing: boolean }) {
  const { t, say, state } = useStore();
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(mailbox.enabled);

  const toggleEnabled = async () => {
    setToggling(true);
    try {
      const updated = await setCorporateMailboxEnabled(mailbox.id, !enabled);
      setEnabled(updated.enabled);
    } catch {
      say(t("Could not update this mailbox."), { type: "error" });
    }
    setToggling(false);
  };

  const purposeCount = (mailbox.purposes.inbound ? 1 : 0) + (mailbox.purposes.outbound ? 1 : 0);

  return (
    <div className="card card-pad" style={{ opacity: enabled ? 1 : 0.6 }}>
      <div className="flex items-center justify-between flex-wrap gap-8">
        <div className="flex items-center gap-12">
          <Icon name="forum" />
          <div>
            <div style={{ fontWeight: 600 }}>{mailbox.name || mailbox.email}</div>
            <div className="tiny">
              {mailbox.email} · {purposeCount} {t("purposes enabled")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <Badge tone={enabled ? "success" : "outline"}>{enabled ? t("Active") : t("Disabled")}</Badge>
          <Button variant="secondary" size="sm" onClick={toggleEnabled} disabled={toggling}>
            {enabled ? t("Disable") : t("Enable")}
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-8" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
        <div className="tiny">
          {t("Provider:")} {PROVIDER_PRESETS[mailbox.provider!].label} &nbsp;·&nbsp; {t("Inbound:")}{" "}
          <Badge tone={mailbox.purposes.inbound ? "success" : "outline"}>{mailbox.purposes.inbound ? t("Enabled") : t("Disabled")}</Badge> &nbsp;·&nbsp; {t("Outbound:")}{" "}
          <Badge tone={mailbox.purposes.outbound ? "success" : "outline"}>{mailbox.purposes.outbound ? t("Enabled") : t("Disabled")}</Badge>
          {mailbox.lastSyncedAt && (
            <>
              {" "}
              &nbsp;·&nbsp; {t("Last synced")} {relTime(mailbox.lastSyncedAt, state.lang)}
              {typeof mailbox.lastSyncMessageCount === "number" && ` (${mailbox.lastSyncMessageCount} ${t("messages in inbox")})`}
            </>
          )}
        </div>
        <div className="flex gap-8">
          <WithDisabledReason reason={!enabled ? t("This mailbox is disabled — enable it to sync.") : !mailbox.purposes.inbound ? t("Enable Inbound / Recruiting Inbox to sync") : null}>
            <Button
              variant="secondary"
              size="sm"
              icon="sync"
              onClick={onSync}
              disabled={syncing || !mailbox.purposes.inbound || !enabled}
            >
              {t("Sync Recruiting Inbox now")}
            </Button>
          </WithDisabledReason>
          <Button variant="icon" onClick={onEdit} aria-label={t("Configure corporate mailbox")}>
            <Icon name="settings" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CorporateMailboxSection() {
  const { t, say } = useStore();
  const [mailboxes, setMailboxes] = useState<CorporateMailbox[] | null>(null);
  const [editing, setEditing] = useState<CorporateMailbox | null | undefined>(undefined);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const load = () => listCorporateMailboxes().then(setMailboxes);
  useEffect(() => {
    load();
  }, []);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const result = await syncCorporateMailbox(id);
      const count = result.lastSyncMessageCount ?? 0;
      say(`${t("Recruiting inbox synced")} — ${count} ${t("messages in inbox")}`, { type: "success" });
    } catch (error) {
      say(error instanceof ApiError ? error.message : t("Could not sync the inbox."), { type: "error" });
    }
    setSyncingId(null);
    load();
  };

  if (!mailboxes) return null;

  return (
    <div>
      <SettingsHead title={t("Corporate mailboxes")} scope={t("Workspace")} />
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("Used for recruiting inbound mail, candidate material import, and confirmed outbound email.")}
      </p>
      <div className="flex-col gap-12">
        {mailboxes.map((mailbox) => (
          <MailboxCard key={mailbox.id} mailbox={mailbox} onEdit={() => setEditing(mailbox)} onSync={() => handleSync(mailbox.id)} syncing={syncingId === mailbox.id} />
        ))}
        {mailboxes.length === 0 && (
          <div className="card card-pad">
            <EmptyState
              icon="forum"
              title={t("No corporate mailbox connected")}
              body={t("Connect a shared mailbox to enable inbound recruiting mail and confirmed outbound email.")}
              actions={
                <Button variant="primary" onClick={() => setEditing(null)}>
                  {t("Configure")}
                </Button>
              }
            />
          </div>
        )}
        {mailboxes.length > 0 && (
          <Button variant="secondary" icon="add" onClick={() => setEditing(null)} style={{ alignSelf: "flex-start" }}>
            {t("Add mailbox account")}
          </Button>
        )}
      </div>
      {editing !== undefined && (
        <CorporateMailboxDrawer
          mailbox={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
          onDeleted={() => {
            setEditing(undefined);
            load();
          }}
        />
      )}
    </div>
  );
}

/* Same structure as the JD / Written settings pages: a section nav on the left, one section at a time. */
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
      { key: "mailbox", label: "Corporate mailboxes" },
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
    case "mailbox":
      return <CorporateMailboxSection />;
    default:
      // Old links (/settings/preferences, /settings/ai-models) and unknown keys land on the profile.
      return <Navigate to="/settings/profile" replace />;
  }
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", hr: "HR", interviewer: "Interviewer" };

/** The signed-in HireOS account (hireos-identity); same section as the JD / Written settings pages. */
function ProfileSection() {
  const { state, t, set, person } = useStore();
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
          onChange={(lang: "en" | "zh") => set({ lang })}
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
