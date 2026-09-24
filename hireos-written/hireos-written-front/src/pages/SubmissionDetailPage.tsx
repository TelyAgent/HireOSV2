import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, EmptyState } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icon";
import { ATTEMPTS, CASES, CORE_CANDIDATES, CORE_FILES, QUESTIONS, fmtDate, fmtDateShort } from "../data/fixtures";

/**
 * Ported from the prototype's pageSubmissionDetail(attId, opts) — `inline` drops the breadcrumb/title
 * (used when this is mounted as the "Submission" tab of the candidate detail page) and
 * `onGoToEvaluation` lets the caller switch tabs instead of navigating to a new route.
 */
export function SubmissionDetailContent({
  attemptId, inline = false, onGoToEvaluation,
}: {
  attemptId: string;
  inline?: boolean;
  onGoToEvaluation?: () => void;
}) {
  const { t, say } = useStore();
  const navigate = useNavigate();
  const att = ATTEMPTS[attemptId];

  if (!att) return <EmptyState title="Attempt not found." />;

  const c = CASES[att.caseId];
  const cand = CORE_CANDIDATES[c.candidateId];
  const q = QUESTIONS[att.questionId];
  const file = CORE_FILES[att.fileRef];

  return (
    <div>
      {!inline && (
        <>
          <Breadcrumbs items={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]} />
          <h1 style={{ margin: "8px 0 16px" }}>{cand.name} — {q.code} round {att.round}</h1>
        </>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <StatusBadge status={att.status} />
        <span className="tiny">{t("Received")} {fmtDate(att.receivedAt)} · {t("Processed")} {fmtDate(att.processedAt)}</span>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
          <h4 style={{ margin: 0 }}>{t("Original archive")}</h4>
          {file && (
            <Button size="sm" variant="ghost" onClick={() => say(`Download simulated (demo) — ${file.name}`)}>
              <Icon name="download" style={{ fontSize: 16 }} /> {t("Download")}
            </Button>
          )}
        </div>
        <div className="mono tiny" style={{ color: "var(--text-secondary)" }}>
          {file ? `${file.name} · v${file.versions[0].ver} · ${file.versions[0].size} · ${file.versions[0].checksum}` : "—"}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
        <div className="card-pad" style={{ paddingBottom: 8 }}>
          <h4 style={{ margin: 0 }}>{t("Deliverable files")}</h4>
        </div>
        {q.deliverables.map((d) => {
          const match = d.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
          const label = match ? match[1] : d;
          const filename = match ? match[2] : null;
          const missing = !!att.missing?.includes(d);
          return (
            <div key={d} style={{ display: "grid", gridTemplateColumns: "minmax(180px,1fr) 100px 110px minmax(150px,auto)", gap: 12, alignItems: "center", padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                <Icon name={missing ? "insert_drive_file" : "description"} style={{ fontSize: 20, color: missing ? "var(--text-tertiary)" : "var(--accent)" }} />
                <div style={{ minWidth: 0 }}>
                  <div className="task-title truncate">{filename || label}</div>
                  <div className="tiny truncate">{label}</div>
                </div>
              </div>
              <div className="tiny">{missing ? "—" : fmtDateShort(att.receivedAt)}</div>
              <div>{missing ? <span className="badge warning">{t("Missing")}</span> : <span className="badge success">{t("Received")}</span>}</div>
              <div style={{ display: "flex", gap: 8 }}>
                {!missing && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => say(`Preview simulated (demo) — ${filename || label}`)}>{t("Preview")}</Button>
                    <Button size="sm" variant="ghost" onClick={() => say(`Download simulated (demo) — ${filename || label}`)}>{t("Download")}</Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>{t("Identity & round match")}</h4>
        <div className="tiny">{t("Candidate:")} {cand.name} ({cand.email})</div>
        <div className="tiny">{t("Round:")} {att.round} · {t("Task binding: confirmed")}</div>
      </div>

      {att.status === "incomplete" ? (
        <div className="card card-pad">
          <div className="banner warning" style={{ marginBottom: 8 }}>{t("Missing")} {(att.missing || []).join(", ")}</div>
          <Button onClick={() => say("Requested missing files from candidate (demo).")}>{t("Request missing files")}</Button>
        </div>
      ) : (
        <Button variant="primary" onClick={onGoToEvaluation ?? (() => navigate(`/attempts/${att.id}/review`))}>{t("Go to evaluation →")}</Button>
      )}
    </div>
  );
}

export function SubmissionDetailPage() {
  const { id = "" } = useParams();
  return <SubmissionDetailContent attemptId={id} />;
}
