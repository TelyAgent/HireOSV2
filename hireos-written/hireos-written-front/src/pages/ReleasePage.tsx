import { useReducer, useState, type ReactNode } from "react";
import { Modal, Popconfirm } from "antd";
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
// "passed" is no longer offered -- a candidate who passes goes to Interview (hand-off), and closing
// never creates an interview task. It stays here only to label cases closed that way before.
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

// Before 2026-10-14 every published result carried this prototype sentence as its feedback (#398).
const LEGACY_DEMO_FEEDBACK = "Clear structure; accounting treatment mostly correct with one gap in variance analysis.";
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

  const missingToPublish = [
    ...(chk1 ? [] : ["Internal review complete"]),
    ...(chk2 ? [] : ["Disclosure content approved for release"]),
    ...(outcomeText.trim() ? [] : ["Outcome"]),
    ...(feedbackText.trim() ? [] : ["Feedback"]),
    ...(nextStepText.trim() ? [] : ["Next step"]),
  ];

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
    // Real cases persist the published result -- that is what moves the task list to "Written
    // completed" and keeps it after a reload. Fixture-only demo cases stay in-memory only. Saved first: a
    // failed save leaves the result unpublished and says so, never followed by "published" (#357).
    if (result!.invitationId) {
      const { overall, showScore, outcomeText, feedbackText, nextStepText } = rel;
      setBusy(true);
      try {
        await releaseCaseResult(caseId, { overall, showScore, outcomeText, feedbackText, nextStepText, invitationId: result!.invitationId, reviewComplete: chk1, disclosureApproved: chk2 });
      } catch {
        say(t("Could not save to the server. Please refresh and try again."), { type: "danger" });
        return;
      } finally {
        setBusy(false);
      }
    }
    RELEASES[relId] = rel;
    result!.status = "published";
    result!.releaseId = relId;
    // Releasing an older round leaves the case where its latest round is (#48).
    if (isLatestRound) c.status = "released";
    forceTick();
    onChanged?.();
    say(t("Result finalized and published."), { type: "success" });
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

  async function confirmClose(reason: CloseReason) {
    await runAction(() => closeCase(caseId, reason), "Testing closed.");
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
            {t("Finalized by")} {evaluation.finalizedBy ? (getUser(evaluation.finalizedBy as UserId)?.name ?? evaluation.finalizedBy) : "—"} · {fmtDate(evaluation.finalizedAt)}
          </div>
        </div>

        <div className="card card-pad">
          <h4 style={{ marginBottom: 8 }}>{t("Candidate preview")}</h4>
          {/* Published: the policy is what that release stored, not the invitation's setting today (#395). */}
          <div className="tiny" style={{ marginBottom: 8 }}>
            {t("Disclosure policy:")}{" "}
            {release
              ? typeof release.showScore === "boolean"
                ? release.showScore ? t("Score + summary") : t("Summary only")
                : t("Not recorded for this release — check what the candidate was sent.")
              : disclosure === "score_and_summary" ? t("Score + summary") : t("Summary only")}
          </div>
          {release && release.showScore && typeof release.overall !== "number" && (
            <div className="banner warning" style={{ marginBottom: 8 }}>{t("This release is marked Score + summary but no score was stored with it — check what the candidate was sent.")}</div>
          )}
          {release && release.feedbackText.trim() === LEGACY_DEMO_FEEDBACK && (
            <div className="banner warning" style={{ marginBottom: 8 }}>
              {t("This feedback is the demo sentence that releases published before 14 Oct 2026 carried by mistake — it was not written for this candidate.")}
            </div>
          )}
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
          {/* Publishing waits for both approvals and the three texts, and says which are still missing (#393). */}
          {missingToPublish.length > 0 && (
            <div className="tiny" role="status" style={{ marginBottom: 8, color: "var(--text-secondary)" }}>
              {t("Still needed before publishing:")} {missingToPublish.map((m) => t(m)).join(t(", "))}
            </div>
          )}
          <Button variant="primary" disabled={busy || missingToPublish.length > 0} onClick={() => void publish()}>{t("Finalize & publish result")}</Button>
        </div>
      ) : (
        <>
          <div className="banner success" style={{ marginTop: 16 }}>
            {/* No result notification is sent yet, so there is no delivery to qualify (#358). Once one is, add:
                "Publishing doesn't guarantee delivery — if the email bounces, the result stays published and visible internally." */}
            {t("Published")} {fmtDate(release.publishedAt)}.
          </div>
          {isLatestRound && (
          <div className="card card-pad" style={{ marginTop: 16 }}>
            <h4 style={{ marginBottom: 8 }}>{t("Next action")}</h4>
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
              // Every option laid out with what it actually does, so nothing has to be guessed.
              <div className="next-actions">
                <NextAction
                  title={t("Move to interview")}
                  hint={t("Creates an interview task in Interview; the written test ends. Cannot be undone.")}
                  action={<Button variant="primary" disabled={busy} onClick={() => setHandoffOpen(true)}>{t("Move to interview")}</Button>}
                />
                <NextAction
                  title={t("Add supplemental test")}
                  hint={t("Opens another round: pick its questions in the plan, then send it.")}
                  action={<Button onClick={goToPlan}>{t("Add supplemental test")}</Button>}
                />
                <NextAction
                  title={t("Not passed")}
                  hint={t("Ends the written test as not passed. No interview task is created. Cannot be undone.")}
                  action={
                    <Popconfirm title={t("End the written test as not passed?")} okText={t("Confirm")} cancelText={t("Cancel")} okButtonProps={{ danger: true }} onConfirm={() => confirmClose("rejected")}>
                      <Button disabled={busy}>{t("Not passed")}</Button>
                    </Popconfirm>
                  }
                />
                <NextAction
                  title={t("Candidate withdrew")}
                  hint={t("Ends the written test because the candidate dropped out. Cannot be undone.")}
                  action={
                    <Popconfirm title={t("End the written test because the candidate withdrew?")} okText={t("Confirm")} cancelText={t("Cancel")} okButtonProps={{ danger: true }} onConfirm={() => confirmClose("withdrawn")}>
                      <Button disabled={busy}>{t("Candidate withdrew")}</Button>
                    </Popconfirm>
                  }
                />
                <NextAction
                  title={t("Hold")}
                  hint={t("Pauses this candidate without deciding (e.g. waiting on the role or the candidate). Resume any time.")}
                  action={<Button variant="ghost" disabled={busy} onClick={() => void runAction(() => holdCase(caseId), "Case placed on hold.")}>{t("Hold")}</Button>}
                />
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

    </div>
  );
}

export function ReleasePage() {
  const { id: caseId = "" } = useParams();
  return <ReleaseContent caseId={caseId} />;
}

function NextAction({ title, hint, action }: { title: string; hint: string; action: ReactNode }) {
  return (
    <div className="next-action">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <div className="tiny" style={{ color: "var(--text-tertiary)" }}>{hint}</div>
      </div>
      {action}
    </div>
  );
}
