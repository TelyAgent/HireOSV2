import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { recordDecision, sendDeclineNotice, withdrawDecision, type NextStepTarget } from "../data/api/decisions";
import { getApplicationDetail } from "../data/api/screening";
import { ApiError } from "../data/api/shared";
import { db, getApplication, getCandidate, getConcerns, getJob } from "../data/db";
import type { Application } from "../data/fixtures/applications";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { Decision, DecisionOutcome } from "../data/fixtures/decisions";
import type { ConcernSeverity } from "../data/fixtures/concerns";
import { fmtDateTime } from "../lib/format";
import { inferRecommendation } from "../lib/scoring";
import { AiRecommendationBadge, Badge, Button, EligibilityBadge, EmptyState, PageHeader, RecommendationBadge, scoreDisplay, ScoreRing } from "../components/ui/Primitives";
import { recommend, recommendationDisplay } from "../lib/recommendationRule";
import { ConfirmDialog, Modal } from "../components/ui/Overlays";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { useFieldValidation } from "../lib/useFieldValidation";
import { decisionStateLabel } from "../lib/decisionState";
import { concernTitle } from "../lib/concerns";

const OUTCOME_META: Record<DecisionOutcome, { label: string; needsTarget: boolean }> = {
  strong_advance: { label: "Strong Advance", needsTarget: true },
  advance: { label: "Advance", needsTarget: true },
  hold: { label: "Hold", needsTarget: false },
  do_not_advance: { label: "Do Not Advance", needsTarget: false },
  request_information: { label: "Request Information", needsTarget: false },
};
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

type TargetChoice = "none" | "assessment" | "interview";
const TARGET_LABEL: Record<TargetChoice, string> = {
  none: "Record only (no handoff yet)",
  assessment: "Send Assessment",
  interview: "Move to Interview",
};

/** Plain-language failure for a decision submit (#23): the backend's validation message, or a network hint. */
function decisionErrorMessage(err: unknown, t: (s: string) => string) {
  if (err instanceof ApiError && !err.code.startsWith("HTTP_5") && err.code !== "HTTP_0") return `${t("The decision could not be recorded")}: ${err.message}`;
  return t("The decision could not be recorded — check your connection and retry");
}

const SEVERITY_TONE: Record<ConcernSeverity, "danger" | "warning" | "info" | "outline"> = {
  blocker: "danger",
  high: "warning",
  medium: "info",
  low: "outline",
};

