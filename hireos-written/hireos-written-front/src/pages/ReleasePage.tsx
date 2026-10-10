import { useReducer, useState } from "react";
import { Modal, Radio } from "antd";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { PageHeader, Button, EmptyState } from "../components/ui/Primitives";
import { getUser } from "../data/users";
import {
  ATTEMPTS, CASES, CORE_CANDIDATES, EVALUATIONS, INVITATIONS, RESULTS, RELEASES,
  fmtDate, type Release,
} from "../data/fixtures";
import type { UserId } from "../store/types";
import { closeCase, handoffCaseToInterview, holdCase, releaseCaseResult, resumeCase, type CaseLifecycleState } from "../data/writtenApi";

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
export function ReleaseContent({ caseId, inline = false, onGoToPlan, onChanged }: { caseId: string; inline?: boolean; onGoToPlan?: () => void; onChanged?: () => void }) {
  const { t, say } = useStore();
  const navigate = useNavigate();
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  const c = CASES[caseId];
  const result = Object.values(RESULTS).find((r) => r.caseId === caseId);
  const release = Object.values(RELEASES).find((r) => r.caseId === caseId);

  const [chk1, setChk1] = useState(false);
  const [chk2, setChk2] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeReason, setCloseReason] = useState<CloseReason | null>(null);
  const [busy, setBusy] = useState(false);

  if (!c || !result) return <EmptyState title="No finalized result for this case yet." />;

  const cand = CORE_CANDIDATES[c.candidateId];
  const evaluation = EVALUATIONS[result.evaluationId];
  const inv = Object.values(INVITATIONS).find((i) => i.caseId === caseId);
  const disclosure = inv ? inv.disclosurePolicy : "score_and_summary";

  function publish() {
    if (!chk1 || !chk2) {
      say("Both review and disclosure approval are required to publish.", { type: "danger" });
      return;
    }
    const relId = `rel_${caseId}`;
    const rel: Release = {
      id: relId, caseId, overall: result!.overall, showScore: disclosure === "score_and_summary",
      outcomeText: result!.overall >= 65 ? "Strong performance on this assessment." : "This assessment did not meet the bar for this role.",
      feedbackText: "Clear structure; accounting treatment mostly correct with one gap in variance analysis.",
      nextStepText: "HR will follow up with next steps.", publishedAt: new Date().toISOString(),
    };
    RELEASES[relId] = rel;
    result!.status = "published";
    result!.releaseId = relId;
    c.status = "released";
    // Real cases persist the published result -- that is what moves the task list to "Written
    // completed" and keeps it after a reload. Fixture-only demo cases stay in-memory only.
    if (ATTEMPTS[`att_real_${caseId}`]) {
      const { overall, showScore, outcomeText, feedbackText, nextStepText } = rel;
      releaseCaseResult(caseId, { overall, showScore, outcomeText, feedbackText, nextStepText })
        .catch(() => say(t("Could not save to the server. Please refresh and try again."), { type: "danger" }));
    }
    forceTick();
    onChanged?.();
    say("Result finalized and published. Candidate portal and notification queued.", { type: "success" });
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
          <div className="tiny" style={{ marginBottom: 8 }}>{t("Overall (human)")}: <b>{result.overall}</b></div>
          {evaluation.criteria.map((cr) => (
            <div key={cr.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <span>{cr.name}</span>
              <span>{cr.human}/{cr.max}{cr.overridden ? <span className="tiny"> ({t("overridden")})</span> : null}</span>
            </div>
          ))}
          <div className="tiny" style={{ marginTop: 8 }}>
            {t("Finalized by")} {evaluation.finalizedBy ? getUser(evaluation.finalizedBy as UserId)?.name : "—"} · {fmtDate(evaluation.finalizedAt)}
          </div>
        </div>

        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Candidate preview")}</h4>
          <div className="tiny" style={{ marginBottom: 8 }}>{t("Disclosure policy:")} {disclosure === "score_and_summary" ? t("Score + summary") : t("Summary only")}</div>
          <div className="card card-pad" style={{ background: "var(--canvas)" }}>
            <b>{t("Outcome:")}</b> {result.overall >= 65 ? t("Strong performance on this assessment.") : t("Below the bar for this role on this assessment.")}<br />
            {disclosure === "score_and_summary" && <><b>{t("Score:")}</b> {result.overall}<br /></>}
            <b>{t("Feedback:")}</b> {t("Clear structure; accounting treatment mostly correct with one gap in variance analysis.")}<br />
            <b>{t("Next step:")}</b> {t("HR will follow up with next steps.")}
          </div>
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
          <Button variant="primary" onClick={publish}>{t("Finalize & publish result")}</Button>
        </div>
      ) : (
        <>
          <div className="banner success" style={{ marginTop: 16 }}>
            {t("Published")} {fmtDate(release.publishedAt)}. {t("Delivery does not guarantee delivery — a bounce would still leave the result visible internally.")}
          </div>
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
