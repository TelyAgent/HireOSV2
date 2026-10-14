import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, EmptyState } from "../components/ui/Primitives";
import { ATTEMPTS, CASES, CORE_CANDIDATES, EVALUATIONS, QUESTIONS, RESULTS, type Criterion, type Evaluation } from "../data/fixtures";
import { finalizeCaseEvaluation } from "../data/writtenApi";
import { computeOverall } from "../utils/score";

function isValidScore(text: string, max: number): boolean {
  if (!/^\d+$/.test(text.trim())) return false;
  const n = Number(text);
  return n >= 0 && n <= max;
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
  attemptId, inline = false, onViewFinalResult, hideFinalize = false, movesCaseStatus = true, onFinalized,
}: {
  attemptId: string;
  inline?: boolean;
  onViewFinalResult?: () => void;
  hideFinalize?: boolean;
  /** False when reviewing an older round (#48): finalizing it must not move the case's status. */
  movesCaseStatus?: boolean;
  onFinalized?: () => void;
}) {
  const { t, say, state } = useStore();
  const navigate = useNavigate();
  const att = ATTEMPTS[attemptId];
  // Real rounds key their evaluation by invitation (#48); fixture attempts by case.
  const seedEvaluation = att ? EVALUATIONS[`eval_${att.invitationId ?? att.caseId}`] : undefined;
  const [evaluation, setEvaluation] = useState<Evaluation | undefined>(seedEvaluation);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!att) return <EmptyState title="Attempt not found." />;

  const cand = CORE_CANDIDATES[CASES[att.caseId].candidateId];
  const q = QUESTIONS[att.questionId] ?? { code: "—" };

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
  // Raw points, shown under the out-of-100 overall so the conversion is visible.
  const pointsMax = ev.criteria.reduce((sum, c) => sum + c.max, 0);
  const pointsHuman = ev.criteria.every((c) => c.human != null) ? ev.criteria.reduce((sum, c) => sum + (c.human as number), 0) : null;
  const pointsAI = ev.criteria.reduce((sum, c) => sum + c.ai, 0);
  const isFinalized = ev.status === "final" || !!Object.values(RESULTS).find((r) => r.evaluationId === ev.id && ["final_not_released", "published"].includes(r.status));

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
    say(t("All AI scores filled in — adjust any of them under \"Human score\" on each criterion."), { type: "success" });
  }

  function reRunAi() {
    if (ev.status === "final") {
      say(t("Already finalized — AI re-run is disabled."));
      return;
    }
    updateEvaluation((ev) => ({
      ...ev,
      criteria: ev.criteria.map((c) => {
        const delta = Math.round(Math.random() * 6 - 3);
        return { ...c, ai: Math.max(0, Math.min(c.max, c.ai + delta)) };
      }),
    }));
    say(t("AI re-run complete — AI scores refreshed."), { type: "success" });
  }

  function commitFinalize() {
    if (ev.criteria.some((c) => c.human == null)) {
      say(t("Set a human score for every criterion before finalizing."), { type: "danger" });
      return;
    }
    if (ev.criteria.some((c) => c.overridden && !c.overrideReason)) {
      say(t("Add an override reason for every changed score."), { type: "danger" });
      return;
    }
    const overall = computeOverall(ev.criteria, "human")!;
    // Real cases persist the finalized scoring so it (and the result built on it) survives a reload;
    // fixture-only demo cases have no backend row and stay in-memory only.
    if (att.id.startsWith("att_real_")) {
      finalizeCaseEvaluation(att.caseId, {
        overall,
        invitationId: att.invitationId,
        finalizedBy: state.currentUser,
        criteria: ev.criteria.map((c) => ({ name: c.name, max: c.max, ai: c.ai, human: c.human as number, overridden: c.overridden, overrideReason: c.overrideReason })),
      }).catch(() => say(t("Could not save to the server. Please refresh and try again."), { type: "danger" }));
    }
    updateEvaluation((prev) => ({ ...prev, status: "final", finalizedBy: state.currentUser, finalizedAt: new Date().toISOString() }));
    // Mirrors the backend's finalize transition so the page header updates without a reload -- only for
    // the latest round; finalizing an older round leaves the case status alone (#48).
    if (movesCaseStatus) CASES[att.caseId].status = "finalized";
    const resultKey = att.invitationId ?? att.caseId;
    RESULTS[`result_${resultKey}`] = {
      id: `result_${resultKey}`, caseId: att.caseId, evaluationId: ev.id, overall, status: "final_not_released", releaseId: null,
      invitationId: att.invitationId, round: att.round,
    };
    onFinalized?.();
    setConfirmOpen(false);
    say(`${t("Evaluation finalized. Overall:")} ${overall}`, { type: "success" });
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
            <div className="value">{overallHuman == null ? <span className="badge neutral">{t("Unknown")}</span> : <>{overallHuman}<span className="tiny"> / 100</span></>}</div>
            <div className="sub">{pointsHuman == null ? t("Any missing required criterion → Unknown") : `${t("Points:")} ${pointsHuman} / ${pointsMax} · ${t("scaled to 100")}`}</div>
          </div>
          <div className="metric">
            <div className="label">{t("Overall (AI)")}</div>
            <div className="value">{overallAI == null ? "—" : <>{overallAI}<span className="tiny"> / 100</span></>}</div>
            <div className="sub">{t("Points:")} {pointsAI} / {pointsMax} · {t("Draft only, not a hiring probability")}</div>
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
        {!isFinalized && (
          <div className="banner info tiny" style={{ marginBottom: 8 }}>
            {t("AI scores are suggestions only. Enter the final score for each criterion under \"Human score\" on the right — or use \"Accept all AI scores\" to fill them in, then adjust any of them. Every criterion needs a human score before finalizing.")}
          </div>
        )}
        {evaluation.criteria.map((c, i) => (
          <CriterionRow key={c.name} c={c} locked={isFinalized} onChange={(patch) => setCriterion(i, patch)} />
        ))}
      </div>

      <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* Once finalized the scoring is locked and the flow has moved on — no more AI actions. */}
        {!isFinalized && (
          <>
            <Button onClick={acceptAll}>{t("Accept all AI scores")}</Button>
            <Button variant="ghost" onClick={reRunAi}>{t("Re-run AI (demo)")}</Button>
          </>
        )}
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

