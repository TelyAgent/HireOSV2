import { useState } from "react";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Button, Card } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, MAIL, fmtDate, timeAgo, type Mail } from "../data/fixtures";

const GROUPS: { key: string; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "incomplete", label: "Incomplete" },
  { key: "needs_confirmation", label: "Needs confirmation" },
  { key: "quarantined", label: "Quarantined" },
  { key: "duplicate", label: "Duplicate" },
];

function candidateOfMail(m: Mail) {
  if (!m.caseId) return null;
  const c = CASES[m.caseId];
  return c ? CORE_CANDIDATES[c.candidateId] : null;
}

export function SubmissionInboxPage() {
  const { state, t, say } = useStore();
  const [mail, setMail] = useState(MAIL);
  const [open, setOpen] = useState<Mail | null>(null);

  function confirmAssignment(m: Mail) {
    setMail((rows) => ({ ...rows, [m.id]: { ...rows[m.id], classification: "submitted", threadStatus: "Confirmed by reviewer" } }));
    say("Assignment confirmed by reviewer.", { type: "success" });
    setOpen(null);
  }
  function notAMatch() {
    say("Marked as not matching any open case.");
    setOpen(null);
  }
  function requestMissing() {
    say("Request sent to candidate (demo) — Task remains waiting until resolved.");
    setOpen(null);
  }

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t("Submission Inbox")}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>
        {t("Task and status match first; email plumbing (Message-ID, DKIM/SPF, hash) lives in Details for Operations.")}
      </div>

      {GROUPS.map((g) => {
        const items = Object.values(mail).filter((m) => m.classification === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key}>
            <h4 style={{ margin: "16px 0 8px" }}>{t(g.label)} ({items.length})</h4>
            <Card padded={false}>
              {items.map((m) => {
                const cand = candidateOfMail(m);
                return (
                  <div key={m.id} className="task-row" style={{ cursor: "pointer" }} onClick={() => setOpen(m)}>
                    <div className="task-main">
                      <div className="task-title">
                        {cand ? cand.name : t("Unknown sender")} <span className="tiny mono">{m.from}</span>
                      </div>
                      <div className="task-sub">{m.subject} · {timeAgo(m.receivedAt, state.clockOffsetMin)} · {m.matchReason}</div>
                    </div>
                    <StatusBadge status={m.classification} />
                  </div>
                );
              })}
            </Card>
          </div>
        );
      })}

      <Modal open={!!open} onCancel={() => setOpen(null)} footer={null} title={open?.subject} width={520}>
        {open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Card>
              <div><b>{t("From")}</b> {open.from}</div>
              <div><b>{t("Received")}</b> {fmtDate(open.receivedAt)} {t("(trusted receipt time)")}</div>
              <div><b>{t("Match")}</b> {open.matchReason}</div>
            </Card>
            <Card>
              <h4 style={{ marginBottom: 8 }}>{t("Attachments")}</h4>
              {open.attachments.length ? (
                open.attachments.map((a) => (
                  <div key={a} style={{ marginBottom: 4 }}>
                    <span className="material-icons-o" style={{ fontSize: 15, verticalAlign: "text-bottom", color: "var(--text-tertiary)" }}>attach_file</span> {a}
                  </div>
                ))
              ) : (
                <div className="muted">{t("None")}</div>
              )}
            </Card>
            {open.classification === "incomplete" && (
              <>
                <div className="banner warning">{t("Missing:")} {(open.missing || []).join(", ")}</div>
                <Button onClick={requestMissing}>{t("Request missing files")}</Button>
              </>
            )}
            {open.classification === "needs_confirmation" && (
              <>
                <div className="banner warning">{open.matchReason} — {t("do not auto-confirm on subject/name alone.")}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variant="primary" onClick={() => confirmAssignment(open)}>{t("Confirm assignment")}</Button>
                  <Button variant="ghost" onClick={notAMatch}>{t("Not a match")}</Button>
                </div>
              </>
            )}
            {open.classification === "quarantined" && (
              <div className="banner danger">{t("Sender authentication failed and attachment type is restricted (macro-enabled). Held for Operations review — not auto-processed.")}</div>
            )}
            <details className="tiny" style={{ marginTop: 8 }}>
              <summary style={{ cursor: "pointer" }}>{t("Technical details")}</summary>
              <div className="mono" style={{ marginTop: 6 }}>
                mail_id: {open.id}<br />auth_status: {open.authStatus}<br />thread_ref: thr_{open.id}
              </div>
            </details>
          </div>
        )}
      </Modal>
    </div>
  );
}
