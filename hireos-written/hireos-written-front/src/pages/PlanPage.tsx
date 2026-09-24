import { useEffect, useReducer, useState } from "react";
import { useParams } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Breadcrumbs, Button, EmptyState, Tabs } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icon";
import { planPageSelectedTab } from "../utils/planTabState";
import { AssessmentQuestionDrawer } from "../components/AssessmentQuestionDrawer";
import { SendToCandidateDrawer } from "../components/SendToCandidateDrawer";
import { SubmissionDetailContent } from "./SubmissionDetailPage";
import { EvaluationReviewContent } from "./EvaluationReviewPage";
import { ReleaseContent } from "./ReleasePage";
import {
  ATTEMPTS, CASES, CORE_APPLICATIONS, CORE_CANDIDATES, CORE_JOBS, INVITATIONS, PLANS, PROJECT, QUESTIONS, fmtDateShort,
  type Invitation, type PlanItem, type Question,
} from "../data/fixtures";
import { USERS } from "../data/users";
import {
  createPlanItem, deletePlanItem, listCaseInvitations, listPlanItems, updatePlanItem,
  type RealInvitation,
} from "../data/writtenApi";
import { applyRealPlanItems } from "../data/realPlanItemsMerge";

type TabKey = "plan" | "submission" | "evaluation" | "result";
type QuestionDrawerState = { mode: "add" } | { mode: "edit"; planItem: PlanItem } | null;

/**
 * The candidate detail page — ported from the prototype's pagePlan(caseId), which merged what used to
 * be four separate routed pages (plan / submission / evaluation / release) into one page with four
 * tabs, so a reviewer can work through a candidate end to end without losing their place. The three
 * non-"plan" tabs render the *same* content components the standalone /attempts/:id/submission,
 * /attempts/:id/review and /results/:id/release routes still use (via their `inline` prop) — those
 * routes stay intact for anything that links to them directly (e.g. the Submission Inbox).
 *
 * All four tab panels are mounted at once and switched with plain `display: none` rather than
 * conditional rendering, so typing a human score into "Comprehensive evaluation" isn't lost if you
 * flip over to "Submission" and back — same as the prototype's `panel.hidden = ...` toggling.
 */
