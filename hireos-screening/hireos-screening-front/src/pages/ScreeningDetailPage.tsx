import { useCallback, useEffect, useState } from "react";
import { CONCERN_STATUS_LABEL, ConcernResolveModal } from "../features/screening/ConcernResolveModal";
import { evaluatedBy } from "../features/screening/evaluatedBy";
import { decisionDiffersFromAi, effectiveDecision, humanStatus } from "../features/screening/humanStatus";
import { CAP_REASON, recommend, recommendationDisplay } from "../lib/recommendationRule";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  assignVerificationItemToMe,
  getApplicationDetail,
  refreshEvaluation,
  resolveVerificationItem,
  runScreening,
  saveHumanOverride,
  type ApplicationDetail,
} from "../data/api/screening";
import { db, getCandidate, getEvidenceById, getJob, getPerson } from "../data/db";
import type { DimensionScore } from "../data/fixtures/evaluations";
import type { Concern } from "../data/fixtures/concerns";
import type { VerificationItem } from "../data/fixtures/verificationItems";
import { fmtDateTime, pct } from "../lib/format";
import {
  AiRecommendationBadge,
  Badge,
  Button,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
  PageHeader,
  scoreDisplay,
  ScoreRing,
} from "../components/ui/Primitives";
import { EvidenceCard } from "../components/ui/EvidenceCard";
import { Icon } from "../components/ui/Icons";
import { Drawer, Modal } from "../components/ui/Overlays";
import { useBoundedPolling } from "../lib/usePolling";
import { StillProcessingNotice } from "../components/ui/StillProcessing";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { useFieldValidation } from "../lib/useFieldValidation";
import { concernTitle } from "../lib/concerns";
import { ApiError } from "../data/api/shared";
import { listEvaluations, type EvaluationSnapshot, type ScreeningRunResult } from "../data/api/screening";
import type { Evaluation } from "../data/fixtures/evaluations";

const RESTRICTED_VIEWERS = ["emma", "daniel"];

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
/** Concern titles and verification questions are generated server-side in English around the
 * requirement text (which is already in the job's language) -- translate the fixed wrapper. */
function verificationQuestion(question: string, t: (s: string) => string) {
  const m = /^Please confirm: (.*)$/s.exec(question);
  return m ? t("Please confirm: {label}").replace("{label}", m[1]) : question;
}

function severityTone(sev: Concern["severity"]): "danger" | "warning" | "outline" {
  if (sev === "blocker" || sev === "high") return "danger";
  if (sev === "medium") return "warning";
  return "outline";
}

function EvidenceDrawer({ dimension, onClose }: { dimension: DimensionScore; onClose: () => void }) {
  const { t } = useStore();
  // Only evidence that can actually be shown counts (#192 AC-1/AC-3).
  const items: { id: string; rel: "Supports" | "Contradicts" }[] = [
    ...dimension.supporting.filter((id) => getEvidenceById(id)).map((id) => ({ id, rel: "Supports" as const })),
    ...dimension.counter.filter((id) => getEvidenceById(id)).map((id) => ({ id, rel: "Contradicts" as const })),
  ];
  return (
    <Drawer open onClose={onClose} title={`${dimension.name} — ${t("evidence")}`}>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Requirement → rubric → rationale → evidence → source excerpt.")}
      </p>
      <div className="card card-pad" style={{ marginBottom: 14, background: "var(--surface-alt)" }}>
        <div className="tiny" style={{ fontWeight: 600 }}>
          {t("Rationale")}
        </div>
        <p style={{ fontSize: "var(--fs-sm)", margin: "4px 0 0" }}>{dimension.reason}</p>
      </div>
      {items.length ? (
        items.map((it) => <EvidenceCard key={it.id} evidenceId={it.id} relationship={it.rel} />)
      ) : (
        <p className="tiny">{t("No linked evidence — Unknown is shown rather than a fabricated citation.")}</p>
      )}
    </Drawer>
  );
}

