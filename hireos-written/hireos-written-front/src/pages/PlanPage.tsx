import { useCallback, useEffect, useReducer, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { StatusBadge } from "../utils/status";
import { Badge, Breadcrumbs, Button, EmptyState, Tabs } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icon";
import { planPageSelectedTab } from "../utils/planTabState";
import { finalOverall } from "../utils/score";
import { AssessmentQuestionDrawer } from "../components/AssessmentQuestionDrawer";
import { SendToCandidateDrawer } from "../components/SendToCandidateDrawer";
import { RealSubmissionContent } from "./SubmissionDetailPage";
import { EvaluationReviewContent } from "./EvaluationReviewPage";
import { ReleaseContent } from "./ReleasePage";
import {
  CASES, CORE_APPLICATIONS, CORE_CANDIDATES, CORE_JOBS, PLANS, PROJECT, QUESTIONS, RESULTS, fmtDateShort,
  type PlanItem, type Question,
} from "../data/fixtures";
import {
  createPlanItem, deletePlanItem, discardDraftRound, getRoundState, listCaseInvitations, listPlanItems, openDraftRound, updatePlanItem,
  type RealInvitation, type RealPlanItem, type RoundState,
} from "../data/writtenApi";
import { writtenStatusFromCase } from "../utils/writtenTasks";
import { tasksHref } from "../utils/tasksReturn";
import { applyRealEvaluation, applyRealPlanItems } from "../data/realPlanItemsMerge";

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

  // A link can open a given tab, e.g. My Tasks' "score this candidate" (#403); otherwise the last one used.
  const [searchParams] = useSearchParams();
  const linkedTab = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState<TabKey>(
    linkedTab === "plan" || linkedTab === "submission" || linkedTab === "evaluation" || linkedTab === "result" ? linkedTab : planPageSelectedTab[caseId] ?? "plan",
  );
  const setActiveTab = (key: TabKey) => {
    planPageSelectedTab[caseId] = key;
    setActiveTabState(key);
  };

  const [questionDrawer, setQuestionDrawer] = useState<QuestionDrawerState>(null);
  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  // Question add/edit/delete mutate the shared PLANS/QUESTIONS module objects directly (so they survive
  // navigating away and back); `forceTick` re-renders after a mutation this component makes itself.
  const [, forceTick] = useReducer((n: number) => n + 1, 0);

  // #48: every sent invitation is one round (oldest first); plan items without an invitation form the
  // case's single draft round. All three come from hireos-written-backend and are re-read after every
  // round-changing action (send, open / discard a supplemental round).
  const [realInvitations, setRealInvitations] = useState<RealInvitation[]>([]);
  const [realPlanItems, setRealPlanItems] = useState<RealPlanItem[]>([]);
  const [roundState, setRoundState] = useState<RoundState | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set());
  /** The round the submission / evaluation / result tabs show; defaults to the latest one (AC-5). */
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!caseId) return;
    const [invitations, items, rounds] = await Promise.all([
      listCaseInvitations(caseId).catch(() => [] as RealInvitation[]),
      listPlanItems(caseId).catch(() => null),
      getRoundState(caseId).catch(() => null),
    ]);
    setRealInvitations([...invitations].sort((x, y) => x.round - y.round));
    if (items) {
      setRealPlanItems(items);
      const kase = CASES[caseId];
      if (kase) applyRealPlanItems(caseId, items, kase, kase.rounds[0]);
    }
    setRoundState(rounds);
    forceTick();
  }, [caseId]);

  // Depends on realTasksVersion too: on a hard reload this effect can run before App's own real-task
  // load has filled CASES[caseId]; re-running once it bumps makes the plan items land on the case.
  useEffect(() => {
    void reload();
  }, [reload, state.realTasksVersion]);

  if (!c) return <div className="banner danger">{t("Case not found.")}</div>;

  const cand = CORE_CANDIDATES[c.candidateId];
  const round = c.rounds[0];
  const app = c.applicationId ? CORE_APPLICATIONS[c.applicationId] : undefined;
  const job = (app && CORE_JOBS[app.jobId]) || CORE_JOBS[PROJECT.jobId];

  const sentRounds = realInvitations;
  const latestRound = sentRounds[sentRounds.length - 1];
  const draftItems = realPlanItems.filter((item) => !item.invitationId).map((item) => PLANS[item.id]).filter(Boolean);
  // Before the backend answers (or for a fixture-only case) the case is treated as "nothing sent yet".
  const draftRound = roundState ? roundState.draftRound : sentRounds.length === 0 ? { round: 1, items: draftItems.length } : null;
  const ended = c.status === "handed_off" || c.status === "closed";

  // Every submitted round is seeded into ATTEMPTS/EVALUATIONS/RESULTS under its own ids.
  const attemptByRound = new Map<string, string>();
  for (const inv of sentRounds) {
    const attemptId = applyRealEvaluation(caseId, inv);
    if (attemptId) attemptByRound.set(inv.id, attemptId);
  }
  const selectedRound = sentRounds.find((inv) => inv.id === selectedRoundId) ?? latestRound;
  const selectedAttemptId = selectedRound ? attemptByRound.get(selectedRound.id) : undefined;
  const isSelectedLatest = !!selectedRound && selectedRound.id === latestRound?.id;

  const overallStatus = writtenStatusFromCase(c.status) ?? "pending_test";
  const firstItem = realPlanItems.length ? PLANS[realPlanItems[0].id] : draftItems[0];
  const goalQuestion = firstItem ? QUESTIONS[firstItem.questionId] : null;
  const goalCompetencies = goalQuestion ? goalQuestion.competencies.map((cc) => cc.name).join("、") : "";
  const goalText = goalCompetencies
    ? `${t("Verify whether the candidate can demonstrate, through this role assessment:")} ${job.title} ${t("role capability —")} ${goalCompetencies}。`
    : `${t("Verify whether the candidate can demonstrate, through this role assessment:")} ${job.title} ${t("role's core capability and delivery level.")}`;

  const roundLabel = (n: number) => t("Round {n}").replace("{n}", String(n));
  const viewRound = (inv: RealInvitation, tab: TabKey) => {
    setSelectedRoundId(inv.id);
    setActiveTab(tab);
  };
  const toggleRound = (id: string) =>
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** "Add supplemental test" (plan tab or result tab): opens the next round as a draft -- or jumps to the open one. */
  async function startSupplementalRound() {
    setActiveTab("plan");
    if (draftRound) return;
    setBusy(true);
    try {
      setRoundState(await openDraftRound(caseId));
      say(t("Round {n} opened — add its questions, then send it.").replace("{n}", String(sentRounds.length + 1)), { type: "success" });
    } catch {
      say(t("Could not open a new round. Please refresh and try again."), { type: "danger" });
    } finally {
      setBusy(false);
    }
  }

  async function cancelDraftRound() {
    setBusy(true);
    try {
      setRoundState(await discardDraftRound(caseId));
    } catch {
      say(t("Remove this round's questions before cancelling it."), { type: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function deleteQuestion(pi: PlanItem) {
    deletePlanItem(caseId, pi.id)
      .then(() => {
        delete PLANS[pi.id];
        say(t("Question deleted."), { type: "success" });
        return reload();
      })
      .catch(() => say(t("This question was already sent and can no longer be changed."), { type: "danger" }));
  }

  async function handleQuestionConfirm({ questionId, customPrompt, newQuestion }: { questionId: string; customPrompt: string | null; newQuestion?: Question }) {
    if (questionDrawer?.mode === "edit") {
      const { planItem } = questionDrawer;
      try {
        await updatePlanItem(caseId, planItem.id, { customPrompt: customPrompt ?? undefined });
        PLANS[planItem.id] = { ...planItem, questionId, customPrompt };
        forceTick();
      } catch {
        say(t("This question was already sent and can no longer be changed."), { type: "danger" });
      }
      return;
    }
    const kind: PlanItem["kind"] = draftItems.length === 0 ? "required" : "optional";
    const q = newQuestion ?? QUESTIONS[questionId];
    try {
      const created = await createPlanItem(caseId, {
        kind, questionCode: q.code, questionTitle: q.title, questionPrompt: q.prompt,
        customPrompt: customPrompt ?? undefined, competencies: q.competencies, deliverables: q.deliverables,
      });
      // Re-key the question to the id it will have after any reload (`q_real_<planItemId>`, see
      // realPlanItemsMerge.toQuestion) -- an invitation snapshots this id when sent.
      const stableQuestionId = `q_real_${created.id}`;
      QUESTIONS[stableQuestionId] = { ...q, id: stableQuestionId, caseScoped: true };
      await reload();
    } catch {
      say(t("Could not save to the server. Please refresh and try again."), { type: "danger" });
    }
  }

  return (
    <div>
      <Breadcrumbs items={[{ label: "My Tasks", href: tasksHref() }, { label: "Candidate detail" }]} />
      <h1 style={{ marginBottom: 4 }}>{cand.name}{t("'s plan")}</h1>
      <div className="muted" style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {cand.email} · <StatusBadge status={overallStatus} />
        {/* Where the case is (#48): the round in progress, or the round being drafted. */}
        {draftRound && sentRounds.length > 0 ? (
          <Badge tone="info">{t("Round {n} — drafting").replace("{n}", String(draftRound.round))}</Badge>
        ) : latestRound ? (
          <Badge tone="neutral">{roundLabel(latestRound.round)}</Badge>
        ) : null}
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

        <h4 style={{ margin: "0 0 10px" }}>{t("Assessment questions")}</h4>

        {/* Sent rounds, oldest first: collapsed, read-only summaries (AC-1, AC-4). */}
        {sentRounds.map((inv) => (
          <SentRoundCard
            key={inv.id}
            inv={inv}
            label={roundLabel(inv.round)}
            expanded={expandedRounds.has(inv.id)}
            onToggle={() => toggleRound(inv.id)}
            onViewSubmission={inv.submission ? () => viewRound(inv, "submission") : undefined}
            onViewEvaluation={attemptByRound.has(inv.id) ? () => viewRound(inv, "evaluation") : undefined}
          />
        ))}

        {/* The single draft round (AC-2, AC-3): the only place questions are added, edited and sent. */}
        {draftRound ? (
          <div className="card card-pad round-draft" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <b>{sentRounds.length ? t("Round {n} (supplemental test · draft)").replace("{n}", String(draftRound.round)) : t("Round {n} (draft)").replace("{n}", String(draftRound.round))}</b>
                <div className="tiny" style={{ color: "var(--text-tertiary)", marginTop: 2 }}>
                  {t("Questions are frozen once this round is sent; it is not sent to the candidate until you click Send.")}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flex: "none" }}>
                {sentRounds.length > 0 && draftItems.length === 0 && (
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void cancelDraftRound()}>{t("Cancel this round")}</Button>
                )}
                <Button size="sm" disabled={ended} onClick={() => setQuestionDrawer({ mode: "add" })}>
                  <Icon name="add" style={{ fontSize: 16, verticalAlign: "text-bottom" }} /> {t("Add assessment question")}
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!c.applicationId || draftItems.length === 0 || ended}
                  title={!c.applicationId ? t("Confirm the candidate's role link first") : draftItems.length === 0 ? t("Add at least one question to this round before sending.") : undefined}
                  onClick={() => setSendDrawerOpen(true)}
                >
                  {t("Send to candidate")}
                </Button>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              {draftItems.length === 0 ? (
                <EmptyState icon="assignment" title='No assessment questions yet. Click "Add assessment question" to get started.' />
              ) : (
                draftItems.map((pi) => (
                  <QuestionCard key={pi.id} pi={pi} editable onDelete={() => deleteQuestion(pi)} onEdit={() => setQuestionDrawer({ mode: "edit", planItem: pi })} />
                ))
              )}
            </div>
          </div>
        ) : roundState?.canOpenRound ? (
          <Button disabled={busy} onClick={() => void startSupplementalRound()}>
            <Icon name="add" style={{ fontSize: 16, verticalAlign: "text-bottom" }} /> {t("New supplemental test")}
          </Button>
        ) : null}
      </div>

      {/* The per-round tabs (AC-5): a round switcher, then that round's content. */}
      <div style={{ display: activeTab === "submission" ? "block" : "none" }}>
        <RoundSwitcher rounds={sentRounds} selectedId={selectedRound?.id} onSelect={setSelectedRoundId} label={roundLabel} />
        {selectedRound?.submission ? (
          <RealSubmissionContent
            key={selectedRound.id}
            questions={selectedRound.questions}
            answers={selectedRound.submission.answers}
            submittedAt={selectedRound.submission.submittedAt}
            onGoToEvaluation={() => setActiveTab("evaluation")}
          />
        ) : (
          <EmptyState icon="inbox" title="No submission received yet." />
        )}
      </div>

      <div style={{ display: activeTab === "evaluation" ? "block" : "none" }}>
        <RoundSwitcher rounds={sentRounds} selectedId={selectedRound?.id} onSelect={setSelectedRoundId} label={roundLabel} />
        {selectedAttemptId ? (
          <EvaluationReviewContent
            key={selectedAttemptId}
            attemptId={selectedAttemptId}
            inline
            movesCaseStatus={isSelectedLatest}
            onFinalized={() => void reload()}
            onViewFinalResult={() => setActiveTab("result")}
          />
        ) : (
          <EmptyState icon="fact_check" title="Waiting for result" />
        )}
      </div>

      <div style={{ display: activeTab === "result" ? "block" : "none" }}>
        <RoundSwitcher rounds={sentRounds} selectedId={selectedRound?.id} onSelect={setSelectedRoundId} label={roundLabel} />
        <RoundScoreSummary rounds={sentRounds} label={roundLabel} />
        {selectedRound && RESULTS[`result_${selectedRound.id}`] ? (
          <ReleaseContent
            key={selectedRound.id}
            caseId={caseId}
            invitationId={selectedRound.id}
            isLatestRound={isSelectedLatest && !draftRound}
            inline
            onGoToPlan={() => void startSupplementalRound()}
            onChanged={() => void reload()}
          />
        ) : (
          <EmptyState title="No finalized result for this round yet." />
        )}
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
        items={draftItems}
        onSent={() => {
          setSendDrawerOpen(false);
          // The draft becomes round N and collapses (AC-1); later tabs follow the newest round.
          setSelectedRoundId(null);
          void reload();
        }}
      />
    </div>
  );
}

