import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { generateReviewOnlyReport, recordDecision, sendDeclineNotice, type NextStepTarget } from "../data/api/decisions";
import { findTaskForApplication, claimTask } from "../data/api/tasks";
import { isRealApi } from "../data/api/shared";
import { db, getApplication, getCandidate, getConcerns, getEvaluation, getJob } from "../data/db";
import type { Application } from "../data/fixtures/applications";
import type { DecisionOutcome } from "../data/fixtures/decisions";
import { fmtDateTime } from "../lib/format";
import { inferRecommendation } from "../lib/scoring";
import { Badge, Button, EligibilityBadge, EmptyState, PageHeader, RecommendationBadge, ScoreRing, scoreDisplay } from "../components/ui/Primitives";
import { ConfirmDialog } from "../components/ui/Overlays";

const OUTCOME_META: Record<DecisionOutcome, { label: string; needsTarget: boolean }> = {
  strong_advance: { label: "Strong Advance", needsTarget: true },
  advance: { label: "Advance", needsTarget: true },
  hold: { label: "Hold", needsTarget: false },
  do_not_advance: { label: "Do Not Advance", needsTarget: false },
  request_information: { label: "Request Information", needsTarget: false },
};
const DELIVERY_KIND_LABEL: Record<string, string> = {
  create_assessment: "Send Assessment",
  create_interview: "Move to Interview",
  review_only: "Review-only report",
};
const DELIVERY_STATUS_LABEL: Record<string, string> = {
  prepared: "Package ready",
  queued: "Queued",
  submitted: "Submitted",
  delivered: "Delivered",
  awaiting_confirmation: "Delivered — awaiting confirmation",
  failed: "Failed",
  received: "Received / Imported",
};
const DELIVERY_STATUS_TONE: Record<string, "outline" | "info" | "success" | "warning" | "danger"> = {
  prepared: "outline",
  queued: "info",
  submitted: "info",
  delivered: "success",
  awaiting_confirmation: "warning",
  failed: "danger",
  received: "success",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

type TargetChoice = "none" | "assessment" | "interview";
function toNextStepTarget(choice: TargetChoice): NextStepTarget {
  if (choice === "assessment") return "send_assessment";
  if (choice === "interview") return "move_to_interview";
  return "record_only";
}

function AlreadyDecidedView({ app }: { app: Application }) {
  const { t, say } = useStore();
  const decision = db.decisions[app.id]!;
  const cand = getCandidate(app.candidateId)!;
  const job = getJob(app.jobId)!;
  const delivery = db.deliveries.find((d) => d.applicationId === app.id);

  const generateReport = async () => {
    const d = await generateReviewOnlyReport(app.id);
    say(t("Review-only report generated"), { type: "success" });
    window.location.assign(`/deliveries/${d.id}`);
  };
  const [confirmDecline, setConfirmDecline] = useState(false);
  const decline = async () => {
    await sendDeclineNotice(app.id);
    say(t("Decline notice sent (demo) — logged independently of the decision"), { type: "success" });
  };

  return (
    <>
      <PageHeader
        title={`${t("Decision —")} ${cand.displayName}`}
        subtitle={job.title}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title, href: `/jobs/${job.id}/screening` }, { label: cand.displayName, href: `/applications/${app.id}` }, { label: t("Decision") }]}
        actions={
          <Link className="btn btn-secondary" to={`/applications/${app.id}`}>
            {t("Back to screening")}
          </Link>
        }
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
          {t("Decided by")} {db.people[decision.decidedBy]?.name} · {fmtDateTime(decision.decidedAt, "en")} · {t("Status:")} {t(cap(decision.status.replace(/_/g, " ")))}
        </p>
        {decision.exceptionRef && (
          <p className="tiny" style={{ color: "var(--warning-text)" }}>
            {t("Exception approved by HR + HM to route around the required-assessment policy.")}
          </p>
        )}
      </div>
      {delivery ? (
        <div className="card card-pad">
          <div className="section-title">{t("Package & delivery")}</div>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            {t(DELIVERY_KIND_LABEL[delivery.kind] || delivery.kind)} · <Badge tone={DELIVERY_STATUS_TONE[delivery.status]}>{t(DELIVERY_STATUS_LABEL[delivery.status] || delivery.status)}</Badge>
          </p>
          <Link className="btn btn-primary" to={`/deliveries/${delivery.id}`}>
            {t("Open package")}
          </Link>
        </div>
      ) : decision.outcome === "do_not_advance" || decision.outcome === "hold" ? (
        <div className="card card-pad">
          <div className="section-title">{t("Report")}</div>
          <p className="tiny" style={{ marginBottom: 10 }}>
            {t("You can still generate a review-only report, or send a decline notice to the candidate as a separate, explicit action.")}
          </p>
          <Button variant="secondary" onClick={generateReport}>
            {t("Generate report (review only)")}
          </Button>{" "}
          {decision.outcome === "do_not_advance" && (
            <Button variant="secondary" onClick={() => setConfirmDecline(true)}>
              {t("Send candidate decline notice")}
            </Button>
          )}
        </div>
      ) : (
        <div className="card card-pad">
          <p className="tiny">
            {t(
              "Decision recorded without a downstream handoff yet. A task remains until a next step is either sent or explicitly closed as “no next step.”",
            )}
          </p>
        </div>
      )}
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
  const navigate = useNavigate();
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);
  const [target, setTarget] = useState<TargetChoice | null>(null);
  const [exceptionRequested, setExceptionRequested] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmException, setConfirmException] = useState(false);

  const load = useCallback(() => {
    const a = getApplication(id);
    setApp(a ?? null);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Landing on the decision page is the real signal that someone has started
  // working this — claim the "screening_review" task (open -> in_progress) so
  // the task list reflects it without a separate manual step. Best-effort: a
  // missing/already-claimed task or a transient failure never blocks the page.
  useEffect(() => {
    if (!isRealApi() || !id) return;
    findTaskForApplication(id)
      .then((task) => {
        if (task && task.status === "open") return claimTask(task.id, state.currentUser);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (app === undefined) return null;
  if (app === null) return <EmptyState icon="search_off" title={t("Application not found")} />;
  if (db.decisions[app.id]) return <AlreadyDecidedView app={app} />;

  const cand = getCandidate(app.candidateId)!;
  const job = getJob(app.jobId)!;
  const ev = getEvaluation(app.id);
  const assessment = db.assessments[app.id] || { status: "not_administered" as const };
  const aiRec = ev ? (ev.evaluationStatus === "insufficient_evidence" ? "review" : inferRecommendation(ev)) : null;

  const requiredAssessment = job.workflowPolicy?.assessmentDisposition === "required";
  const assessmentMissing = assessment.status !== "completed";
  const needsExceptionUi = target === "interview" && requiredAssessment && assessmentMissing;

  const finalize = async (exceptionApproved: boolean) => {
    if (!outcome) return;
    const overrideAi = !!aiRec && aiRec !== outcome && !(aiRec === "strong_advance" && outcome === "advance");
    try {
      const { delivery } = await recordDecision(app.id, {
        outcome,
        reason,
        decidedBy: state.currentUser,
        nextStepTarget: toNextStepTarget(target ?? "none"),
        overrideAi,
        exceptionApproved,
      });
      if (delivery) {
        say(t("Decision recorded — package prepared for delivery"), { type: "success" });
        navigate(`/deliveries/${delivery.id}`);
      } else {
        say(t("Decision recorded"), { type: "success" });
        load();
      }
    } catch (err) {
      say(err instanceof Error ? err.message : t("Something went wrong rendering this page"), { type: "error" });
    }
  };

  const submit = () => {
    if (!outcome) return;
    if (!reason.trim()) {
      say(t("A reason is required"), { type: "error" });
      return;
    }
    const meta = OUTCOME_META[outcome];
    if (meta.needsTarget && !target) {
      say(t("Choose a next-step target"), { type: "error" });
      return;
    }
    if (target === "interview" && requiredAssessment && assessmentMissing && !exceptionRequested) {
      say(t("Required assessment is missing — request an exception to proceed"), { type: "error" });
      return;
    }
    if (exceptionRequested) {
      setConfirmException(true);
      return;
    }
    finalize(false);
  };

  return (
    <>
      <PageHeader
        title={`${t("Decision & next steps —")} ${cand.displayName}`}
        subtitle={`${job.title} · ${t("This candidate’s decision only — Comparison and other candidates are unaffected.")}`}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title, href: `/jobs/${job.id}/screening` }, { label: cand.displayName, href: `/applications/${app.id}` }, { label: t("Decision") }]}
        actions={
          <Link className="btn btn-secondary" to={`/applications/${app.id}`}>
            {t("Back to screening")}
          </Link>
        }
      />

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
            {t("AI recommendation:")} {aiRec ? <RecommendationBadge outcome={aiRec} /> : "—"}
          </p>
          <p className="tiny">
            {t("Assessment:")} {assessment.status === "completed" ? t("Completed ({n}/100)").replace("{n}", String(assessment.score)) : t("Not administered")}
          </p>
          <p className="tiny">
            {t("Open concerns:")} {getConcerns(app.id).filter((c) => c.status === "open").length}
          </p>
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
                <label>{t("Reason")}</label>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Required — explain the basis for this decision")} />
              </div>
              <Button variant="primary" onClick={submit}>
                {t("Submit decision")}
              </Button>
            </>
          )}
        </div>
      </div>

      {confirmException && (
        <ConfirmDialog
          open
          onClose={() => setConfirmException(false)}
          title={t("Approve exception — requires HR + HM")}
          body={t(
            "Moving to Interview without a completed Assessment requires approval from both an HR and a Hiring Manager approver. In this demo, confirming records both approvals under this decision.",
          )}
          confirmLabel={t("Approve exception & submit")}
          onConfirm={() => finalize(true)}
        />
      )}
    </>
  );
}
