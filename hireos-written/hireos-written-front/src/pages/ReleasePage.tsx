import { useReducer, useState } from "react";
import { Modal, Radio } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { PageHeader, Button, EmptyState } from "../components/ui/Primitives";
import { getUser } from "../data/users";
import {
  CASES, CORE_CANDIDATES, EVALUATIONS, INVITATIONS, RESULTS, RELEASES,
  fmtDate, type Release,
} from "../data/fixtures";
import type { UserId } from "../store/types";
import { closeCase, handoffCaseToInterview, holdCase, releaseCaseResult, resumeCase, type CaseLifecycleState } from "../data/writtenApi";
import { latestResultForCase } from "../data/realPlanItemsMerge";

type CloseReason = "passed" | "rejected" | "withdrawn";
const CLOSE_REASONS: { value: CloseReason; label: string }[] = [
  { value: "passed", label: "Passed" },
  { value: "rejected", label: "Not passed" },
  { value: "withdrawn", label: "Candidate withdrew" },
];

/**
 * Ported from the prototype's pageRelease(caseId, opts). `inline` drops the breadcrumb/title (used
 * inside the candidate detail page's "Evaluation result" tab); `onGoToPlan` lets the caller switch to
 * the Plan tab instead of navigating away for "Add supplemental test".
 *
 * `result`/`evaluation`/`release` are read fresh from the shared RESULTS/EVALUATIONS/RELEASES module
 * objects on every render rather than cached in useState — this tab is mounted at the same time as
 * "Comprehensive evaluation", so when that sibling tab finalizes an evaluation (writing straight into
 * those same module objects) this one picks the change up on its next render without a page reload.
 * `forceTick` re-renders this component after a mutation *it* makes itself (publish, and the
 * post-release lifecycle actions); `onChanged` tells the host page the case status changed.
 *
 * Post-release actions (all persisted by hireos-written-backend's CaseLifecycleService):
 * hand off to Interview (a real call that creates the interview task), hold / resume, and close
 * testing with a reason. Handed-off and closed are terminal -- no further actions are offered.
 */