/** Each open concern on its own line — type, basis, severity, status — linking to it on the detail page (#27 AC-1). */
function OpenConcernList({ applicationId }: { applicationId: string }) {
  const { t } = useStore();
  const open = getConcerns(applicationId).filter((c) => c.status === "open");
  return (
    <div className="decision-concerns">
      <div className="tiny" style={{ marginBottom: 6 }}>
        {t("Open concerns:")}
      </div>
      {open.length === 0 ? (
        <p className="tiny" style={{ margin: 0 }}>
          {t("No open concerns")}
        </p>
      ) : (
        <ul>
          {open.map((c) => (
            <li key={c.id}>
              <Link to={`/applications/${applicationId}#concern-${c.id}`}>
                <Badge tone={SEVERITY_TONE[c.severity] ?? "outline"}>{t(cap(c.severity))}</Badge>
                <span className="decision-concern-title">{c.restricted ? t("Restricted concern") : concernTitle(c.title, t)}</span>
              </Link>
              <div className="tiny">
                {t(cap(c.type.replace(/_/g, " ")))} · {t("basis:")} {t(c.basis.replace(/_/g, " "))} · {t("status:")} {t(cap(c.status))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Earlier decisions that were withdrawn stay visible as history (#23). */
function WithdrawnHistory({ decisions }: { decisions: Decision[] }) {
  const { t, state } = useStore();
  if (!decisions.length) return null;
  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="section-title">{t("Withdrawn decisions")}</div>
      {decisions.map((d) => (
        <div key={d.id} className="withdrawn-decision">
          <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
            <RecommendationBadge outcome={d.outcome} />
            <Badge tone="outline">{t("Withdrawn")}</Badge>
          </div>
          <p className="tiny">
            <strong>{t("Reason:")}</strong> {d.reason}
          </p>
          <p className="tiny">
            <strong>{t("Withdrawal reason:")}</strong> {d.withdrawReason}
          </p>
          <p className="tiny">
            {t("Withdrawn by")} {(db.people as Record<string, { name: string } | undefined>)[d.withdrawnBy ?? ""]?.name ?? d.withdrawnBy} · {d.withdrawnAt ? fmtDateTime(d.withdrawnAt, state.lang) : ""}
          </p>
        </div>
      ))}
    </div>
  );
}

function toNextStepTarget(choice: TargetChoice): NextStepTarget {
  if (choice === "assessment") return "send_assessment";
  if (choice === "interview") return "move_to_interview";
  return "record_only";
}

function AlreadyDecidedView({ app, withdrawn, onWithdrawn }: { app: Application; withdrawn: Decision[]; onWithdrawn: () => void }) {
  const { t, state, say } = useStore();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  // Snapshot: after a withdraw the cache entry is gone while this view is still mounted (it
  // re-renders on the toast before the parent swaps back to the form).
  const [decision] = useState(() => db.decisions[app.id]!);
  const cand = getCandidate(app.candidateId)!;
  const job = getJob(app.jobId)!;
  const [confirmDecline, setConfirmDecline] = useState(false);
  const decline = async () => {
    await sendDeclineNotice(app.id);
    say(t("Decline notice sent (demo) — logged independently of the decision"), { type: "success" });
  };
  const withdraw = async () => {
    if (!withdrawReason.trim()) {
      setWithdrawError(t("Explain why the decision is being withdrawn."));
      return;
    }
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdrawDecision(app.id, decision.id, withdrawReason.trim());
      say(t("Decision withdrawn — the candidate is awaiting a decision again"), { type: "success" });
      setWithdrawOpen(false);
      onWithdrawn();
    } catch (err) {
      if (err instanceof ApiError && err.code === "HANDOFF_ALREADY_SENT") {
        setWithdrawError(
          err.details.target === "written"
            ? t("Already handed off to Written — it can't be withdrawn here. Handle it in the Written subsystem.")
            : t("Already handed off to Interview — it can't be withdrawn here. Handle it in the Interview subsystem."),
        );
      } else if (err instanceof ApiError && err.code === "HANDOFF_IN_PROGRESS") {
        setWithdrawError(t("The handoff is being sent right now — try again in a moment."));
      } else if (err instanceof ApiError && err.code === "DECISION_NOT_ACTIVE") {
        setWithdrawError(t("This decision is no longer in effect — refresh the page."));
      } else {
        setWithdrawError(t("The decision could not be withdrawn — check your connection and retry"));
      }
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <>
      <PageHeader
        title={`${t("Decision —")} ${cand.displayName}`}
        subtitle={job.title}
        back={`/applications/${app.id}`}
      />
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="flex items-center gap-10" style={{ marginBottom: 8 }}>
          <RecommendationBadge outcome={decision.outcome} />
          {decision.overrideAi && <Badge tone="warning">{t("Overrides AI recommendation")}</Badge>}
        </div>
        <p style={{ fontSize: "var(--fs-sm)" }}>
          <strong>{t("Reason:")}</strong> {decision.reason}
        </p>
        <p className="tiny">
          {t("Decided by")} {db.people[decision.decidedBy]?.name} · {fmtDateTime(decision.decidedAt, state.lang)} · {t("Status:")} {t(decisionStateLabel(decision))}
        </p>
        <p className="tiny" data-testid="decision-basis">
          {t("Evaluation basis")}: {decision.evaluationId ?? t("Not recorded")} · {decision.evaluationVersion != null ? `v${decision.evaluationVersion}` : t("Not recorded")} · {decision.evaluationCompletedAt ? fmtDateTime(decision.evaluationCompletedAt, state.lang) : t("Not recorded")}
        </p>
        {decision.exceptionRef && (
          <p className="tiny" style={{ color: "var(--warning-text)" }}>
            {t("Exception approved by HR + HM to route around the required-assessment policy.")}
          </p>
        )}
        <div style={{ marginTop: 10 }}>
          <Button
            size="sm"
            variant="secondary"
            icon="undo"
            onClick={() => {
              setWithdrawReason("");
              setWithdrawError(null);
              setWithdrawOpen(true);
            }}
          >
            {t("Withdraw decision")}
          </Button>
        </div>
      </div>
      {/* What happens next (the handoff to Interview / Written Test is sent automatically; no delivery packages). */}
      <div className="card card-pad">
        <p className="tiny" style={{ marginBottom: decision.outcome === "do_not_advance" ? 10 : 0 }}>
          {decision.nextStepTarget === "move_to_interview"
            ? t("The candidate is handed off to Interview automatically.")
            : decision.nextStepTarget === "send_assessment"
              ? t("The candidate is handed off to Written Test automatically.")
              : t("Decision recorded without a downstream handoff.")}
        </p>
        {decision.outcome === "do_not_advance" && (
          <Button variant="secondary" onClick={() => setConfirmDecline(true)}>
            {t("Send candidate decline notice")}
          </Button>
        )}
      </div>
      <WithdrawnHistory decisions={withdrawn} />
      <Modal
        open={withdrawOpen}
        onClose={() => !withdrawing && setWithdrawOpen(false)}
        title={t("Withdraw decision")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setWithdrawOpen(false)} disabled={withdrawing}>
              {t("Cancel")}
            </Button>
            <Button variant="danger-solid" onClick={() => void withdraw()} disabled={withdrawing}>
              {withdrawing ? t("Withdrawing…") : t("Withdraw decision")}
            </Button>
          </>
        }
      >
        <p className="tiny" style={{ marginBottom: 12 }}>
          {t("Withdrawing cancels a handoff that hasn't been sent yet and puts the candidate back to awaiting a decision. The withdrawn decision stays in the history.")}
        </p>
        <div className="field">
          <label>{t("Withdrawal reason")}</label>
          <textarea value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} placeholder={t("Required — why is this decision being withdrawn?")} />
        </div>
        {withdrawError && (
          <div className="error-inline" role="alert">
            <span className="material-icons-o">error_outline</span>
            <div>{withdrawError}</div>
          </div>
        )}
      </Modal>
      {confirmDecline && (
        <ConfirmDialog
          open
          onClose={() => setConfirmDecline(false)}
          title={t("Send candidate decline notice")}
          body={t("This is a separate, explicit communication to the candidate. It does not change the recorded decision or any report already generated.")}
          confirmLabel={t("Send notice")}
          onConfirm={decline}
        />
      )}
    </>
  );
}

export function DecisionPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [target, setTarget] = useState<TargetChoice | null>(null);
  const [exceptionRequested, setExceptionRequested] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawn, setWithdrawn] = useState<Decision[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [conflictingDecision, setConflictingDecision] = useState<Decision | null>(null);
  const [basis, setBasis] = useState<Evaluation | null>(null);
  const fields = useFieldValidation({ reason: () => (!reason.trim() ? t("Explain the basis for this decision.") : null) });
  /** Second confirmation when a blocker concern is still open (#27 AC-2). */
  const [blockerAcknowledged, setBlockerAcknowledged] = useState(false);

  // Always read the server copy: whether a decision is in effect (and its withdrawn history)
  // can change from another tab, and the cache may be empty on a deep link.
  const load = useCallback(async () => {
    setLoadFailed(false);
    try {
      const detail = await getApplicationDetail(id);
      setWithdrawn(detail.withdrawnDecisions ?? []);
      setBasis(detail.evaluation);
      setApp(getApplication(id) ?? null);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "HTTP_404" || err.code.endsWith("NOT_FOUND"))) setApp(null);
      else setLoadFailed(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadFailed)
    return (
      <EmptyState
        icon="cloud_off"
        title={t("This page could not be loaded")}
        body={t("Check your connection and try again.")}
        actions={
          <Button variant="primary" icon="refresh" onClick={() => void load()}>
            {t("Retry")}
          </Button>
        }
      />
    );
  if (app === undefined) return <PageSkeleton />;
  if (app === null) return <EmptyState icon="search_off" title={t("Application not found")} />;
  if (db.decisions[app.id]) return <AlreadyDecidedView app={app} withdrawn={withdrawn} onWithdrawn={() => void load()} />;

  const cand = getCandidate(app.candidateId)!;
  const job = getJob(app.jobId)!;
  const ev = basis;
  const validBasis = ev?.applicationId === app.id && ev.status === "completed" && ev.freshness === "current" && Number.isSafeInteger(ev.version) && (ev.version ?? 0) > 0;
  // The same rule, with the same open concerns, as the screening detail and the workspace (#194).
  const aiRec = inferRecommendation(ev, getConcerns(app.id));

  const requiredAssessment = job.workflowPolicy?.assessmentDisposition === "required";
  const assessmentMissing = app.assessmentStatus !== "completed";
  const needsExceptionUi = target === "interview" && requiredAssessment && assessmentMissing;

  const finalize = async (exceptionApproved: boolean) => {
    if (!outcome || submitting) return;
    if (!validBasis || !ev) {
      setSubmitError(t("A completed, current screening evaluation is required for every decision. Refresh the evaluation and confirm again."));
      setConfirmOpen(false);
      return;
    }
    const overrideAi = !!aiRec && aiRec !== outcome && !(aiRec === "strong_advance" && outcome === "advance");
    setSubmitting(true);
    setSubmitError("");
    setConflictingDecision(null);
    try {
      const result = await recordDecision(app.id, {
        outcome,
        reason,
        decidedBy: state.currentUser,
        nextStepTarget: toNextStepTarget(target ?? "none"),
        overrideAi,
        exceptionApproved,
        expectedEvaluationId: ev.id,
        expectedEvaluationVersion: ev.version!,
        expectedDecisionId: withdrawn[0]?.id ?? null,
      });
      say(t(result.replayed ? "This decision was already recorded; no new decision was created." : "Decision recorded"), { type: "success" });
      setConfirmOpen(false);
      void load();
    } catch (err) {
      if (err instanceof ApiError && err.code === "DECISION_CONFLICT") {
        setSubmitError(t("Another decision or update conflicts with this submission. Your input was not submitted and is preserved below."));
        setConflictingDecision((err.details.decision as Decision | null) ?? null);
        setConfirmOpen(false);
      } else if (err instanceof ApiError && ["CURRENT_EVALUATION_REQUIRED", "EVALUATION_VERSION_CONFLICT", "DECISION_PRECONDITION_REQUIRED"].includes(err.code)) {
        setSubmitError(t(err.code === "EVALUATION_VERSION_CONFLICT"
          ? "The evaluation changed since you reviewed it. Review the current evaluation and confirm again."
          : "A completed, current screening evaluation is required for every decision. Refresh the evaluation and confirm again."));
        setConfirmOpen(false);
      } else {
        say(decisionErrorMessage(err, t), { type: "error" });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submit = () => {
    if (!outcome) return;
    if (!validBasis) {
      setSubmitError(t("A completed, current screening evaluation is required for every decision. Refresh the evaluation and confirm again."));
      return;
    }
    if (!fields.validateAll()) return;
    const meta = OUTCOME_META[outcome];
    if (meta.needsTarget && !target) {
      say(t("Choose a next-step target"), { type: "error" });
      return;
    }
    if (target === "interview" && requiredAssessment && assessmentMissing && !exceptionRequested) {
      say(t("Required assessment is missing — request an exception to proceed"), { type: "error" });
      return;
    }
    setBlockerAcknowledged(false);
    setConfirmOpen(true);
  };
  const openBlockers = getConcerns(app.id).filter((c) => c.status === "open" && c.severity === "blocker");
  const effectiveTarget: TargetChoice = OUTCOME_META[outcome ?? "hold"].needsTarget ? (target ?? "none") : "none";

  return (
    <>
      <PageHeader
        title={`${t("Decision & next steps —")} ${cand.displayName}`}
        subtitle={`${job.title} · ${t("This candidate’s decision only — Comparison and other candidates are unaffected.")}`}
        back={`/applications/${app.id}`}
      />

      {submitError && (
        <div role="alert" className="banner warning" style={{ marginBottom: 16 }}>
          <p>{submitError}</p>
          {conflictingDecision && <p>{conflictingDecision.outcome} · {conflictingDecision.reason} · {db.people[conflictingDecision.decidedBy]?.name ?? conflictingDecision.decidedBy} · {fmtDateTime(conflictingDecision.decidedAt, state.lang)}</p>}
          <Link to={`/applications/${app.id}`} target="_blank" rel="noopener noreferrer">{t("View current application in a new tab")}</Link>
          <Button icon="refresh" onClick={() => void load()}>{t("Reload evaluation")}</Button>
        </div>
      )}

      <div className="two-col" style={{ gridTemplateColumns: "340px 1fr" }}>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t("Snapshot")}
          </div>
          <div className="flex items-center gap-10" style={{ marginBottom: 8 }}>
            <ScoreRing overall={ev?.overall} size="sm" />
            <div>
              <div className="tiny">{t("Overall")}</div>
              <div style={{ fontWeight: 600 }}>{ev && scoreDisplay(ev.overall) != null ? scoreDisplay(ev.overall) : t("Insufficient evidence")}</div>
            </div>
          </div>
          <p className="tiny">
            {t("Eligibility:")} {ev ? <EligibilityBadge status={ev.eligibilityStatus} /> : "—"}
          </p>
          <p className="tiny">
            {t("AI recommendation:")} {aiRec ? <AiRecommendationBadge display={recommendationDisplay(recommend(ev, getConcerns(app.id)))} /> : "—"}
          </p>
          <p className="tiny">
            {t("Assessment:")} {app.assessmentStatus === "completed" ? t("Completed") : t("Not administered")}
          </p>
          <p className="tiny" data-testid="evaluation-basis">
            {t("Evaluation basis")}: {ev?.id ?? t("Not recorded")} · {ev?.version != null ? `v${ev.version}` : t("Not recorded")} · {ev?.completedAt ? fmtDateTime(ev.completedAt, state.lang) : t("Not recorded")}
          </p>
          <OpenConcernList applicationId={app.id} />
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Choose an outcome")}
          </div>
          <div className="flex gap-8 flex-wrap" style={{ marginBottom: 16 }}>
            {(Object.entries(OUTCOME_META) as [DecisionOutcome, (typeof OUTCOME_META)[DecisionOutcome]][]).map(([k, m]) => (
              <Button
                key={k}
                variant={outcome === k ? "primary" : "secondary"}
                onClick={() => {
                  setOutcome(k);
                  setTarget(null);
                  setExceptionRequested(false);
                }}
              >
                {t(m.label)}
              </Button>
            ))}
          </div>

          {outcome && (
            <>
              {OUTCOME_META[outcome].needsTarget && (
                <div className="field">
                  <label>{t("Next-step target")}</label>
                  <div className="flex gap-8 flex-wrap">
                    <Button size="sm" variant={target === "none" ? "primary" : "secondary"} onClick={() => setTarget("none")}>
                      {t("Record only (no handoff yet)")}
                    </Button>
                    <Button size="sm" variant={target === "assessment" ? "primary" : "secondary"} onClick={() => setTarget("assessment")}>
                      {t("Send Assessment")}
                    </Button>
                    <Button size="sm" variant={target === "interview" ? "primary" : "secondary"} onClick={() => setTarget("interview")}>
                      {t("Move to Interview")}
                    </Button>
                  </div>
                  {needsExceptionUi && (
                    <div className="error-inline" style={{ marginTop: 12, marginBottom: 4 }}>
                      <span className="material-icons-o">block</span>
                      <div>
                        {t("This job requires a completed Assessment before Interview.")}
                        <label className="checkbox-row" style={{ marginTop: 6 }}>
                          <input type="checkbox" checked={exceptionRequested} onChange={(e) => setExceptionRequested(e.target.checked)} />{" "}
                          {t("Request an exception (requires HR + HM approval)")}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="field">
                <label htmlFor={fields.labelFor("reason")}>
                  {t("Reason")}
                  <span className="required-mark">*</span>
                </label>
                <textarea {...fields.field("reason")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Explain the basis for this decision")} />
                {fields.error("reason")}
              </div>
              <Button variant="primary" onClick={submit} disabled={submitting}>
                {submitting ? t("Submitting…") : t("Submit decision")}
              </Button>
            </>
          )}
        </div>
      </div>

      <Modal
        open={confirmOpen && !!outcome}
        onClose={() => !submitting && setConfirmOpen(false)}
        title={exceptionRequested ? t("Approve exception — requires HR + HM") : t("Confirm decision")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              {t("Back to edit")}
            </Button>
            <Button variant="primary" onClick={() => void finalize(exceptionRequested)} disabled={submitting || (openBlockers.length > 0 && !blockerAcknowledged)}>
              {submitting ? t("Submitting…") : exceptionRequested ? t("Approve exception & submit") : t("Submit decision")}
            </Button>
          </>
        }
      >
        <dl className="decision-summary">
          <dt>{t("Candidate")}</dt>
          <dd>{cand.displayName}</dd>
          <dt>{t("Job")}</dt>
          <dd>{job.title}</dd>
          <dt>{t("Outcome")}</dt>
          <dd>{outcome ? t(OUTCOME_META[outcome].label) : ""}</dd>
          <dt>{t("Next step")}</dt>
          <dd>{t(TARGET_LABEL[effectiveTarget])}</dd>
          <dt>{t("Reason")}</dt>
          <dd>{reason}</dd>
        </dl>
        {openBlockers.length > 0 && (
          <div className="blocker-ack" role="alert">
            <strong>{t("This candidate still has an open blocking concern:")}</strong>
            <ul>
              {openBlockers.map((c) => (
                <li key={c.id}>
                  {c.restricted ? t("Restricted concern") : concernTitle(c.title, t)} — {t(c.basis.replace(/_/g, " "))}
                </li>
              ))}
            </ul>
            <label className="checkbox-row">
              <input type="checkbox" checked={blockerAcknowledged} onChange={(e) => setBlockerAcknowledged(e.target.checked)} />{" "}
              {t("I’ve reviewed the blocking concern and still want to submit this decision")}
            </label>
          </div>
        )}
        {exceptionRequested && (
          <p className="tiny" style={{ color: "var(--warning-text)", marginTop: 12 }}>
            {t(
              "Moving to Interview without a completed Assessment requires approval from both an HR and a Hiring Manager approver. In this demo, confirming records both approvals under this decision.",
            )}
          </p>
        )}
      </Modal>
      <WithdrawnHistory decisions={withdrawn} />
    </>
  );
}