/** What a sent round's card says about where it is (#48). */
function roundStatus(inv: RealInvitation): { tone: "neutral" | "info" | "warning" | "success"; label: string } {
  const sub = inv.submission;
  if (sub?.releasedAt) return { tone: "success", label: "Result released" };
  if (sub?.finalizedAt) return { tone: "warning", label: "Finalized — not released" };
  if (sub) return { tone: "warning", label: "Submitted — awaiting review" };
  if (inv.status === "opened") return { tone: "info", label: "Opened — awaiting submission" };
  return { tone: "info", label: "Sent" };
}

function SentRoundCard({
  inv, label, expanded, onToggle, onViewSubmission, onViewEvaluation,
}: {
  inv: RealInvitation;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  onViewSubmission?: () => void;
  onViewEvaluation?: () => void;
}) {
  const { t } = useStore();
  const status = roundStatus(inv);
  const final = inv.submission?.finalEvaluation;
  const score = final ? finalOverall(final) : (RESULTS[`result_${inv.id}`]?.overall ?? null);
  return (
    <div className="card card-pad round-card" style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="round-toggle" aria-expanded={expanded} onClick={onToggle}>
          <Icon name={expanded ? "expand_more" : "chevron_right"} />
          <b>{label}</b>
        </button>
        <Badge tone={status.tone}>{t(status.label)}</Badge>
        <span className="tiny" style={{ color: "var(--text-tertiary)" }}>
          {t("Sent")} {fmtDateShort(inv.createdAt)} · {inv.mode === "timed" ? `${inv.durationMin} ${t("min timed")}` : t("Deadline only")} · {t("deadline")} {fmtDateShort(inv.deadline ?? "")}
          {score != null && <> · {t("Score")} <b>{score}</b></>}
        </span>
        <div style={{ flex: 1 }} />
        {onViewSubmission && <Button size="sm" variant="ghost" onClick={onViewSubmission}>{t("View submission →")}</Button>}
        {onViewEvaluation && <Button size="sm" variant="ghost" onClick={onViewEvaluation}>{t("View evaluation →")}</Button>}
      </div>
      {expanded && (
        <div style={{ marginTop: 12 }}>
          {/* Exactly what was sent: the invitation's frozen question snapshot. */}
          {inv.questions.map((q) => (
            <div key={q.questionId} className="round-question">
              <b>{q.code} · {q.title}</b>
              <div className="tiny" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 90, overflow: "auto", marginTop: 6 }}>
                {q.prompt}
              </div>
            </div>
          ))}
          <div className="tiny" style={{ color: "var(--text-tertiary)", marginTop: 6 }}>{t("Sent rounds are read-only.")}</div>
        </div>
      )}
    </div>
  );
}

