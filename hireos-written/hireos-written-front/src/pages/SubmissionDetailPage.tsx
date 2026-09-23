import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { PageHeader, Button, EmptyState } from "../components/ui/Primitives";
import { ATTEMPTS, CASES, CORE_CANDIDATES, CORE_FILES, QUESTIONS, fmtDate } from "../data/fixtures";

export function SubmissionDetailPage() {
  const { id = "" } = useParams();
  const { t, say } = useStore();
  const navigate = useNavigate();
  const att = ATTEMPTS[id];

  if (!att) return <EmptyState title="Attempt not found." />;

  const c = CASES[att.caseId];
  const cand = CORE_CANDIDATES[c.candidateId];
  const q = QUESTIONS[att.questionId];
  const file = CORE_FILES[att.fileRef];

  return (
    <div>
      <PageHeader
        title={`${cand.name} — ${q.code} round ${att.round}`}
        crumbs={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]}
      />
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <StatusBadge status={att.status} />
        <span className="tiny">{t("Processed")} {fmtDate(att.receivedAt)} · {t("Processed")} {fmtDate(att.processedAt)}</span>
      </div>

      <div className="two-col">
        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Original archive")}</h4>
          <div className="mono tiny" style={{ marginBottom: 8 }}>
            {file ? `${file.name} · v${file.versions[0].ver} · ${file.versions[0].size} · ${file.versions[0].checksum}` : "—"}
          </div>
          <div className="flex-col gap-1" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {q.deliverables.map((d) => (
              <div key={d} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span>{d}</span>
                {att.missing?.includes(d) ? <span className="badge warning">Missing</span> : <span className="badge success">{t("Received")}</span>}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card card-pad">
            <h4 style={{ marginBottom: 8 }}>{t("Identity & round match")}</h4>
            <div className="tiny">{t("Candidate:")} {cand.name} ({cand.email})</div>
            <div className="tiny">{t("Round:")} {att.round} · {t("Task binding: confirmed")}</div>
          </div>
          {att.status === "incomplete" ? (
            <div className="card card-pad">
              <div className="banner warning" style={{ marginBottom: 8 }}>Missing {(att.missing || []).join(", ")}</div>
              <Button onClick={() => say("Requested missing files from candidate (demo).")}>{t("Request missing files")}</Button>
            </div>
          ) : (
            <Button variant="primary" onClick={() => navigate(`/attempts/${att.id}/review`)}>{t("Go to evaluation →")}</Button>
          )}
        </div>
      </div>
    </div>
  );
}
