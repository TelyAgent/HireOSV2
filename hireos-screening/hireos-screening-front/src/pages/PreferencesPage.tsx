import { useEffect, useState } from "react";
import { useStore } from "../store/StoreContext";
import { activateProposal, getPreferences, rejectProposal, rollbackToVersion } from "../data/api/preferences";
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
import { getPerson } from "../data/db";
import type { PreferenceLayer, PreferencesData } from "../data/fixtures/preferences";
import type { CorporateMailbox, MailboxProvider } from "../data/fixtures/corporateMailbox";
import { fmtDate, relTime, pct } from "../lib/format";
import { Badge, Button, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { Drawer, ConfirmDialog } from "../components/ui/Overlays";

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

  const validate = (): boolean => {
    if (!email.trim()) {
      say(t("Mailbox address is required."), { type: "error" });
      return false;
    }
    if (!password.trim() && !mailbox?.hasPassword) {
      say(t("An authorization code is required for the first connection."), { type: "error" });
      return false;
    }
    if (!imapHost.trim() || !smtpHost.trim()) {
      say(t("IMAP and SMTP server addresses are required."), { type: "error" });
      return false;
    }
    return true;
  };

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
            <label>{t("Mailbox address")} *</label>
            <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>{t("Authorization code")} *</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value.replace(/\s+/g, ""))}
                placeholder={mailbox?.hasPassword ? t("Already saved; leave blank to keep it") : t("Enter authorization code")}
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
                  <label>{t("IMAP host")}</label>
                  <input type="text" value={imapHost} onChange={(e) => setImapHost(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>{t("IMAP port")}</label>
                  <input type="number" value={imapPort} onChange={(e) => setImapPort(parseInt(e.target.value, 10) || 993)} />
                </div>
              </div>
              <div className="flex gap-16">
                <div className="field" style={{ flex: 1 }}>
                  <label>{t("SMTP host")}</label>
                  <input type="text" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
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
          <Button
            variant="secondary"
            size="sm"
            icon="sync"
            onClick={onSync}
            disabled={syncing || !mailbox.purposes.inbound || !enabled}
            title={mailbox.purposes.inbound ? undefined : t("Enable Inbound / Recruiting Inbox to sync")}
          >
            {t("Sync Recruiting Inbox now")}
          </Button>
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
    <div className="section-block">
      <div className="section-title">{t("Corporate mailboxes")}</div>
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

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function PrefLayerCard({ layer }: { layer: PreferenceLayer }) {
  const { t } = useStore();
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <div style={{ fontWeight: 600, fontSize: "var(--fs-sm)" }}>{layer.scope}</div>
        <Badge tone="success">{t(cap(layer.status))}</Badge>
      </div>
      {layer.pointerOnly ? (
        <p className="tiny" style={{ marginTop: 8 }}>
          {t("Points to the job’s confirmed rubric — see")} <a href="/jobs/job-a/criteria">{t("Requirements & rubric")}</a>.
        </p>
      ) : (
        <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
          {(layer.rules || []).map((r, i) => (
            <li key={i}>
              {r.feature}
              {r.weightAdjustment ? ` — ${r.weightAdjustment}` : ""}
              {r.locked && <Badge tone="outline">{t("Locked")}</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PreferencesPage() {
  const { t, state, say } = useStore();
  const [prefs, setPrefs] = useState<PreferencesData | null>(null);

  const load = () => getPreferences().then(setPrefs);
  useEffect(() => {
    load();
  }, []);

  if (!prefs) return null;

  const review = async (proposalId: string, outcome: "activated" | "rejected") => {
    if (outcome === "activated") {
      await activateProposal(proposalId, "morgan");
      say(t("New shared preference version activated"), { type: "success" });
    } else {
      await rejectProposal(proposalId);
      say(t("Proposal rejected — no change to active preferences"));
    }
    load();
  };

  const rollback = async (versionId: string) => {
    await rollbackToVersion(versionId, "morgan");
    say(t("Rolled back — a new version was created pointing at the prior configuration"), { type: "success" });
    load();
  };

  return (
    <>
      <PageHeader
        title={t("Preferences")}
        subtitle={t("Organization and Team layers govern official scoring. Personal views never change team results.")}
        crumbs={[{ label: t("Settings"), href: "/settings/preferences" }, { label: t("Preferences") }]}
      />

      <CorporateMailboxSection />

      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <PrefLayerCard layer={prefs.organization} />
        <PrefLayerCard layer={prefs.team} />
        <PrefLayerCard layer={prefs.role} />
        <PrefLayerCard layer={prefs.user} />
      </div>

      <div className="section-block" style={{ marginTop: 24 }}>
        <div className="section-title">
          {t("Feedback signals")} <span className="tiny" style={{ fontWeight: 400 }}>{t("(from shortlist/advance/override actions)")}</span>
        </div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Feature")}</th>
                <th>{t("Direction")}</th>
                <th>{t("Strength")}</th>
                <th>{t("Source")}</th>
                <th>{t("Eligibility")}</th>
              </tr>
            </thead>
            <tbody>
              {prefs.signals.map((s) => (
                <tr key={s.id}>
                  <td>{s.feature}</td>
                  <td className="tiny">{t(cap(s.direction))}</td>
                  <td>{pct(s.strength)}</td>
                  <td className="tiny">{s.source}</td>
                  <td>{s.eligibility === "eligible" ? <Badge tone="success">{t("Eligible")}</Badge> : <Badge tone="danger">{t("Prohibited — excluded")}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">
          {t("Proposed shared preferences")} <span className="tiny" style={{ fontWeight: 400 }}>{t("(pending review)")}</span>
        </div>
        <div className="card">
          {prefs.proposed.length ? (
            prefs.proposed.map((pr) => (
              <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }} key={pr.id}>
                <div className="flex items-center justify-between flex-wrap gap-8">
                  <div>
                    <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{pr.title}</div>
                    <div className="tiny">
                      {t("Basis:")} {pr.basis} · {t("Sample size")} {pr.sampleSize} · {pr.window}
                    </div>
                  </div>
                  <div className="flex gap-6">
                    {state.currentUser === "morgan" ? (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => review(pr.id, "rejected")}>
                          {t("Reject")}
                        </button>
                        <button className="btn btn-sm btn-primary" onClick={() => review(pr.id, "activated")}>
                          {t("Activate new version")}
                        </button>
                      </>
                    ) : (
                      <Badge tone="info">{t("Awaiting Admin review")}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card-pad tiny">{t("No proposals pending.")}</div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">{t("Version history")}</div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Version")}</th>
                <th>{t("Activated")}</th>
                <th>{t("By")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prefs.versions.map((v) => (
                <tr key={v.id}>
                  <td>{v.label}</td>
                  <td className="tiny">{fmtDate(v.activatedAt, "en")}</td>
                  <td className="tiny">{getPerson(v.activatedBy)?.name}</td>
                  <td className="text-right">
                    {!v.label.includes("current") && (
                      <button className="btn btn-sm btn-secondary" onClick={() => rollback(v.id)}>
                        {t("Roll back to this")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