/** Switches the submission / evaluation / result tabs between rounds (shown once there are two or more). */
function RoundSwitcher({ rounds, selectedId, onSelect, label }: { rounds: RealInvitation[]; selectedId?: string; onSelect: (id: string) => void; label: (n: number) => string }) {
  if (rounds.length < 2) return null;
  return (
    <div className="round-switcher" role="tablist">
      {rounds.map((inv) => (
        <button key={inv.id} type="button" role="tab" aria-selected={inv.id === selectedId} className={inv.id === selectedId ? "active" : ""} onClick={() => onSelect(inv.id)}>
          {label(inv.round)}
        </button>
      ))}
    </div>
  );
}

/** Every finalized round's score side by side (AC-6) -- never merged into one number. */
function RoundScoreSummary({ rounds, label }: { rounds: RealInvitation[]; label: (n: number) => string }) {
  const { t } = useStore();
  const scored = rounds
    .map((inv) => ({ inv, score: RESULTS[`result_${inv.id}`]?.overall ?? (inv.submission?.finalEvaluation ? finalOverall(inv.submission.finalEvaluation) : null) }))
    .filter((r) => r.score != null);
  if (rounds.length < 2 || !scored.length) return null;
  return (
    <div className="card card-pad round-scores" style={{ marginBottom: 16 }}>
      <span className="tiny" style={{ color: "var(--text-tertiary)" }}>{t("Scores by round")}</span>
      {scored.map(({ inv, score }) => (
        <span key={inv.id}>
          {label(inv.round)} <b>{score}</b>
        </span>
      ))}
    </div>
  );
}

function QuestionCard({
  pi, editable, onDelete, onEdit,
}: {
  pi: PlanItem;
  editable: boolean;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const alreadySent = !editable;
  const { t } = useStore();
  const q = QUESTIONS[pi.questionId];
  const bodyText = pi.customPrompt ?? q.prompt;

  // No per-question status or "view reply" here: questions are sent together as one batch, whose
  // single overall status (and link to the Submission tab) sits above the question list.
  return (
    <div className="card card-pad" style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 8 }}>
        <b>{q.code} · {q.title}</b>
        <div className="tiny" style={{ marginTop: 2 }}>{t("adjustable for this candidate only")}</div>
      </div>
      <div className="tiny" style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", maxHeight: 90, overflow: "auto", marginBottom: alreadySent ? 0 : 10 }}>
        {bodyText}
      </div>
      {!alreadySent && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Button size="sm" variant="ghost" onClick={onEdit}>{t("Edit question")}</Button>
          <Button size="sm" variant="danger" onClick={onDelete}>{t("Delete question")}</Button>
        </div>
      )}
    </div>
  );
}
