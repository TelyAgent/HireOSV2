import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Button, EmptyState } from "../components/ui/Primitives";
import { CASES, CORE_JOBS, PROJECT, RESULTS } from "../data/fixtures";

export function AssessmentsListPage() {
  const { t, say } = useStore();
  const navigate = useNavigate();

  const cases = Object.values(CASES).filter(Boolean);
  const job = CORE_JOBS[PROJECT.jobId];
  const otherJobs = Object.values(CORE_JOBS).filter((j) => j.id !== PROJECT.jobId);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1>{t("Assessments")}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => say("Demo: import historical assessment summary (approximate, unverified scores only).")}>{t("Import")}</Button>
          <Button size="sm" variant="primary" onClick={() => say("Demo: a target/JD-only project can be drafted with no Job or Application yet.")}>{t("Create project")}</Button>
        </div>
      </div>

      {!job && <EmptyState icon="assignment" title="No assessment projects yet." />}
      {job && (
      <div className="card card-pad" style={{ cursor: "pointer", marginBottom: 16 }} onClick={() => navigate(`/assessments/${PROJECT.id}`)}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3>{PROJECT.name}</h3>
            <div className="tiny">
              {job.title} · {t("Required:")} FIN-001 · {t("Optional:")} FIN-002 · {t("Secondary role:")} {PROJECT.secondaryRole}
            </div>
          </div>
          <StatusBadge status={PROJECT.status} />
        </div>
        <div className="divider" style={{ margin: "12px 0" }} />
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div><div className="tiny">{t("Candidates")}</div><div style={{ fontWeight: 700 }}>{cases.length}</div></div>
          <div><div className="tiny">{t("Awaiting submission")}</div><div style={{ fontWeight: 700 }}>{cases.filter((c) => c.status === "awaiting_submission").length}</div></div>
          <div><div className="tiny">{t("Issues open")}</div><div style={{ fontWeight: 700 }}>{cases.filter((c) => c.status === "issue_open").length}</div></div>
          <div><div className="tiny">{t("Results to release")}</div><div style={{ fontWeight: 700 }}>{Object.values(RESULTS).filter((r) => r.status === "final_not_released").length}</div></div>
        </div>
      </div>
      )}

      {otherJobs.length > 0 && (<>
      <h3 style={{ marginBottom: 4, marginTop: 16 }}>{t("Other open roles")}</h3>
      <div className="grid-2">
        {otherJobs.map((j) => (
          <div key={j.id} className="card card-pad">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <b>{j.title}</b>
            </div>
            <div className="tiny" style={{ margin: "4px 0 8px" }}>
              {j.sourceUrl ? (
                <a href={j.sourceUrl} target="_blank" rel="noopener noreferrer">{t("Job ID")} {j.jobRefId} ↗</a>
              ) : !j.qualityNote ? (
                <span style={{ color: "var(--warning)" }}>{t("No job link on file")}</span>
              ) : null}
            </div>
            {j.qualityNote && <div className="tiny" style={{ color: "var(--warning)", marginBottom: 8 }}>{j.qualityNote}</div>}
            <Button size="sm" onClick={() => say(`Demo: would draft a JD-only Assessment project for "${j.title}" (no Job or Application yet).`)}>{t("Draft a project from this JD")}</Button>
          </div>
        ))}
      </div>
      </>)}
    </div>
  );
}