function CriterionRow({ c, locked, onChange }: { c: Criterion; locked: boolean; onChange: (patch: Partial<Criterion>) => void }) {
  const { t } = useStore();
  const [humanText, setHumanText] = useState(c.human == null ? "" : String(c.human));
  // The input keeps its own text (so a half-typed value isn't reformatted), but a change made from
  // outside -- "Accept all AI scores" fills every human score at once -- must show up in it too.
  const [syncedHuman, setSyncedHuman] = useState(c.human);
  if (!Object.is(c.human, syncedHuman)) {
    setSyncedHuman(c.human);
    if (!Object.is(c.human, humanText !== "" && isValidScore(humanText, c.max) ? Number(humanText) : null)) setHumanText(c.human == null ? "" : String(c.human));
  }
  const bar = Math.round(((c.human ?? c.ai) / c.max) * 100);

  // Only a whole number within 0..max counts; anything else leaves the criterion unscored (so the
  // overall shows Unknown and finalizing is blocked) until it is corrected.
  const outOfRange = humanText !== "" && !isValidScore(humanText, c.max);

  function onHumanInput(v: string) {
    setHumanText(v);
    const hv = v !== "" && isValidScore(v, c.max) ? Number(v) : null;
    onChange({ human: hv, overridden: hv != null && hv !== c.ai });
  }

  return (
    <div className="crit-row flex-col" style={{ display: "flex", flexDirection: "column", alignItems: "stretch" }}>
      <div className="flex items-center justify-between wrap gap-2" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div><b>{c.name}</b> <span className="tiny">{t("max")} {c.max}</span></div>
        <div className="flex gap-2 items-center" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="chip">{t("AI suggests")} {c.ai}</span>
          {/* The human score is the one that counts -- labelled and outlined so it reads as the place to score. */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
            {t("Human score")}
            <input
              className="input"
              style={{ width: 72, height: 32, borderColor: outOfRange ? "var(--danger)" : !locked && c.human == null ? "var(--accent)" : undefined }}
              aria-invalid={outOfRange}
              type="number"
              min={0}
              max={c.max}
              step={1}
              value={humanText}
              disabled={locked}
              placeholder={t("Score")}
              onChange={(e) => onHumanInput(e.target.value)}
            />
            <span className="tiny" style={{ fontWeight: 400 }}>/ {c.max}</span>
          </label>
          {!locked && c.human !== c.ai && (
            <Button size="sm" variant="ghost" onClick={() => { setHumanText(String(c.ai)); onChange({ human: c.ai, overridden: false }); }}>
              {t("Use AI score")}
            </Button>
          )}
          <span className={`badge ${c.confidence === "High" ? "success" : "info"}`}>{t("Confidence:")} {t(c.confidence)}</span>
          <span className="badge neutral">{t("Coverage:")} {t(c.coverage)}</span>
        </div>
      </div>
      {outOfRange && (
        <div className="tiny" style={{ color: "var(--danger)", textAlign: "right", marginTop: 4 }}>
          {t("Out of range — allowed:")} 0 – {c.max} {t("(whole numbers)")}
        </div>
      )}
      <div className="scorebar" style={{ margin: "8px 0" }}><div style={{ width: `${Math.min(bar, 100)}%` }} /></div>
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
