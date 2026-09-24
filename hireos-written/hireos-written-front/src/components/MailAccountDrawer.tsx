import { useState } from "react";
import { Drawer } from "antd";
import { useStore } from "../store/StoreContext";
import { Button } from "./ui/Primitives";
import { createMailAccount, testMailAccount, updateMailAccount, type MailAccount } from "../data/writtenApi";

interface ProviderPreset {
  label: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  helpUrl?: string;
}

// Ported from hireos-screening-front's PreferencesPage.tsx PROVIDER_PRESETS (outbound/SMTP half only
// -- this app never needs the IMAP presets, since it has no "import candidate material from email"
// feature).
const PROVIDER_PRESETS: Record<MailAccount["provider"], ProviderPreset> = {
  gmail: { label: "Gmail", smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, helpUrl: "https://support.google.com/mail/answer/185833" },
  outlook: { label: "Outlook", smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false, helpUrl: "https://support.microsoft.com/office/8361e398-8af4-4e97-b147-6c6c4ac95353" },
  qq: { label: "QQ 邮箱", smtpHost: "smtp.qq.com", smtpPort: 465, smtpSecure: true, helpUrl: "https://help.mail.qq.com/detail/106/985" },
  "163": { label: "163.com", smtpHost: "smtp.163.com", smtpPort: 465, smtpSecure: true },
  "126": { label: "126.com", smtpHost: "smtp.126.com", smtpPort: 465, smtpSecure: true },
  custom: { label: "自定义 / Custom", smtpHost: "", smtpPort: 587, smtpSecure: false },
};

export function MailAccountDrawer({
  account, onClose, onSaved,
}: {
  account: MailAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t, say } = useStore();
  const isNew = !account;

  const [name, setName] = useState(account?.name ?? "");
  const [provider, setProvider] = useState<MailAccount["provider"]>(account?.provider ?? "gmail");
  const [email, setEmail] = useState(account?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [smtpHost, setSmtpHost] = useState(account?.smtpHost ?? PROVIDER_PRESETS.gmail.smtpHost);
  const [smtpPort, setSmtpPort] = useState(account?.smtpPort ?? PROVIDER_PRESETS.gmail.smtpPort);
  const [smtpSecure, setSmtpSecure] = useState(account?.smtpSecure ?? true);
  const [showAdvanced, setShowAdvanced] = useState(provider === "custom");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: "ok" | "error"; message?: string } | null>(null);

  function applyProvider(next: MailAccount["provider"]) {
    setProvider(next);
    setTestResult(null);
    if (next === "custom") {
      setShowAdvanced(true);
      return;
    }
    const preset = PROVIDER_PRESETS[next];
    setSmtpHost(preset.smtpHost);
    setSmtpPort(preset.smtpPort);
    setSmtpSecure(preset.smtpSecure);
    setShowAdvanced(false);
  }

  function currentInput() {
    return { name: name.trim() || email.trim(), provider, email: email.trim(), smtpHost, smtpPort, smtpSecure };
  }

  function connectionInput() {
    return { email: email.trim(), smtpHost, smtpPort, smtpSecure };
  }

  async function handleTest() {
    if (!email.trim() || (!password && isNew)) {
      say(t("Enter the mailbox address and app password first."), { type: "danger" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testMailAccount({ ...connectionInput(), password: password || "" });
      setTestResult(result);
    } catch (error) {
      setTestResult({ status: "error", message: error instanceof Error ? error.message : t("Connection test failed.") });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!email.trim() || (!password && isNew)) {
      say(t("Enter the mailbox address and app password first."), { type: "danger" });
      return;
    }
    setSaving(true);
    try {
      const input = { ...currentInput(), ...(password ? { password } : {}) };
      if (isNew) {
        await createMailAccount(input as Parameters<typeof createMailAccount>[0]);
      } else {
        await updateMailAccount(account.id, input);
      }
      say(t("Mailbox account saved."), { type: "success" });
      onSaved();
      onClose();
    } catch (error) {
      say(error instanceof Error ? error.message : t("Could not save this mailbox."), { type: "danger" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open onClose={onClose} width={480} title={isNew ? t("Add mailbox account") : t("Edit mailbox account")}
      footer={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>{t("Cancel")}</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? t("Saving…") : t("Save and verify")}</Button>
        </div>
      }
    >
      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Display name")}</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("e.g. HR Recruiting")} />
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Provider")}</label>
        <select className="input" value={provider} onChange={(e) => applyProvider(e.target.value as MailAccount["provider"])}>
          {(Object.entries(PROVIDER_PRESETS) as [MailAccount["provider"], ProviderPreset][]).map(([key, preset]) => (
            <option key={key} value={key}>{preset.label}</option>
          ))}
        </select>
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("Mailbox address")}</label>
        <input className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setTestResult(null); }} placeholder="name@company.com" />
      </div>

      <div className="field" style={{ marginBottom: 16 }}>
        <label>{t("App password")}</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setTestResult(null); }}
            placeholder={isNew ? t("Required") : t("Leave blank to keep the current password")}
          />
          <Button size="sm" variant="ghost" onClick={() => setShowPassword((v) => !v)}>{showPassword ? t("Hide") : t("Show")}</Button>
        </div>
        <div className="tiny" style={{ marginTop: 4, color: "var(--text-tertiary)" }}>
          {t("This is a mailbox app password, not your normal login password.")}
          {PROVIDER_PRESETS[provider].helpUrl && (
            <> · <a href={PROVIDER_PRESETS[provider].helpUrl} target="_blank" rel="noreferrer">{t("How to get one")}</a></>
          )}
        </div>
      </div>

      <button type="button" className="btn ghost sm" style={{ paddingLeft: 0, marginBottom: 8 }} onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? t("Hide advanced SMTP settings") : t("Show advanced SMTP settings")}
      </button>
      {showAdvanced && (
        <div className="grid-2" style={{ gap: 12, marginBottom: 16 }}>
          <div className="field">
            <label>{t("SMTP host")}</label>
            <input className="input" value={smtpHost} onChange={(e) => { setSmtpHost(e.target.value); setTestResult(null); }} />
          </div>
          <div className="field">
            <label>{t("SMTP port")}</label>
            <input className="input" type="number" value={smtpPort} onChange={(e) => { setSmtpPort(parseInt(e.target.value) || 587); setTestResult(null); }} />
          </div>
          <label className="checkbox-row" style={{ cursor: "pointer", display: "flex", gridColumn: "1 / -1" }}>
            <input type="checkbox" checked={smtpSecure} onChange={(e) => { setSmtpSecure(e.target.checked); setTestResult(null); }} /> {t("Use TLS (usually port 465)")}
          </label>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Button size="sm" onClick={handleTest} disabled={testing}>{testing ? t("Testing…") : t("Test connectivity")}</Button>
        {testResult && (
          <span className={`tiny ${testResult.status === "ok" ? "" : ""}`} style={{ color: testResult.status === "ok" ? "var(--success)" : "var(--danger)" }}>
            {testResult.status === "ok" ? t("Connected successfully.") : testResult.message}
          </span>
        )}
      </div>

      <div className="banner info tiny">
        {t("Used to send real assessment invitation emails to candidates from this mailbox address.")}
      </div>
    </Drawer>
  );
}