function DimensionRow({ dimension, onOpenEvidence }: { dimension: DimensionScore; onOpenEvidence: () => void }) {
  const { t } = useStore();
  // The count is the evidence that can be shown, not the references (#192 AC-1/AC-3).
  const evCount = [...dimension.supporting, ...dimension.counter].filter((id) => getEvidenceById(id)).length;
  return (
    <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center gap-16 flex-wrap">
        {dimension.status === "evaluated" ? (
          <ScoreRing overall={dimension.score} size="sm" />
        ) : (
          <span className="score-ring unk" style={{ width: 30, height: 30, fontSize: 11 }}>
            {dimension.status === "not_evaluated" ? "N/E" : "?"}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>
            {dimension.name} <span className="tiny muted">{t("weight")} {Math.round(dimension.weight * 100)}%</span>
          </div>
          <div className="tiny">{dimension.reason || ""}</div>
        </div>
        <div style={{ width: 120 }}>
          {dimension.status === "evaluated" ? (
            <span className="tiny">
              {t("Confidence")} {pct(dimension.confidence)}
            </span>
          ) : (
            <Badge tone="outline">{dimension.status === "unknown" ? t("Unknown") : t(cap(dimension.status.replace(/_/g, " ")))}</Badge>
          )}
        </div>
        {evCount ? (
          <Button variant="secondary" size="sm" onClick={onOpenEvidence}>
            {t("Evidence")} ({evCount})
          </Button>
        ) : (
          <span className="tiny muted" data-testid="no-evidence">{t("No evidence")}</span>
        )}
      </div>
    </div>
  );
}

function ConcernRow({
  applicationId,
  concern,
  materials,
  openVerificationCount,
  onChanged,
}: {
  applicationId: string;
  concern: Concern;
  materials: Array<{ materialId: string; label: string }>;
  openVerificationCount: number;
  onChanged: (concern: Concern) => void;
}) {
  const { t, state } = useStore();
  // Which change is being reviewed before it is recorded (#193); nothing is written until "Record".
  const [pending, setPending] = useState<{ mode: "resolve" | "reopen"; resolution?: "dismissed" | "confirmed" | "accepted_risk" } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const restricted = concern.restricted && !RESTRICTED_VIEWERS.includes(state.currentUser);
  const history = concern.history ?? [];
  const last = history[history.length - 1];
  return (
    <div className="card-pad" id={`concern-${concern.id}`} style={{ borderBottom: "1px solid var(--border)" }} data-testid="concern-row" data-status={concern.status}>
      <div className="flex items-center justify-between flex-wrap gap-8">
        <div>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>
            {restricted ? t("Restricted concern — visible to authorized HR/HM roles only") : concernTitle(concern.title, t)}{" "}
            <Badge tone={severityTone(concern.severity)}>{t(cap(concern.severity))}</Badge>
          </div>
          <div className="tiny">
            {t(cap(concern.type.replace(/_/g, " ")))} · {t("basis:")} {t(cap(concern.basis.replace(/_/g, " ")))} · {t("status:")} {t(CONCERN_STATUS_LABEL[concern.status] ?? concern.status)}
          </div>
          {concern.status !== "open" && last?.action === "resolve" && (
            <div className="tiny" data-testid="concern-resolution">
              {t("Note:")} {last.note} · {getPerson(last.actorId)?.name ?? last.actorId} · {fmtDateTime(last.at, state.lang)}
              {last.evidenceRefs.length > 0 && ` · ${t("material:")} ${last.evidenceRefs.map((r) => r.label || r.materialId).join(", ")}`}
            </div>
          )}
        </div>
        {!restricted && (
          <div className="flex gap-6 items-center">
            {concern.status === "open" ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setPending({ mode: "resolve", resolution: "dismissed" })}>
                  {t("Dismiss")}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setPending({ mode: "resolve", resolution: "confirmed" })}>
                  {t("Confirm")}
                </Button>
                {concern.severity === "blocker" && (
                  <Button variant="secondary" size="sm" onClick={() => setPending({ mode: "resolve", resolution: "accepted_risk" })}>
                    {t("Accept risk (needs approval)")}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Badge tone="outline">{t(CONCERN_STATUS_LABEL[concern.status] ?? concern.status)}</Badge>
                <Button variant="text" size="sm" onClick={() => setPending({ mode: "reopen" })} data-testid="concern-reopen">
                  {t("Reopen")}
                </Button>
              </>
            )}
            {history.length > 0 && (
              <Button variant="text" size="sm" onClick={() => setShowHistory((v) => !v)}>
                {t("History")} ({history.length})
              </Button>
            )}
          </div>
        )}
      </div>
      {showHistory && (
        <ul className="tiny" style={{ margin: "8px 0 0", paddingLeft: 18 }} data-testid="concern-history">
          {history.map((h, i) => (
            <li key={i}>
              {fmtDateTime(h.at, state.lang)} · {getPerson(h.actorId)?.name ?? h.actorId} · {t(CONCERN_STATUS_LABEL[h.fromStatus] ?? h.fromStatus)} →{" "}
              {t(CONCERN_STATUS_LABEL[h.toStatus] ?? h.toStatus)} · {h.note}
            </li>
          ))}
        </ul>
      )}
      {pending && (
        <ConcernResolveModal
          applicationId={applicationId}
          concern={concern}
          mode={pending.mode}
          resolution={pending.resolution}
          materials={materials}
          openVerificationCount={openVerificationCount}
          onClose={() => setPending(null)}
          onDone={(updated) => {
            setPending(null);
            onChanged(updated);
          }}
        />
      )}
    </div>
  );
}

function VerificationRow({
  item,
  onAssign,
  onResolve,
}: {
  item: VerificationItem;
  onAssign: (id: string) => void;
  onResolve: (id: string, outcome: "met" | "not_met") => void;
}) {
  const { t } = useStore();
  const owner = item.owner ? getPerson(item.owner) : null;
  return (
    <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between flex-wrap gap-8">
        <div>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{verificationQuestion(item.question, t)}</div>
          <div className="tiny">
            {t("Method:")} {t(cap(item.method.replace(/_/g, " ")))} · {t("Target:")} {t(cap(item.targetStage))} · {t("Priority")}: {t(cap(item.priority))}
            {owner ? ` · ${t("Owner:")} ${owner.name}` : ""}
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Badge tone={item.status === "resolved" ? (item.outcome === "not_met" ? "danger" : "success") : item.status === "open" ? "info" : "outline"}>
            {t(cap(item.status.replace(/_/g, " ")))}
            {item.status === "resolved" && item.outcome ? ` — ${t(cap(item.outcome.replace(/_/g, " ")))}` : ""}
          </Badge>
          {item.status === "open" && (
            <Button variant="secondary" size="sm" onClick={() => onAssign(item.id)}>
              {t("Assign to me")}
            </Button>
          )}
          {(item.status === "open" || item.status === "assigned") && (
            <>
              <Button variant="secondary" size="sm" onClick={() => onResolve(item.id, "met")}>
                {t("Mark met")}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => onResolve(item.id, "not_met")}>
                {t("Mark not met")}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** How a score was produced (#19): the model (and which one), or the local rules — never implied. */
function EvaluatedBy({ evaluation }: { evaluation: Pick<Evaluation, "evaluationMode" | "modelVersion"> }) {
  const { t } = useStore();
  const by = evaluatedBy(evaluation);
  return (
    <Badge tone={by.tone}>
      {t(by.label)}
      {by.model ? ` · ${by.model}` : ""}
    </Badge>
  );
}

/** Every snapshot, newest first; any of them can be opened as it was generated (#19 AC-1/AC-2). */
function SnapshotHistory({ applicationId, history, currentId }: { applicationId: string; history: EvaluationSnapshot[]; currentId: string }) {
  const { t, state } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<Evaluation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const open = async (id: string) => {
    setOpenId(id);
    if (snapshots) return;
    setLoadFailed(false);
    try {
      setSnapshots(await listEvaluations(applicationId));
    } catch {
      setLoadFailed(true);
    }
  };
  const selected = snapshots?.find((e) => e.id === openId);
  return (
    <>
      <div className="section-title" style={{ marginTop: 28 }}>
        {t("Snapshot history")} <span className="cnt">{history.length}</span>
      </div>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Version")}</th>
              <th>{t("Generated")}</th>
              <th>{t("Overall")}</th>
              <th>{t("Coverage")}</th>
              <th>{t("Scored by")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>
                  v{h.version} {h.id === currentId && <Badge tone="success">{t("Current")}</Badge>}
                </td>
                <td>{fmtDateTime(h.completedAt, state.lang)}</td>
                <td>{scoreDisplay(h.overall) ?? t("Insufficient evidence")}</td>
                <td>{pct(h.coverage)}</td>
                <td>
                  <EvaluatedBy evaluation={h} />
                </td>
                <td style={{ textAlign: "right" }}>
                  <Button size="sm" variant="secondary" onClick={() => void open(h.id)}>
                    {t("View")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {openId && (
        <Modal open onClose={() => setOpenId(null)} title={`${t("Snapshot")} v${history.find((h) => h.id === openId)?.version ?? ""}`} wide>
          {loadFailed ? (
            <p className="tiny">{t("This snapshot could not be loaded — check your connection and try again.")}</p>
          ) : !selected ? (
            <PageSkeleton rows={3} />
          ) : (
            <>
              <p className="tiny" style={{ marginBottom: 12 }}>
                {fmtDateTime(selected.completedAt, state.lang)} · <EvaluatedBy evaluation={selected} /> · {t("Overall")}{" "}
                {scoreDisplay(selected.overall) ?? t("Insufficient evidence")} · {t("Coverage")} {pct(selected.coverage)}
                {selected.confidence != null && ` · ${t("Confidence")} ${pct(selected.confidence)}`}
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Dimension")}</th>
                    <th>{t("Weight")}</th>
                    <th>{t("Score")}</th>
                    <th>{t("Reason")}</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.dimensionScores.map((d) => (
                    <tr key={d.id}>
                      <td>{d.name}</td>
                      <td>{pct(d.weight)}</td>
                      <td>{d.status === "evaluated" && d.score != null ? Math.round(d.score) : t("Not evaluated")}</td>
                      <td className="tiny">{d.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

function OverrideModal({ detail, onClose, onSaved }: { detail: ApplicationDetail; onClose: () => void; onSaved: () => void }) {
  const { t, state, say } = useStore();
  const dims = detail.evaluation?.dimensionScores || [];
  const [dimId, setDimId] = useState(dims[0]?.id || "");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");
  const fields = useFieldValidation({
    score: () => (!/^\d{1,3}$/.test(score.trim()) || Number(score) > 100 ? t("Enter a whole number from 0 to 100.") : null),
    reason: () => (!reason.trim() ? t("Explain why your assessment differs from the AI score.") : null),
  });

  const submit = async () => {
    if (!fields.validateAll()) return;
    const n = parseInt(score, 10);
    const dim = dims.find((d) => d.id === dimId);
    if (!dim) return;
    await saveHumanOverride(detail.application.id, { dimensionId: dim.id, dimensionName: dim.name, score: n, reason: reason.trim(), by: state.currentUser });
    onClose();
    say(t("Human override saved — AI score unchanged"), { type: "success" });
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Override a score")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit}>
            {t("Save override")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("This records your assessment as a separate human judgment. The AI score is kept unchanged for audit and comparison.")}
      </p>
      <div className="field">
        <label>{t("Dimension")}</label>
        <select value={dimId} onChange={(e) => setDimId(e.target.value)}>
          {dims.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={fields.labelFor("score")}>
          {t("Your score (0–100)")}
          <span className="required-mark">*</span>
        </label>
        <input type="text" inputMode="numeric" {...fields.field("score")} value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 85" />
        {fields.error("score")}
      </div>
      <div className="field">
        <label htmlFor={fields.labelFor("reason")}>
          {t("Reason")}
          <span className="required-mark">*</span>
        </label>
        <textarea {...fields.field("reason")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why does your assessment differ from the AI score?")} />
        {fields.error("reason")}
      </div>
    </Modal>
  );
}

export function ScreeningDetailPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [detail, setDetail] = useState<ApplicationDetail | null | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [evidenceDim, setEvidenceDim] = useState<DimensionScore | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  /** Last run/refresh failure, shown with a Retry until the next attempt (#19 AC-5). */
  const [runFailure, setRunFailure] = useState<{ action: "run" | "refresh"; message: string } | null>(null);

  const load = useCallback(() => {
    getApplicationDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Confirming a link starts screening in the background, so the page can open before
  // that run finishes -- keep polling until the result lands.
  // Arriving from the decision page's concern list (#27 AC-1): bring that concern into view once loaded.
  useEffect(() => {
    if (!detail?.evaluation || !window.location.hash.startsWith("#concern-")) return;
    const el = document.getElementById(window.location.hash.slice(1));
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("concern-flash");
  }, [detail]);

  const inProgress = !!detail && !detail.evaluation && !!detail.screeningInProgress;
  const screeningPoll = useBoundedPolling(inProgress, load, 3000);

  if (detail === undefined) return <PageSkeleton />;
  if (detail === null) return <EmptyState icon="search_off" title={t("Application not found")} />;

  const { application, evaluation, concerns, verificationItems } = detail;
  const candidate = getCandidate(application.candidateId)!;
  const job = getJob(application.jobId)!;
  const decision = db.decisions[application.id];
  // AI advice and the person's decision are shown side by side, never merged (#187 #194 #196).
  const currentDecision = effectiveDecision(decision);
  const status = humanStatus(decision);
  const aiRecommendation = recommend(evaluation, concerns);
  const differs = decisionDiffersFromAi(aiRecommendation?.outcome, decision);
  const humanAssessments = db.humanAssessments[application.id] || [];

  /** Verifiable outcome (#19 AC-3): the snapshot count comes from the server, the same list the history shows. */
  const sayRunResult = (result: ScreeningRunResult) => {
    const n = String(result.snapshotCount ?? "");
    if (result.reused) say(t("Inputs unchanged — kept the previous evaluation ({n} snapshots in history)").replace("{n}", n), { type: "success" });
    else say(t("New snapshot created ({n} snapshots in history) — earlier results are kept").replace("{n}", n), { type: "success" });
  };
  const failureMessage = (err: unknown) => {
    if (err instanceof ApiError && err.code === "AI_EVALUATION_FAILED") return t("The AI evaluation call failed — nothing was saved. Retry in a moment.");
    if (err instanceof ApiError && err.code === "CRITERIA_NOT_CONFIRMED") return t("Confirm the job criteria before running screening.");
    if (err instanceof ApiError && err.code === "PROFILE_NOT_READY") return t("The resume hasn’t been parsed yet — wait for parsing to finish, then retry.");
    return t("Screening failed — please try again");
  };
  const handleRunScreening = async () => {
    setRunning(true);
    setRunFailure(null);
    say(t("Running AI-assisted screening…"));
    try {
      sayRunResult(await runScreening(application.id));
    } catch (err) {
      setRunFailure({ action: "run", message: failureMessage(err) });
    } finally {
      setRunning(false);
      load();
    }
  };
  const handleRefresh = async () => {
    setRunning(true);
    setRunFailure(null);
    say(t("Refreshing evaluation with latest inputs…"));
    try {
      sayRunResult(await refreshEvaluation(application.id));
    } catch (err) {
      setRunFailure({ action: "refresh", message: failureMessage(err) });
    } finally {
      setRunning(false);
      load();
    }
  };
  const failureBanner = runFailure && (
    <div className="error-inline" role="alert" style={{ marginBottom: 16 }}>
      <Icon name="error_outline" />
      <span>{runFailure.message}</span>
      <Button size="sm" variant="secondary" icon="refresh" disabled={running} onClick={() => void (runFailure.action === "run" ? handleRunScreening() : handleRefresh())}>
        {t("Retry")}
      </Button>
    </div>
  );
  const handleConcernChanged = (concern: Concern) => {
    say(
      concern.status === "open"
        ? t("Concern reopened — the earlier handling stays in its history")
        : `${t("Concern marked")} ${t(CONCERN_STATUS_LABEL[concern.status] ?? concern.status)}`,
      { type: "success" },
    );
    load();
  };
  // The candidate's résumé versions a handling can point to (#193), and which linked checks are still open.
  const concernMaterials = (db.resumeVersions[application.candidateId] ?? [])
    .filter((v) => v.materialId)
    .map((v) => ({ materialId: v.materialId!, label: `${v.fileName} (v${v.version})` }));
  const openVerificationsFor = (concern: Concern) =>
    concern.verificationItemIds.filter((id) => verificationItems.some((item) => item.id === id && item.status !== "resolved")).length;
  const handleAssignVerification = async (itemId: string) => {
    await assignVerificationItemToMe(itemId, state.currentUser);
    say(t("Assigned to you"));
    load();
  };
  const handleResolveVerification = async (itemId: string, outcome: "met" | "not_met") => {
    await resolveVerificationItem(itemId, outcome, state.currentUser);
    say(`${t("Verification item resolved —")} ${t(cap(outcome.replace(/_/g, " ")))}`, { type: "success" });
    load();
  };

  if (!evaluation) {
    return (
      <>
        <PageHeader
          title={`${candidate.displayName} — ${job.title}`}
          subtitle={inProgress || running ? t("Linked, screening in progress.") : t("Linked, screening not yet run.")}
          back={`/jobs/${job.id}/screening`}
        />
        {screeningPoll.overdue && <StillProcessingNotice style={{ marginBottom: 16 }} onRetry={screeningPoll.retry} />}
        {failureBanner}
        <div className="card">
          <EmptyState
            icon={inProgress || running ? "hourglass_top" : "fact_check"}
            title={inProgress || running ? t("Screening in progress") : t("Screening has not run for this application yet")}
            body={
              inProgress || running
                ? t("AI-assisted screening is running against the confirmed role criteria. Results will appear here automatically.")
                : t("Run AI-assisted screening against the confirmed role criteria, or complete a manual evaluation.")
            }
            actions={
              inProgress || running ? undefined : (
                <Button variant="primary" onClick={handleRunScreening}>
                  {t("Run screening")}
                </Button>
              )
            }
          />
        </div>
      </>
    );
  }

  const openConcerns = concerns.filter((c) => c.status === "open");
  const strengths = (evaluation.dimensionScores || []).filter((d) => d.status === "evaluated" && d.score != null && d.score >= 75).slice(0, 3);

  return (
    <>
      <PageHeader
        title={candidate.displayName}
        subtitle={
          <>
            {t("Screening for")} <Link to={`/jobs/${job.id}/screening`}>{job.title}</Link> · {t("Standard")} v{job.criteriaVersion} ·{" "}
            {application.assessmentStatus === "completed" ? t("Assessment: completed") : t("Assessment: not administered")}
          </>
        }
        back={`/jobs/${job.id}/screening`}
        actions={
          <>
            {evaluation.freshness === "stale" && (
              <Button variant="secondary" icon="refresh" onClick={handleRefresh} disabled={running}>
                {t("Refresh & re-evaluate")}
              </Button>
            )}
            <Link className="btn btn-secondary" to={`/candidates/${candidate.id}`}>
              {t("Candidate profile")}
            </Link>
            <Link className="btn btn-primary" to={`/applications/${application.id}/decision`}>
              {decision ? t("View decision") : t("Decide next step")}
            </Link>
          </>
        }
      />

      {failureBanner}
      {evaluation.freshness === "stale" && (
        <div className="error-inline" style={{ marginBottom: 16, borderColor: "var(--warning-border)", background: "var(--warning-bg)", color: "var(--warning-text)" }}>
          <Icon name="history" />
          {t("Inputs changed since this result was generated (resume updated or profile corrected). Refresh to re-evaluate before relying on this for a decision.")}
        </div>
      )}

      {/* LEVEL 1: Decision */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {t("AI assessment and human decision")}
        </div>
        <div className="flex items-center gap-20 flex-wrap">
          <div className="flex items-center gap-12">
            <ScoreRing overall={evaluation.overall} />
            <div>
              <div className="tiny">{t("Overall (role_match scale, 0–100)")}</div>
              <div style={{ fontWeight: 600 }}>{scoreDisplay(evaluation.overall) == null ? t("Insufficient evidence") : scoreDisplay(evaluation.overall)}</div>
            </div>
          </div>
          <div>
            <div className="tiny">{t("Coverage")}</div>
            <CoverageBar coverage={evaluation.coverage} />
          </div>
          <div>
            <div className="tiny">{t("Eligibility")}</div>
            <EligibilityBadge status={evaluation.eligibilityStatus} />
          </div>
          <div data-testid="ai-recommendation">
            <div className="tiny">{t("AI recommendation — advice only")}</div>
            <AiRecommendationBadge display={recommendationDisplay(aiRecommendation)} />
            <div className="tiny muted">
              {t("Generated")} {fmtDateTime(evaluation.completedAt, state.lang)}
            </div>
            {aiRecommendation?.cappedBy
              .filter((cap) => cap === "open_high_concern" || cap === "needs_verification")
              .map((cap) => (
                <div className="tiny" key={cap} style={{ color: "var(--warning-text)" }} data-testid="recommendation-cap">
                  {t(CAP_REASON[cap])}
                </div>
              ))}
          </div>
          <div>
            <div className="tiny">{t("Scored by")}</div>
            <EvaluatedBy evaluation={evaluation} />
          </div>
          <div data-testid="human-status">
            <div className="tiny">{t("Human decision — the one in effect")}</div>
            {status.decided && currentDecision ? (
              <>
                <Badge tone="success">
                  {t("Decided —")} {t(status.label)}
                </Badge>
                <div className="tiny muted">
                  {getPerson(currentDecision.decidedBy)?.name ?? currentDecision.decidedBy} · {fmtDateTime(currentDecision.decidedAt, state.lang)} ·{" "}
                  <Link to={`/applications/${application.id}/decision`}>{t("View decision and reason")}</Link>
                </div>
              </>
            ) : (
              <>
                <Badge tone="info">{t(status.label)}</Badge>
                <div className="tiny muted">{t(status.detail)}</div>
              </>
            )}
          </div>
        </div>
        {differs && (
          <div className="info-inline" style={{ marginTop: 12 }} data-testid="ai-human-differ">
            <Icon name="info" />
            {t("A person decided differently from the AI recommendation. The person's decision is the one in effect; the AI recommendation stays on record as it was generated.")}{" "}
            <Link to={`/applications/${application.id}/decision`}>{t("See the reason")}</Link>
          </div>
        )}
        {evaluation.evaluationStatus === "insufficient_evidence" && (
          <p className="tiny" style={{ marginTop: 10, color: "var(--warning-text)" }}>
            {t("Coverage ({c}) is below the {t} threshold — overall is intentionally left blank rather than guessed.")
              .replace("{c}", pct(evaluation.coverage))
              .replace("{t}", pct(0.7))}
          </p>
        )}
        <div className="divider" />
        <div className="flex gap-24 flex-wrap">
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="tiny" style={{ fontWeight: 600, marginBottom: 6 }}>
              {t("Top strengths")}
            </div>
            {strengths.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
                {strengths.map((s) => (
                  <li key={s.id}>
                    {s.name} ({scoreDisplay(s.score)}) — {s.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tiny muted">{t("No strong (75+) dimensions yet.")}</p>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="tiny" style={{ fontWeight: 600, marginBottom: 6 }}>
              {t("Top concerns")}
            </div>
            {openConcerns.length ? (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
                {openConcerns.slice(0, 3).map((c) => (
                  <li key={c.id}>
                    {concernTitle(c.title, t)} <Badge tone={severityTone(c.severity)}>{t(cap(c.severity))}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tiny muted">{t("No open concerns.")}</p>
            )}
          </div>
        </div>
      </div>

      {/* LEVEL 2: Explanation */}
      <div className="section-block">
        <div className="section-title">{t("Explanation — dimension scores")}</div>
        <div className="card">
          {(evaluation.dimensionScores || []).map((d) => (
            <DimensionRow key={d.id} dimension={d} onOpenEvidence={() => setEvidenceDim(d)} />
          ))}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">{t("Concerns")}</div>
        <div className="card">
          {concerns.length ? (
            concerns.map((c) => (
              <ConcernRow
                key={c.id}
                applicationId={application.id}
                concern={c}
                materials={concernMaterials}
                openVerificationCount={openVerificationsFor(c)}
                onChanged={handleConcernChanged}
              />
            ))
          ) : (
            <div className="card-pad tiny muted">{t("No concerns raised.")}</div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-title">{t("Items to verify")}</div>
        <div className="card">
          {verificationItems.length ? (
            verificationItems.map((v) => (
              <VerificationRow key={v.id} item={v} onAssign={handleAssignVerification} onResolve={handleResolveVerification} />
            ))
          ) : (
            <div className="card-pad tiny muted">{t("Nothing pending verification.")}</div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="flex items-center justify-between">
          <div className="section-title" style={{ marginBottom: 6 }}>
            {t("Human assessment")}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOverrideOpen(true)}>
            {t("Override a score")}
          </Button>
        </div>
        <div className="card card-pad">
          {humanAssessments.length ? (
            humanAssessments.map((h) => (
              <div key={h.dimensionId} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: "var(--fs-sm)", margin: 0 }}>
                  {t("{dim} overridden to {score} by {who}, {when}.")
                    .replace("{dim}", h.dimensionName)
                    .replace("{score}", String(h.score))
                    .replace("{who}", getPerson(h.by)?.name || h.by)
                    .replace("{when}", fmtDateTime(h.at, state.lang))}
                </p>
                <p className="tiny" style={{ margin: "2px 0 0" }}>
                  {t("Reason:")} {h.reason}
                </p>
              </div>
            ))
          ) : (
            <p className="tiny">{t("No human overrides recorded. AI scores above are shown as generated.")}</p>
          )}
          {humanAssessments.length > 0 && <p className="tiny">{t("This is stored separately — the AI score above is unchanged.")}</p>}
        </div>
      </div>

      {evaluation.evaluationMode === "rules" && (
        <p className="tiny" style={{ marginTop: 12, color: "var(--warning-text)" }}>
          {t("This result was scored by local rules, not AI (AI isn’t configured or the resume has no readable text). Treat it as a rough guide only.")}
        </p>
      )}
      {detail.history && detail.history.length > 0 && <SnapshotHistory applicationId={application.id} history={detail.history} currentId={evaluation.id} />}

      {evidenceDim && <EvidenceDrawer dimension={evidenceDim} onClose={() => setEvidenceDim(null)} />}
      {overrideOpen && <OverrideModal detail={detail} onClose={() => setOverrideOpen(false)} onSaved={load} />}
    </>
  );
}
