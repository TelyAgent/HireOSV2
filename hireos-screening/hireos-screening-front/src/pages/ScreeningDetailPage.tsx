import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  assignVerificationItemToMe,
  getApplicationDetail,
  refreshEvaluation,
  resolveConcern,
  resolveVerificationItem,
  runScreening,
  saveHumanOverride,
  type ApplicationDetail,
} from "../data/api/screening";
import { db, getCandidate, getJob, getPerson } from "../data/db";
import type { DimensionScore } from "../data/fixtures/evaluations";
import type { Concern, ConcernStatus } from "../data/fixtures/concerns";
import type { VerificationItem } from "../data/fixtures/verificationItems";
import { fmtDateTime, pct } from "../lib/format";
import { inferRecommendation } from "../lib/scoring";
import {
  Badge,
  Button,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
  PageHeader,
  RecommendationBadge,
  ScoreRing,
  scoreDisplay,
} from "../components/ui/Primitives";
import { EvidenceCard } from "../components/ui/EvidenceCard";
import { Icon } from "../components/ui/Icons";
import { ConfirmDialog, Drawer, Modal } from "../components/ui/Overlays";

const RESTRICTED_VIEWERS = ["emma", "daniel"];

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function severityTone(sev: Concern["severity"]): "danger" | "warning" | "outline" {
  if (sev === "blocker" || sev === "high") return "danger";
  if (sev === "medium") return "warning";
  return "outline";
}

function EvidenceDrawer({ dimension, onClose }: { dimension: DimensionScore; onClose: () => void }) {
  const { t } = useStore();
  const items: { id: string; rel: "Supports" | "Contradicts" }[] = [
    ...dimension.supporting.map((id) => ({ id, rel: "Supports" as const })),
    ...dimension.counter.map((id) => ({ id, rel: "Contradicts" as const })),
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
  const evCount = dimension.supporting.length + dimension.counter.length;
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
        <Button variant="secondary" size="sm" disabled={!evCount} onClick={onOpenEvidence}>
          {t("Evidence")} ({evCount})
        </Button>
      </div>
    </div>
  );
}