export function ReleaseContent({
  caseId, invitationId, isLatestRound = true, inline = false, onGoToPlan, onChanged,
}: {
  caseId: string;
  /** The round whose result this shows (#48); without it, the case's latest round. */
  invitationId?: string;
  /** Only the latest round offers the case-level next steps (hand off / supplemental test / close). */
  isLatestRound?: boolean;
  inline?: boolean;
  /** "Add supplemental test" -- the host opens the next draft round and switches to the plan. */
  onGoToPlan?: () => void;
  onChanged?: () => void;
}) {
  const { t, say } = useStore();
  const navigate = useNavigate();
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  const c = CASES[caseId];
  const result = invitationId ? RESULTS[`result_${invitationId}`] : latestResultForCase(caseId);
  const release = result?.releaseId ? RELEASES[result.releaseId] : undefined;

  const [chk1, setChk1] = useState(false);
  const [chk2, setChk2] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<CloseReason | null>(null);
  const [busy, setBusy] = useState(false);
  // What the candidate is told. Null = not edited yet, so the defaults below (which depend on the
  // result, possibly loaded after mount) apply; HR reviews and edits them before publishing.
  const [outcomeDraft, setOutcomeDraft] = useState<string | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState<string | null>(null);
  const [nextStepDraft, setNextStepDraft] = useState<string | null>(null);

  if (!c || !result) return <EmptyState title="No finalized result for this case yet." />;

  const cand = CORE_CANDIDATES[c.candidateId];
  const evaluation = EVALUATIONS[result.evaluationId];
  const inv = Object.values(INVITATIONS).find((i) => i.caseId === caseId);
  const disclosure = inv ? inv.disclosurePolicy : "score_and_summary";
  const outcomeText = outcomeDraft ?? t(result.overall >= 65 ? "Strong performance on this assessment." : "Below the bar for this role on this assessment.");
  // Pre-filled from the AI evaluator's summary of these answers -- never a canned sentence.
  const feedbackText = feedbackDraft ?? (evaluation.summary ?? "");
  const nextStepText = nextStepDraft ?? t("HR will follow up with next steps.");

  async function publish() {
    if (busy) return;
    if (!chk1 || !chk2) {
      say(t("Both review and disclosure approval are required to publish."), { type: "danger" });
      return;
    }
    if (!outcomeText.trim() || !feedbackText.trim() || !nextStepText.trim()) {
      say(t("Fill in the outcome, feedback and next step before publishing."), { type: "danger" });
      return;
    }
    const relId = `rel_${result!.invitationId ?? caseId}`;
    const rel: Release = {
      id: relId, caseId, overall: result!.overall, showScore: disclosure === "score_and_summary",
      outcomeText: outcomeText.trim(), feedbackText: feedbackText.trim(), nextStepText: nextStepText.trim(),
      publishedAt: new Date().toISOString(),
    };
    RELEASES[relId] = rel;
    result!.status = "published";
    result!.releaseId = relId;
    // Releasing an older round leaves the case where its latest round is (#48).
    if (isLatestRound) c.status = "released";
    // Real cases persist the published result -- that is what moves the task list to "Written
    // completed" and keeps it after a reload. Fixture-only demo cases stay in-memory only.
    if (result!.invitationId) {
      const { overall, showScore, outcomeText, feedbackText, nextStepText } = rel;
      setBusy(true);
      try {
        await releaseCaseResult(caseId, { overall, showScore, outcomeText, feedbackText, nextStepText, invitationId: result!.invitationId });
      } catch {
        say(t("Could not save to the server. Please refresh and try again."), { type: "danger" });
      } finally {
        setBusy(false);
      }
    }
    forceTick();
    onChanged?.();
    say(t("Result finalized and published. Candidate portal and notification queued."), { type: "success" });
  }

  /** Runs a lifecycle action against the backend and mirrors the resulting state onto CASES. */
  async function runAction(action: () => Promise<CaseLifecycleState>, successMsg: string): Promise<boolean> {
    setBusy(true);
    try {
      const next = await action();
      Object.assign(c, {
        status: next.status, closeReason: next.closeReason, closedAt: next.closedAt,
        handedOffAt: next.handedOffAt, interviewTaskId: next.interviewTaskId,
      });
      forceTick();
      onChanged?.();
      say(t(successMsg), { type: "success" });
      return true;
    } catch (error) {
      say(`${t("Action failed:")} ${error instanceof Error ? error.message : ""}`, { type: "danger" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmHandoff() {
    if (await runAction(() => handoffCaseToInterview(caseId), "Interview task created. The candidate is now in Interview.")) setHandoffOpen(false);
  }

  async function confirmClose() {
    if (!closeReason) {
      say(t("Choose why testing is ending."), { type: "danger" });
      return;
    }
    if (await runAction(() => closeCase(caseId, closeReason), "Testing closed.")) setCloseOpen(false);
  }

  function goToPlan() {
    if (onGoToPlan) onGoToPlan();
    else navigate(`/cases/${caseId}/plan`);
  }

  return (
    <div>
      {!inline && <PageHeader title={`${cand.name} — ${t("Release")}`} crumbs={[{ label: "Assessments", href: "/assessments" }, { label: cand.name }]} />}

      <div className="two-col">
        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Internal reference")}</h4>
          <div style={{ marginBottom: 4 }}>{t("Final overall (human)")}: <b style={{ fontSize: 18 }}>{result.overall}</b><span className="tiny"> / 100</span></div>
          {/* Say exactly where the number comes from: the reviewer's finalized scores, not the AI's. */}
          <div className="tiny" style={{ color: "var(--text-tertiary)", marginBottom: 8 }}>
            {t("Sum of the human scores below")} ({evaluation.criteria.reduce((sum, cr) => sum + (cr.human ?? 0), 0)} / {evaluation.criteria.reduce((sum, cr) => sum + cr.max, 0)}){t(", scaled to 100. AI suggestions are shown for reference only and are not counted.")}
          </div>
          <div className="tiny" style={{ display: "flex", justifyContent: "space-between", color: "var(--text-tertiary)", paddingBottom: 4, borderBottom: "1px solid var(--border)" }}>
            <span>{t("Criteria")}</span>
            <span>{t("Human score")} · {t("AI suggests")}</span>
          </div>
          {evaluation.criteria.map((cr) => (
            <div key={cr.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span>{cr.name}</span>
              <span>
                <b>{cr.human}</b>/{cr.max}
                <span className="tiny" style={{ color: "var(--text-tertiary)" }}> · AI {cr.ai}</span>
                {cr.human !== cr.ai ? <span className="tiny"> ({t("overridden")})</span> : null}
              </span>
            </div>
          ))}
          <div className="tiny" style={{ marginTop: 8 }}>
            {t("Finalized by")} {evaluation.finalizedBy ? getUser(evaluation.finalizedBy as UserId)?.name : "—"} · {fmtDate(evaluation.finalizedAt)}
          </div>
        </div>

        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Candidate preview")}</h4>
          <div className="tiny" style={{ marginBottom: 8 }}>{t("Disclosure policy:")} {disclosure === "score_and_summary" ? t("Score + summary") : t("Summary only")}</div>
          {release ? (
            // Published: show exactly what was released (older releases stored the English defaults).
            <div className="card card-pad" style={{ background: "var(--canvas)", whiteSpace: "pre-wrap" }}>
              <b>{t("Outcome:")}</b> {t(release.outcomeText)}<br />
              {release.showScore && <><b>{t("Score:")}</b> {release.overall}<br /></>}
              <b>{t("Feedback:")}</b> {t(release.feedbackText)}<br />
              <b>{t("Next step:")}</b> {t(release.nextStepText)}
            </div>
          ) : (
            <div className="card card-pad" style={{ background: "var(--canvas)" }}>
              <div className="field" style={{ marginBottom: 10 }}>
                <label>{t("Outcome:")}</label>
                <input className="input" value={outcomeText} onChange={(e) => setOutcomeDraft(e.target.value)} />
              </div>
              {disclosure === "score_and_summary" && <div style={{ marginBottom: 10 }}><b>{t("Score:")}</b> {result.overall}</div>}
              <div className="field" style={{ marginBottom: 10 }}>
                <label>{t("Feedback:")}</label>
                <textarea
                  className="input"
                  rows={5}
                  value={feedbackText}
                  placeholder={t("Write feedback on this candidate's answers.")}
                  onChange={(e) => setFeedbackDraft(e.target.value)}
                />
                <div className="tiny" style={{ color: "var(--text-tertiary)", marginTop: 4 }}>
                  {evaluation.summary ? t("Pre-filled from the AI evaluation of these answers — check it reads well for the candidate before publishing.") : t("No AI summary for these answers — please write the feedback yourself.")}
                </div>
              </div>
              <div className="field">
                <label>{t("Next step:")}</label>
                <input className="input" value={nextStepText} onChange={(e) => setNextStepDraft(e.target.value)} />
              </div>
            </div>
          )}
          <div className="tiny" style={{ marginTop: 8 }}>{t("Never includes: internal ranking, reviewer notes, or the internal answer key.")}</div>
        </div>
      </div>

      {!release ? (
        <div className="card card-pad" style={{ marginTop: 16 }}>
          <h4 style={{ marginBottom: 8 }}>{t("Approve & publish")}</h4>
          <label className="checkbox-row" style={{ marginBottom: 6, display: "flex" }}>
            <input type="checkbox" checked={chk1} onChange={(e) => setChk1(e.target.checked)} /> {t("Internal review complete")}
          </label>
          <label className="checkbox-row" style={{ marginBottom: 12, display: "flex" }}>
            <input type="checkbox" checked={chk2} onChange={(e) => setChk2(e.target.checked)} /> {t("Disclosure content approved for release")}
          </label>
          <Button variant="primary" disabled={busy} onClick={() => void publish()}>{t("Finalize & publish result")}</Button>
        </div>
      ) : (
        <>
          <div className="banner success" style={{ marginTop: 16 }}>
            {t("Published")} {fmtDate(release.publishedAt)}. {t("Delivery does not guarantee delivery — a bounce would still leave the result visible internally.")}
          </div>
          {isLatestRound && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{t("Next action")}</h4>
            <div className="tiny" style={{ marginBottom: 12 }}>{t("A proposal is prepared first; sending only happens after approval — sorting or comparing candidates never triggers a send.")}</div>
            {c.status === "handed_off" ? (
              <div className="banner success">
                {t("Handed off to interview")} {fmtDate(c.handedOffAt ?? null)}. {t("The interview task was created in Interview.")}
              </div>
            ) : c.status === "closed" ? (
              <div className="banner info">
                {t("Testing closed")} {fmtDate(c.closedAt ?? null)} · {t("Reason:")} {t(CLOSE_REASONS.find((r) => r.value === c.closeReason)?.label ?? "—")}
              </div>
            ) : c.status === "on_hold" ? (
              <div className="banner warning" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ flex: 1 }}>{t("This case is on hold. Resume it to continue.")}</span>
                <Button size="sm" disabled={busy} onClick={() => void runAction(() => resumeCase(caseId), "Case resumed.")}>{t("Resume testing")}</Button>
              </div>
            ) : (
              <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button onClick={goToPlan}>{t("Add supplemental test")}</Button>
                <Button disabled={busy} onClick={() => setHandoffOpen(true)}>{t("Prepare Interview handoff")}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => void runAction(() => holdCase(caseId), "Case placed on hold.")}>{t("Hold")}</Button>
                <Button variant="ghost" disabled={busy} onClick={() => { setCloseReason(null); setCloseOpen(true); }}>{t("Close testing")}</Button>
              </div>
            )}
          </div>
          )}
        </>
      )}

      <Modal
        open={handoffOpen}
        title={t("Hand off to Interview")}
        okText={t("Create interview task")}
        cancelText={t("Cancel")}
        confirmLoading={busy}
        onOk={() => void confirmHandoff()}
        onCancel={() => setHandoffOpen(false)}
      >
        {t("This creates an interview task for")} <b>{cand.name}</b> {t("in Interview and ends this written test. It cannot be undone here.")}
      </Modal>

      <Modal
        open={closeOpen}
        title={t("Close testing")}
        okText={t("Close testing")}
        okButtonProps={{ danger: true }}
        cancelText={t("Cancel")}
        confirmLoading={busy}
        onOk={() => void confirmClose()}
        onCancel={() => setCloseOpen(false)}
      >
        <div style={{ marginBottom: 12 }}>{t("Why is testing ending for")} <b>{cand.name}</b>{t("? This cannot be undone.")}</div>
        <Radio.Group value={closeReason} onChange={(e) => setCloseReason(e.target.value as CloseReason)} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {CLOSE_REASONS.map((r) => <Radio key={r.value} value={r.value}>{t(r.label)}</Radio>)}
        </Radio.Group>
      </Modal>
    </div>
  );
}

export function ReleasePage() {
  const { id: caseId = "" } = useParams();
  return <ReleaseContent caseId={caseId} />;
}
