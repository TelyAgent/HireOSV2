import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { listCorporateMailboxes, importFromMailbox } from "../../data/api/settings";
import { ApiError } from "../../data/api/shared";
import type { CorporateMailbox } from "../../data/fixtures/corporateMailbox";
import { relTime } from "../../lib/format";
import { Icon } from "../../components/ui/Icons";
import { Badge, Button, EmptyState } from "../../components/ui/Primitives";

export function EmailTab({ onChanged }: { onChanged?: () => void }) {
  const { t, say, state } = useStore();
  const [mailboxes, setMailboxes] = useState<CorporateMailbox[] | null>(null);
  const [readingId, setReadingId] = useState<string | null>(null);

  const load = () => listCorporateMailboxes().then((rows) => setMailboxes(rows.filter((m) => m.purposes.inbound)));
  useEffect(() => {
    load();
  }, []);

  const readNow = async (mailbox: CorporateMailbox) => {
    setReadingId(mailbox.id);
    try {
      const result = await importFromMailbox(mailbox.id);
      if (result.attachmentsImported > 0) {
        say(`${mailbox.name || mailbox.email}: ${t("found")} ${result.attachmentsImported} ${t("resume attachment(s) — added to the Resume Library")}`, { type: "success" });
        onChanged?.();
      } else {
        say(`${mailbox.name || mailbox.email}: ${t("no new resume attachments found")}`, { type: "info" });
      }
    } catch (error) {
      say(error instanceof ApiError ? error.message : t("Could not read this mailbox."), { type: "error" });
    }
    setReadingId(null);
    load();
  };

  if (!mailboxes) return null;

  return (
    <div className="card card-pad">
      <div className="section-title">{t("Import from email")}</div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Reads unseen mail in the configured corporate mailbox and adds resume-looking attachments (.pdf/.doc/.docx) to the Resume Library. A message already read from is never imported again.")}
      </p>
      {mailboxes.length === 0 ? (
        <EmptyState
          icon="mail_outline"
          title={t("No mailbox enabled for inbound import")}
          body={t("Connect a corporate mailbox with inbound enabled in Settings to import resumes from email.")}
          actions={
            <Link className="btn btn-primary" to="/settings/preferences">
              {t("Go to Settings")}
            </Link>
          }
        />
      ) : (
        mailboxes.map((m) => (
          <div className="list-row" key={m.id} style={{ padding: "12px 4px" }}>
            <Icon name={m.enabled ? "mark_email_read" : "error_outline"} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{m.name || m.email}</div>
              <div className="tiny">
                {m.email} · INBOX · {t("Last read")} {m.lastSyncedAt ? relTime(m.lastSyncedAt, state.lang) : t("never")}
              </div>
            </div>
            {m.enabled ? (
              <>
                <Badge tone="success">{t("Connected")}</Badge>
                <Button variant="secondary" size="sm" onClick={() => readNow(m)} disabled={readingId === m.id}>
                  {readingId === m.id ? t("Reading…") : t("Read now")}
                </Button>
              </>
            ) : (
              <>
                <Badge tone="danger">{t("Disabled")}</Badge>
                <Link className="btn btn-sm btn-secondary" to="/settings/preferences">
                  {t("Go to Settings")}
                </Link>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
