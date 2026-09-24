import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, EmptyState } from "../components/ui/Primitives";
import { ATTEMPTS, CASES, CORE_CANDIDATES, EVALUATIONS, QUESTIONS, RESULTS, type Criterion, type Evaluation } from "../data/fixtures";

function computeOverall(criteria: Criterion[], key: "ai" | "human"): number | null {
  if (criteria.some((c) => c[key] == null)) return null;
  return Math.round(criteria.reduce((sum, c) => sum + (c[key] as number), 0));
}

/**
 * Ported from the prototype's pageEvaluationReview(attId, opts). `inline` drops the breadcrumb (used
 * inside the candidate detail page's "Comprehensive evaluation" tab); `onViewFinalResult` lets the
 * caller switch to the Result tab instead of navigating away; `hideFinalize` hides the finalize button
 * entirely (the prototype uses this when this content is itself embedded inside a confirm drawer).
 *
 * Finalizing writes the new Evaluation/Result back onto the shared EVALUATIONS/RESULTS module objects
 * (not just this component's own state) so the sibling "Evaluation result" tab — which reads those
 * same objects fresh on every render — picks the change up immediately without a page reload.
 */
export function EvaluationReviewContent({
  attemptId, inline = false, onViewFinalResult, hideFinalize = false,
}: {
  attemptId: string;
  inline?: boolean;
  onViewFinalResult?: () => void;
  hideFinalize?: boolean;
}) {
  const { t, say, state } = useStore();
  const navigate = useNavigate();
  const att = ATTEMPTS[attemptId];
  const seedEvaluation = att ? EVALUATIONS[`eval_${att.caseId}`] : undefined;
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>(seedEvaluation);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!att) return <EmptyState title="Attempt not found." />;

  const cand = CORE_CANDIDATES[CASES[att.caseId].candidateId];
  const q = QUESTIONS[att.questionId];

  if (!evaluation) {
    return (
      <div>
        {!inline && <Breadcrumbs items={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]} />}
        {!inline && <h1 style={{ margin: "8px 0 16px" }}>{cand.name} — {q.code}</h1>}
        <div className="banner warning">
          {t("No evaluation yet for")} {cand.name}. {att.status === "incomplete" ? t("This submission is incomplete — resolve the missing deliverable before scoring.") : t("Evidence has not finished processing.")}
        </div>
        {!inline && <Button style={{ marginTop: 12 }} onClick={() => navigate("/submissions")}>{t("Back to Submission Inbox")}</Button>}
      </div>
    );
  }

  const ev = evaluation; // narrowed non-null, for the closures below (TS doesn't carry the early-return narrowing into nested function scopes)
  const overallAI = computeOverall(ev.criteria, "ai");
  const overallHuman = computeOverall(ev.criteria, "human");
  const isFinalized = ev.status === "final" || !!Object.values(RESULTS).find((r) => r.caseId === att.caseId && ["final_not_released", "published"].includes(r.status));

  function updateEvaluation(updater: (ev: Evaluation) => Evaluation) {
    setEvaluation((ev) => {
      if (!ev) return ev;
      const next = updater(ev);
      EVALUATIONS[next.id] = next;
      return next;
    });
  }

  function setCriterion(index: number, patch: Partial<Criterion>) {
    updateEvaluation((ev) => ({ ...ev, criteria: ev.criteria.map((c, i) => (i === index ? { ...c, ...patch } : c)) }));
  }

  function acceptAll() {
    updateEvaluation((ev) => ({ ...ev, criteria: ev.criteria.map((c) => ({ ...c, human: c.ai, overridden: false })) }));
    say("All AI scores accepted.", { type: "success" });
  }

  function reRunAi() {
    if (ev.status === "final") {
      say("Already finalized — AI re-run is disabled.");
      return;
    }
    updateEvaluation((ev) => ({
      ...ev,
      criteria: ev.criteria.map((c) => {
        const delta = Math.round(Math.random() * 6 - 3);
        return { ...c, ai: Math.max(0, Math.min(c.max, c.ai + delta)) };
      }),
    }));
    say("AI re-run complete — AI scores refreshed.", { type: "success" });
  }

  function commitFinalize() {
    if (ev.criteria.some((c) => c.human == null)) {
      say("Set a human score for every criterion before finalizing.", { type: "danger" });
      return;
    }
    if (ev.criteria.some((c) => c.overridden && !c.overrideReason)) {
      say("Add an override reason for every changed score.", { type: "danger" });
      return;
    }
    const overall = computeOverall(ev.criteria, "human")!;
    updateEvaluation((prev) => ({ ...prev, status: "final", finalizedBy: state.currentUser, finalizedAt: new Date().toISOString() }));
    RESULTS[`result_${att.caseId}`] = { id: `result_${att.caseId}`, caseId: att.caseId, evaluationId: ev.id, overall, status: "final_not_released", releaseId: null };
    setConfirmOpen(false);
    say(`Evaluation finalized. Overall: ${overall}`, { type: "success" });
    if (onViewFinalResult) onViewFinalResult();
    else navigate(`/results/${att.caseId}/release`);
  }

  function onFinalizeClick() {
    if (isFinalized) {
      if (onViewFinalResult) onViewFinalResult();
      else navigate(`/results/${att.caseId}/release`);
      return;
    }
    if (!inline) {
      commitFinalize();
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div>
      {!inline && <Breadcrumbs items={[{ label: "Submission Inbox", href: "/submissions" }, { label: cand.name }]} />}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 8, marginBottom: 4 }}>
        {!inline && <h1>{cand.name} — {q.code} {t("evaluation")}</h1>}
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
        <Button variant="ghost" disabled={evaluation.status === "final"} onClick={reRunAi}>{t("Re-run AI (demo)")}</Button>
        {!hideFinalize && (
          <Button variant="primary" onClick={onFinalizeClick}>{t(isFinalized ? "View final result" : "Finalize evaluation")}</Button>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onOk={commitFinalize}
        title={t("Confirm finalize")}
        okText={t("Confirm finalize")}
      >
        <div className="tiny" style={{ marginBottom: 8 }}>{cand.name} · {q.code}</div>
        <div>{t("Overall (human)")}: <b>{overallHuman == null ? t("Unknown") : overallHuman}</b></div>
        <div className="tiny" style={{ marginTop: 8 }}>{t("This locks the scores in and creates a result ready to publish.")}</div>
      </Modal>
    </div>
  );
}

export function EvaluationReviewPage() {
  const { id = "" } = useParams();
  return <EvaluationReviewContent attemptId={id} />;
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