export function PlanPage() {
  const { id: caseId = "" } = useParams();
  const { t, say, state } = useStore();
  const c = CASES[caseId];

  const [activeTab, setActiveTabState] = useState<TabKey>(planPageSelectedTab[caseId] ?? "plan");
  const setActiveTab = (key: TabKey) => {
    planPageSelectedTab[caseId] = key;
    setActiveTabState(key);
  };

  const [owner, setOwner] = useState<string>(c?.ownership?.hrOwner ?? "");
  const [deadline, setDeadline] = useState<string>(() => c?.rounds[0]?.deadlineAt ?? "");
  const [questionDrawer, setQuestionDrawer] = useState<QuestionDrawerState>(null);
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  // Question add/edit/delete/send all mutate the shared PLANS/CASES/INVITATIONS module objects
  // directly (matching how CASES.status, RESULTS, EVALUATIONS and RELEASES are already handled
  // elsewhere in this port) rather than a local copy, so they survive navigating away and back within
  // the app — not just staying visible for the current mount. `forceTick` re-renders this component
  // after a mutation it makes itself, since React has no way to know the module object changed.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // Real cases (created via a real screening handoff) can hold real Invitations/Submissions in
  // hireos-written-backend — fetched best-effort so a fixture-only demo case (404) just shows
  // nothing extra rather than an error. Keyed by token to cross-reference against the
  // INVITATIONS fixture entry each QuestionCard already resolves for its "already sent" state.
  const [realInvitations, setRealInvitations] = useState<RealInvitation[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<RealInvitation | null>(null);
  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    listCaseInvitations(caseId)
      .then((list) => { if (!cancelled) setRealInvitations(list); })
      .catch(() => { if (!cancelled) setRealInvitations([]); });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  // Real cases can also hold real PlanItems (see plan-items module) -- fetched once per case load
  // and written into the QUESTIONS/PLANS fixture dicts (see realPlanItemsMerge.ts) so a page reload
  // no longer loses a candidate's assigned questions the way it used to when this lived only in the
  // browser's in-memory fixtures. A 404 (fixture-only demo case) leaves the existing fixture plan
  // items untouched.
  //
  // Depends on realTasksVersion too: on a hard page reload, this effect (a descendant of <App>)
  // fires *before* App's own real-task-loading effect resolves (child effects run before parent
  // effects within the same mount), so CASES[caseId] can still be empty the first time this runs.
  // Re-running once realTasksVersion bumps (App's load finished) is what makes this eventually see
  // the real Case.
  useEffect(() => {
    if (!caseId) return;
    let cancelled = false;
    listPlanItems(caseId)
      .then((list) => {
        if (cancelled) return;
        const kase = CASES[caseId];
        if (!kase) return;
        applyRealPlanItems(caseId, list, kase, kase.rounds[0]);
        forceTick();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [caseId, state.realTasksVersion]);

  if (!c) return <div className="banner danger">{t("Case not found.")}</div>;

  const cand = CORE_CANDIDATES[c.candidateId];
  const round = c.rounds[0];
  const items = round.planItemIds.map((id) => PLANS[id]).filter(Boolean);
  const primaryItem = items[0] ?? null;
  const app = c.applicationId ? CORE_APPLICATIONS[c.applicationId] : undefined;
  const job = (app && CORE_JOBS[app.jobId]) || CORE_JOBS[PROJECT.jobId];
  const invs = Object.values(INVITATIONS).filter((i) => i.caseId === caseId);
  const realByToken = new Map(realInvitations.map((r) => [r.token, r]));
  // "Send to candidate" now bundles every not-yet-sent item in one action (it already did this
  // under the hood via SendToCandidateDrawer's `items` prop — this just moves the trigger up to a
  // single section-level button instead of one per question card).
  const canSendBatch = !!c.applicationId && items.length > 0 && items.some((pi) => !invs.find((inv) => inv.questionIds.includes(pi.questionId)));
  const attempts = Object.values(ATTEMPTS).filter((a) => a.caseId === caseId);
  const primaryAttempt = attempts[0];

  const goalQuestion = primaryItem ? QUESTIONS[primaryItem.questionId] : null;
  const goalCompetencies = goalQuestion ? goalQuestion.competencies.map((cc) => cc.name).join("、") : "";
  const goalText = goalCompetencies
    ? `${t("Verify whether the candidate can demonstrate, through this role assessment:")} ${job.title} ${t("role capability —")} ${goalCompetencies}。`
    : `${t("Verify whether the candidate can demonstrate, through this role assessment:")} ${job.title} ${t("role's core capability and delivery level.")}`;

  function deleteQuestion(pi: PlanItem) {
    c.planItems = c.planItems.filter((id) => id !== pi.id);
    round.planItemIds = round.planItemIds.filter((id) => id !== pi.id);
    delete PLANS[pi.id];
    forceTick();
    say(t("Question deleted."), { type: "success" });
    // Best-effort -- a fixture-only demo case's plan item was never real to begin with, so a 404
    // here is expected and safely ignored (matches SendToCandidateDrawer's fallback pattern).
    deletePlanItem(caseId, pi.id).catch(() => {});
  }

  async function handleQuestionConfirm({ questionId, customPrompt, newQuestion }: { questionId: string; customPrompt: string | null; newQuestion?: Question }) {
    if (questionDrawer?.mode === "edit") {
      const { planItem } = questionDrawer;
      PLANS[planItem.id] = { ...planItem, questionId, customPrompt };
      forceTick();
      updatePlanItem(caseId, planItem.id, { customPrompt: customPrompt ?? undefined }).catch(() => {});
      return;
    }
    // PlanItem.kind is "required" | "optional" — the prototype's own runtime data used a third
    // "supplemental" value for a question added after the first, which doesn't fit that union;
    // "optional" is the closest fit (a plan item added on top of the round's first, required one).
    const kind: PlanItem["kind"] = items.length === 0 ? "required" : "optional";
    const q = newQuestion ?? QUESTIONS[questionId];
    try {
      const created = await createPlanItem(caseId, {
        kind, questionCode: q.code, questionTitle: q.title, questionPrompt: q.prompt,
        customPrompt: customPrompt ?? undefined, competencies: q.competencies, deliverables: q.deliverables,
      });
      PLANS[created.id] = { id: created.id, caseId, questionId, kind, status: created.status, customPrompt };
      c.planItems.push(created.id);
      round.planItemIds.push(created.id);
    } catch {
      // Fixture-only demo case -- fall back to a local-only simulated add, same as before.
      const piId = `pi_${caseId}_${round.id.replace(`round_${caseId}_`, "")}_${questionId}`;
      PLANS[piId] = { id: piId, caseId, questionId, kind, status: "awaiting_submission", customPrompt };
      c.planItems.push(piId);
      round.planItemIds.push(piId);
    }
    forceTick();
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "My Tasks", href: "/tasks" }, { label: "Candidate detail" }]} />
      <h1 style={{ marginBottom: 4 }}>{cand.name}{t("'s plan")}</h1>
      <div className="muted" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
        {cand.email} · <StatusBadge status={c.status} />
      </div>

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "plan", label: "Assessment plan" },
          { value: "submission", label: "Submission" },
          { value: "evaluation", label: "Comprehensive evaluation" },
          { value: "result", label: "Evaluation result" },
        ]}
      />
      <div style={{ marginBottom: 16 }} />

      {!c.applicationId && (
        <div className="banner warning" style={{ marginBottom: 16 }}>{t("Confirm the candidate's role link first — invitations for a formal role assessment require a confirmed Application.")}</div>
      )}

      <div style={{ display: activeTab === "plan" ? "block" : "none" }}>
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <h4 style={{ marginBottom: 8 }}>{t("Verification goal")}</h4>
          <div className="tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>{goalText}</div>
        </div>

        <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
          <div className="field">
            <label>{t("Owner")}</label>
            <select className="input" value={owner} onChange={(e) => { setOwner(e.target.value); say("Owner updated.", { type: "success" }); }}>
              <option value="">{t("— Not set (defaults to initiator) —")}</option>
              {Object.values(USERS).map((u) => (
                <option key={u.id} value={u.id}>{u.name} · {u.role}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>{t("Submission deadline")}</label>
            <input
              className="input"
              type="datetime-local"
              value={deadline ? deadline.slice(0, 16) : ""}
              onChange={(e) => { setDeadline(e.target.value ? new Date(`${e.target.value}:00Z`).toISOString() : ""); say("Deadline updated.", { type: "success" }); }}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
          <h4 style={{ margin: 0 }}>{t("Assessment questions")}</h4>
          <div style={{ display: "flex", gap: 8, flex: "none" }}>
            <Button size="sm" onClick={() => setQuestionDrawer({ mode: "add" })}>
              <Icon name="add" style={{ fontSize: 16, verticalAlign: "text-bottom" }} /> {t("Add assessment question")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              disabled={!canSendBatch}
              title={!c.applicationId ? t("Confirm the candidate's role link first") : undefined}
              onClick={() => setSendDrawerOpen(true)}
            >
              {t("Send to candidate")}
            </Button>
          </div>
        </div>
        <div className="tiny" style={{ color: "var(--text-tertiary)", marginBottom: 12 }}>
          {t("Confirming freezes this into a pending-send version; it is not sent to the candidate immediately.")}
        </div>

        {items.length === 0 ? (
          <EmptyState icon="assignment" title='No assessment questions yet. Click "Add assessment question" to get started.' />
        ) : (
          items.map((pi) => (
            <QuestionCard
              key={pi.id}
              pi={pi}
              invitations={invs}
              realByToken={realByToken}
              onDelete={() => deleteQuestion(pi)}
              onEdit={() => setQuestionDrawer({ mode: "edit", planItem: pi })}
              onViewSubmission={() => setActiveTab("submission")}
              onViewRealSubmission={setViewingSubmission}
            />
          ))
        )}
      </div>

      <div style={{ display: activeTab === "submission" ? "block" : "none" }}>
        {primaryAttempt ? (
          <SubmissionDetailContent attemptId={primaryAttempt.id} inline onGoToEvaluation={() => setActiveTab("evaluation")} />
        ) : (
          <EmptyState icon="inbox" title="No submission received yet." />
        )}
      </div>

      <div style={{ display: activeTab === "evaluation" ? "block" : "none" }}>
        {primaryAttempt ? (
          <EvaluationReviewContent attemptId={primaryAttempt.id} inline onViewFinalResult={() => setActiveTab("result")} />
        ) : (
          <EmptyState icon="fact_check" title="Waiting for result" />
        )}
      </div>

      <div style={{ display: activeTab === "result" ? "block" : "none" }}>
        <ReleaseContent caseId={caseId} inline onGoToPlan={() => setActiveTab("plan")} />
      </div>

      <AssessmentQuestionDrawer
        open={!!questionDrawer}
        onClose={() => setQuestionDrawer(null)}
        caseId={caseId}
        jobTitle={job.title}
        editing={questionDrawer?.mode === "edit" ? { planItem: questionDrawer.planItem, question: QUESTIONS[questionDrawer.planItem.questionId] } : undefined}
        onConfirm={handleQuestionConfirm}
      />

      <SendToCandidateDrawer
        open={sendDrawerOpen}
        onClose={() => setSendDrawerOpen(false)}
        caseId={caseId}
        round={round}
        items={items}
        onSent={() => {
          setSendDrawerOpen(false);
          listCaseInvitations(caseId).then(setRealInvitations).catch(() => {});
        }}
      />

      <Modal
        open={!!viewingSubmission}
        onCancel={() => setViewingSubmission(null)}
        footer={null}
        title={t("Candidate's submission")}
        width={560}
      >
        {viewingSubmission?.submission?.answers.map((a) => {
          const q = (viewingSubmission.questions ?? []).find((qq) => qq.questionId === a.questionId);
          return (
            <div key={a.questionId} className="card card-pad" style={{ marginBottom: 12 }}>
              <b>{q ? `${q.code} · ${q.title}` : a.questionId}</b>
              <div className="tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginTop: 8 }}>
                {a.answerText}
              </div>
            </div>
          );
        })}
        {viewingSubmission?.submission && (
          <div className="tiny" style={{ color: "var(--text-tertiary)" }}>
            {t("Submitted at")} {fmtDateShort(viewingSubmission.submission.submittedAt)}
          </div>
        )}
      </Modal>
    </div>
  );
}

function QuestionCard({
  pi, invitations, realByToken, onDelete, onEdit, onViewSubmission, onViewRealSubmission,
}: {
  pi: PlanItem;
  invitations: Invitation[];
  realByToken: Map<string, RealInvitation>;
  onDelete: () => void;
  onEdit: () => void;
  onViewSubmission: () => void;
  onViewRealSubmission: (inv: RealInvitation) => void;
}) {
  const { t } = useStore();
  const q = QUESTIONS[pi.questionId];
  const sentInvite = invitations.find((inv) => inv.questionIds.includes(pi.questionId));
  const alreadySent = !!sentInvite;
  const realInvite = sentInvite?.token ? realByToken.get(sentInvite.token) : undefined;
  const bodyText = pi.customPrompt ?? q.prompt;

  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        <div>
          <b>{q.code} · {q.title}</b>
          <div className="tiny" style={{ marginTop: 2 }}>{t("adjustable for this candidate only")}</div>
        </div>
        <StatusBadge status={pi.status} />
      </div>
      <div className="tiny" style={{ color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 90, overflow: "auto", marginBottom: 10 }}>
        {bodyText}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {alreadySent ? (
          <>
            <Button size="sm" disabled>
              {realInvite?.status === "submitted" ? t("Submitted") : realInvite?.status === "opened" ? t("Opened") : t("Sent")}
            </Button>
            {sentInvite && (
              <span className="tiny" style={{ color: "var(--text-tertiary)" }}>
                {sentInvite.mode === "timed" ? `${sentInvite.durationMin} ${t("min timed")}` : t("Deadline only")} · {t("deadline")} {fmtDateShort(sentInvite.deadline)}
              </span>
            )}
            <div style={{ flex: 1 }} />
            {realInvite?.submission ? (
              <Button size="sm" variant="ghost" onClick={() => onViewRealSubmission(realInvite)}>{t("View candidate's reply →")}</Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={onViewSubmission}>{t("View submission →")}</Button>
            )}
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onEdit}>{t("Edit question")}</Button>
            <Button size="sm" variant="danger" onClick={onDelete}>{t("Delete question")}</Button>
          </>
        )}
      </div>
    </div>
  );
}