function ConcernRow({ concern, onResolve }: { concern: Concern; onResolve: (id: string, outcome: ConcernStatus) => void }) {
  const { t, state } = useStore();
  const [acceptRiskOpen, setAcceptRiskOpen] = useState(false);
  const restricted = concern.restricted && !RESTRICTED_VIEWERS.includes(state.currentUser);
  return (
    <div className="card-pad" style={{ borderBottom: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between flex-wrap gap-8">
        <div>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>
            {restricted ? t("Restricted concern — visible to authorized HR/HM roles only") : concern.title}{" "}
            <Badge tone={severityTone(concern.severity)}>{t(cap(concern.severity))}</Badge>
          </div>
          <div className="tiny">
            {t(cap(concern.type.replace(/_/g, " ")))} · {t("basis:")} {t(cap(concern.basis.replace(/_/g, " ")))} · {t("status:")} {t(cap(concern.status.replace(/_/g, " ")))}
          </div>
        </div>
        {concern.status === "open" && !restricted ? (
          <div className="flex gap-6">
            <Button variant="secondary" size="sm" onClick={() => onResolve(concern.id, "dismissed")}>
              {t("Dismiss")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onResolve(concern.id, "confirmed")}>
              {t("Confirm")}
            </Button>
            {concern.severity === "blocker" && (
              <Button variant="secondary" size="sm" onClick={() => setAcceptRiskOpen(true)}>
                {t("Accept risk (needs approval)")}
              </Button>
            )}
          </div>
        ) : concern.status !== "open" ? (
          <Badge tone="outline">{t(cap(concern.status.replace(/_/g, " ")))}</Badge>
        ) : null}
      </div>
      {acceptRiskOpen && (
        <ConfirmDialog
          open
          onClose={() => setAcceptRiskOpen(false)}
          title={t("Accept risk — requires HR + HM approval")}
          body={t("This blocker requires approval from both an HR and a Hiring Manager approver before it can be accepted. In this demo, confirming records both approvals.")}
          confirmLabel={t("Record HR + HM approval")}
          onConfirm={() => onResolve(concern.id, "accepted_risk")}
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
          <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{item.question}</div>
          <div className="tiny">
            {t("Method:")} {t(cap(item.method.replace(/_/g, " ")))} · {t("Target:")} {t(cap(item.targetStage))} · {t("Priority")}: {t(cap(item.priority))}
            {owner ? ` · ${t("Owner:")} ${owner.name}` : ""}
          </div>
        </div>
        <div className="flex gap-6 items-center">
          <Badge tone={item.status === "resolved" ? "success" : item.status === "open" ? "info" : "outline"}>{t(cap(item.status.replace(/_/g, " ")))}</Badge>
          {item.status === "open" && (
            <>
              <Button variant="secondary" size="sm" onClick={() => onAssign(item.id)}>
                {t("Assign to me")}
              </Button>
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

function OverrideModal({ detail, onClose, onSaved }: { detail: ApplicationDetail; onClose: () => void; onSaved: () => void }) {
  const { t, state, say } = useStore();
  const dims = detail.evaluation?.dimensionScores || [];
  const [dimId, setDimId] = useState(dims[0]?.id || "");
  const [score, setScore] = useState("");
  const [reason, setReason] = useState("");

  const submit = async () => {
    const n = parseInt(score, 10);
    if (isNaN(n) || n < 0 || n > 100) {
      say(t("Enter a score between 0 and 100"), { type: "error" });
      return;
    }
    if (!reason.trim()) {
      say(t("A reason is required"), { type: "error" });
      return;
    }
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
        <label>{t("Your score (0–100)")}</label>
        <input type="text" value={score} onChange={(e) => setScore(e.target.value)} placeholder="e.g. 85" />
      </div>
      <div className="field">
        <label>{t("Reason")}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why does your assessment differ from the AI score?")} />
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

  const load = useCallback(() => {
    getApplicationDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (detail === undefined) return null;
  if (detail === null) return <EmptyState icon="search_off" title={t("Application not found")} />;

  const { application, evaluation, concerns, verificationItems } = detail;
  const candidate = getCandidate(application.candidateId)!;
  const job = getJob(application.jobId)!;
  const decision = db.decisions[application.id];
  const assessment = db.assessments[application.id] || { status: "not_administered" as const };
  const humanAssessments = db.humanAssessments[application.id] || [];

  const handleRunScreening = async () => {
    setRunning(true);
    say(t("Running AI-assisted screening…"));
    await runScreening(application.id);
    setRunning(false);
    say(t("Screening complete"), { type: "success" });
    load();
  };
  const handleRefresh = async () => {
    say(t("Refreshing evaluation with latest inputs…"));
    await refreshEvaluation(application.id);
    say(t("Evaluation refreshed — new snapshot created, prior result kept in history"), { type: "success" });
    load();
  };
  const handleResolveConcern = async (concernId: string, outcome: ConcernStatus) => {
    await resolveConcern(application.id, concernId, outcome as "dismissed" | "confirmed" | "accepted_risk");
    if (outcome === "accepted_risk") {
      say(t("Risk accepted — original evidence and status are kept, not overwritten"), { type: "success" });
    } else {
      say(`${t("Concern marked")} ${t(cap(outcome.replace(/_/g, " ")))}`, { type: "success" });
    }
    load();
  };
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
          subtitle={t("Linked, screening not yet run.")}
          crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title, href: `/jobs/${job.id}/screening` }, { label: candidate.displayName }]}
        />
        <div className="card">
          <EmptyState
            icon="fact_check"
            title={t("Screening has not run for this application yet")}
            body={t("Run AI-assisted screening against the confirmed role criteria, or complete a manual evaluation.")}
            actions={
              <Button variant="primary" onClick={handleRunScreening} disabled={running}>
                {t("Run screening")}
              </Button>
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
            {assessment.status === "completed" ? `${t("Assessment:")} ${assessment.score}/100` : t("Assessment: not administered")}
          </>
        }
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title, href: `/jobs/${job.id}/screening` }, { label: candidate.displayName }]}
        actions={
          <>
            {evaluation.freshness === "stale" && (
              <Button variant="secondary" icon="refresh" onClick={handleRefresh}>
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

      {evaluation.freshness === "stale" && (
        <div className="error-inline" style={{ marginBottom: 16, borderColor: "var(--warning-border)", background: "var(--warning-bg)", color: "var(--warning-text)" }}>
          <Icon name="history" />
          {t("Inputs changed since this result was generated (resume updated or profile corrected). Refresh to re-evaluate before relying on this for a decision.")}
        </div>
      )}

      {/* LEVEL 1: Decision */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          {t("Decision")}
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
          <div>
            <div className="tiny">{t("AI recommendation")}</div>
            {evaluation.evaluationStatus === "insufficient_evidence" ? (
              <Badge tone="warning">{t("Review (insufficient evidence)")}</Badge>
            ) : (
              <RecommendationBadge outcome={inferRecommendation(evaluation)} />
            )}
          </div>
          <div>
            <div className="tiny">{t("Human status")}</div>
            {decision ? (
              <Badge tone="success">
                {t("Decided —")} {t(cap(decision.outcome.replace(/_/g, " ")))}
              </Badge>
            ) : (
              <Badge tone="info">{t("Awaiting human review")}</Badge>
            )}
          </div>
        </div>
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
                    {c.title} <Badge tone={severityTone(c.severity)}>{t(cap(c.severity))}</Badge>
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
            concerns.map((c) => <ConcernRow key={c.id} concern={c} onResolve={handleResolveConcern} />)
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

      {evidenceDim && <EvidenceDrawer dimension={evidenceDim} onClose={() => setEvidenceDim(null)} />}
      {overrideOpen && <OverrideModal detail={detail} onClose={() => setOverrideOpen(false)} onSaved={load} />}
    </>
  );
}
