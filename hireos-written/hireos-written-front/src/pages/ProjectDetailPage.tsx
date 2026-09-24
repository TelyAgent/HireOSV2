import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Drawer, Input } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, Chip, EmptyState } from "../components/ui/Primitives";
import { planItemsForCase } from "../utils/cases";
import { CASES, CORE_APPLICATIONS, CORE_CANDIDATES, CORE_JOBS, PROJECT, QUESTIONS, RESULTS, SCREENING_POOL, fmtDateShort } from "../data/fixtures";

export function ProjectDetailPage() {
  const { id = "" } = useParams();
  const { t, say } = useStore();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [screeningOpen, setScreeningOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const job = CORE_JOBS[PROJECT.jobId];
  if (id !== PROJECT.id || !job) return <div className="banner danger">{t("Project not found.")}</div>;

  const cases = Object.values(CASES).filter(Boolean);
  const pool = SCREENING_POOL.filter((p) => p.jobId === PROJECT.jobId);

  function toggleChecked(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function createFromScreening() {
    if (checked.size === 0) { say(t("Select at least one candidate first."), { type: "danger" }); return; }
    say(`${checked.size} plan draft(s) created from Screening. Nothing sent yet.`, { type: "success" });
    setScreeningOpen(false);
    setChecked(new Set());
  }
  function createCandidate() {
    say("Candidate created in Core. Role link not yet confirmed.", { type: "success" });
    setAddOpen(false);
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Assessments", href: "/assessments" }, { label: PROJECT.name }]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <h1>{PROJECT.name}</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" onClick={() => navigate("/comparisons")}>{t("Compare candidates")}</Button>
          <Button size="sm" onClick={() => setScreeningOpen(true)}>{t("Select from screened candidates")}</Button>
          <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>{t("Add candidate")}</Button>
        </div>
      </div>
      <div className="muted" style={{ marginBottom: 16 }}>
        {job.title} · {t("Required case FIN-001 · Optional FIN-002 · Secondary role mapping demo via FIN-004/FIN-008 (Strategic Investment Associate)")}
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Candidate")}</th>
              <th>{t("Application")}</th>
              <th>{t("Plan")}</th>
              <th>{t("Status")}</th>
              <th>{t("Score")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => {
              const cand = CORE_CANDIDATES[c.candidateId];
              const items = planItemsForCase(c.id);
              const app = CORE_APPLICATIONS[c.applicationId];
              const result = Object.values(RESULTS).find((r) => r.caseId === c.id);
              return (
                <tr key={c.id} className="clickable" onClick={() => navigate(`/cases/${c.id}/plan`)}>
                  <td><b>{cand.name}</b><div className="tiny">{cand.email}</div></td>
                  <td>{app ? <Chip>{t("Confirmed link")}</Chip> : <span className="chip" style={{ color: "var(--warning)" }}>{t("Confirm the candidate's role link first")}</span>}</td>
                  <td>{items.length ? items.map((i) => <Chip key={i.id}>{QUESTIONS[i.questionId].code} {i.kind}</Chip>) : "—"}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{result ? result.overall : "—"}</td>
                  <td>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); navigate(`/cases/${c.id}/plan`); }}>{t("Open plan →")}</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Drawer open={addOpen} onClose={() => setAddOpen(false)} title={t("Add candidate")} width={420}>
        <div className="banner info" style={{ marginBottom: 16 }}>{t("A new public Candidate record is created first, then linked to this role — no per-module candidate account is created.")}</div>
        <div className="field" style={{ marginBottom: 12 }}>
          <label>{t("Full name")}</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" style={{ marginBottom: 16 }}>
          <label>{t("Email (fictional demo domain)")}</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Button variant="primary" onClick={createCandidate}>{t("Create candidate (Core)")}</Button>
      </Drawer>

      <Drawer open={screeningOpen} onClose={() => setScreeningOpen(false)} title={t("Select from screened candidates")} width={460}>
        <div className="banner info" style={{ marginBottom: 8 }}>
          {t("These candidates already have a Screening result for")} {job.title}{t(". Picking one reuses that shared record and result — no résumé re-upload or repeated role confirmation.")}
        </div>
        {pool.length === 0 ? (
          <EmptyState icon="fact_check" title="No unassigned screened candidates for this role right now." />
        ) : (
          <>
            {pool.map((p) => (
              <div
                key={p.candidateId}
                className="card card-pad"
                style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 8 }}
                onClick={() => toggleChecked(p.candidateId)}
              >
                <input type="checkbox" checked={checked.has(p.candidateId)} onChange={() => toggleChecked(p.candidateId)} onClick={(e) => e.stopPropagation()} />
                <div style={{ flex: 1 }}>
                  <b>{p.name}</b> <span className="tiny">{p.email}</span>
                  <div className="tiny">{t("Screening:")} {p.recommendation} ({p.screeningScore}/100) · {t("screened")} {fmtDateShort(p.screenedAt)}</div>
                </div>
              </div>
            ))}
            <Button variant="primary" style={{ marginTop: 8 }} onClick={createFromScreening}>{t("Create assessment plan")}</Button>
          </>
        )}
      </Drawer>
    </div>
  );
}
