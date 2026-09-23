import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, EmptyState } from "../components/ui/Primitives";
import { ATTEMPTS, CASES, CORE_CANDIDATES, EVALUATIONS, QUESTIONS, type Criterion, type Evaluation } from "../data/fixtures";

function computeOverall(criteria: Criterion[], key: "ai" | "human"): number | null {
  if (criteria.some((c) => c[key] == null)) return null;
  return Math.round(criteria.reduce((sum, c) => sum + (c[key] as number), 0));
}

export function EvaluationReviewPage() {
  const { id = "" } = useParams();
  const { t, say, state } = useStore();
  const navigate = useNavigate();
  const att = ATTEMPTS[id];
  const seedEvaluation = att ? EVALUATIONS[`eval_${att.caseId}`] : undefined;
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>(seedEvaluation);

  if (!att) return <EmptyState title="Attempt not found." />;

  const cand = CORE_CANDIDATES[CASES[att.caseId].candidateId];
  const q = QUESTIONS[att.questionId];

  if (!evaluation) {
    return (
      <div>
        <Breadcrumbs items={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]} />
        <h1 style={{ margin: "8px 0 16px" }}>{cand.name} — {q.code}</h1>
        <div className="banner warning">
          {t("No evaluation yet for")} {cand.name}. {att.status === "incomplete" ? t("This submission is incomplete — resolve the missing deliverable before scoring.") : t("Evidence has not finished processing.")}
        </div>
        <Button style={{ marginTop: 12 }} onClick={() => navigate("/submissions")}>{t("Back to Submission Inbox")}</Button>
      </div>
    );
  }

  const overallAI = computeOverall(evaluation.criteria, "ai");
  const overallHuman = computeOverall(evaluation.criteria, "human");

  function setCriterion(index: number, patch: Partial<Criterion>) {
    setEvaluation((ev) => {
      if (!ev) return ev;
      const criteria = ev.criteria.map((c, i) => (i === index ? { ...c, ...patch } : c));
      return { ...ev, criteria };
    });
  }

  function acceptAll() {
    setEvaluation((ev) => (ev ? { ...ev, criteria: ev.criteria.map((c) => ({ ...c, human: c.ai, overridden: false })) } : ev));
  }

  function finalize() {
    if (!evaluation) return;
    if (evaluation.criteria.some((c) => c.human == null)) {
      say("Set a human score for every criterion before finalizing.", { type: "danger" });
      return;
    }
    if (evaluation.criteria.some((c) => c.overridden && !c.overrideReason)) {
      say("Add an override reason for every changed score.", { type: "danger" });
      return;
    }
    const overall = computeOverall(evaluation.criteria, "human");
    setEvaluation({ ...evaluation, status: "final", finalizedBy: state.currentUser, finalizedAt: new Date().toISOString() });
    say(`Evaluation finalized. Overall: ${overall}`, { type: "success" });
    navigate(`/results/${att.caseId}/release`);
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 8, marginBottom: 4 }}>
        <h1>{cand.name} — {q.code} {t("evaluation")}</h1>
        <StatusBadge status={evaluation.status} />
      </div>

      <div className="card card-pad" style={{ marginTop: 12, marginBottom: 16 }}>
        <div className="grid-3">
          <div className="metric">
            <div className="label">{t("Overall (human)")}</div>
            <div className="value">{overallHuman == null ? <span className="badge neutral">{t("Unknown")}</span> : overallHuman}</div>
            <div className="sub">{t("Any missing required criterion → Unknown")}</div>
          </div>
          <div className="metric">
            <div className="label">{t("Overall (AI)")}</div>
            <div className="value">{overallAI == null ? "—" : overallAI}</div>
            <div className="sub">{t("Draft only, not a hiring probability")}</div>
          </div>
          <div className="metric">
            <div className="label">{t("Coverage / Confidence")}</div>
            <div className="value">{t("Full")}</div>
            <div className="sub">{t("Shown separately from score")}</div>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <h4 style={{ marginBottom: 8 }}>{t("Criteria")}</h4>
        {evaluation.criteria.map((c, i) => (
          <CriterionRow key={c.name} c={c} onChange={(patch) => setCriterion(i, patch)} />
        ))}
      </div>

      <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button onClick={acceptAll}>{t("Accept all AI scores")}</Button>
        <Button variant="ghost" onClick={() => say("AI re-run queued (demo) — no change to already-finalized scores.")}>{t("Re-run AI (demo)")}</Button>
        <Button variant="primary" onClick={finalize}>{t("Finalize evaluation")}</Button>
      </div>
    </div>
  );
}

function CriterionRow({ c, onChange }: { c: Criterion; onChange: (patch: Partial<Criterion>) => void }) {
  const { t } = useStore();
  const [humanText, setHumanText] = useState(c.human == null ? "" : String(c.human));
  const bar = Math.round(((c.human ?? c.ai) / c.max) * 100);

  function onHumanInput(v: string) {
    setHumanText(v);
    const hv = v === "" ? null : parseInt(v);
    onChange({ human: hv, overridden: hv != null && hv !== c.ai });
  }

  return (
    <div className="crit-row flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div className="flex items-center justify-between wrap gap-2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div><b>{c.name}</b> <span className="tiny">{t("max")} {c.max}</span></div>
        <div className="flex gap-2 items-center" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip">AI {c.ai}</span>
          <input className="input" style={{ width: 80, height: 32 }} type="number" min={0} max={c.max} value={humanText} placeholder={t("Human")} onChange={(e) => onHumanInput(e.target.value)} />
          <span className={`badge ${c.confidence === "High" ? "success" : "info"}`}>{t("Confidence:")} {t(c.confidence)}</span>
          <span className="badge neutral">{t("Coverage:")} {t(c.coverage)}</span>
        </div>
      </div>
      <div className="scorebar" style={{ margin: "8px 0" }}><div style={{ width: `${bar}%` }} /></div>
      <details>
        <summary style={{ cursor: "pointer", color: "var(--accent)", fontSize: "calc(var(--text-base)*.85)" }}>{t("View evidence")}</summary>
        <div className="evidence-excerpt" style={{ marginTop: 8 }}>
          {c.evidence}
          <div className="tiny" style={{ marginTop: 4 }}>{t("Source:")} {c.source}</div>
        </div>
      </details>
      {c.human != null && c.human !== c.ai && (
        <textarea
          className="input"
          rows={2}
          style={{ marginTop: 8 }}
          placeholder={t("Override reason (required — old AI value stays visible in history)")}
          value={c.overrideReason || ""}
          onChange={(e) => onChange({ overrideReason: e.target.value })}
        />
      )}
    </div>
  );
}
