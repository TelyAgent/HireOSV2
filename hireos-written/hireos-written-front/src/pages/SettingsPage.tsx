import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/ui/Icon";
import { Badge, Button, Card, EmptyState, PageHeader } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { MailAccountDrawer } from "../components/MailAccountDrawer";
import { deleteMailAccount, listMailAccounts, setMailAccountEnabled, type MailAccount } from "../data/writtenApi";

export function SettingsPage() {
  const { t } = useStore();

  return (
    <div>
      <PageHeader
        title={t("Settings")}
        actions={
          <Link className="btn sm" to="/ai-models">
            <Icon name="smart_toy" style={{ fontSize: 16 }} />
            {t("AI Models")}
          </Link>
        }
      />
      <MailAccountsSection />
    </div>
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
    <Card style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <b>{t("Corporate mailbox")}</b>
      </div>
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
    </Card>
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
