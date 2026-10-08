/**
 * Mirrors realTasksMerge.ts's "write real records into the fixture module dicts" pattern for a
 * case's plan items (see PlanPage) -- a real PlanItem row (hireos-written-backend) is turned into a
 * synthetic Question + PlanItem pair so every existing helper (writtenTaskJob, QuestionCard, the
 * send-to-candidate preview, ...) keeps working unchanged whether the item is fixture demo data or
 * a real, backend-persisted one.
 */
import {
  ATTEMPTS, CASES, EVALUATIONS, PLANS, QUESTIONS, RELEASES, RESULTS,
  type Attempt, type Criterion, type Evaluation, type PlanItem, type Question,
} from "./fixtures";
import type { QuestionSnapshot, RealEvaluation, RealFinalCriterion, RealInvitation, RealPlanItem, RealSubmission } from "./writtenApi";

function toQuestion(item: RealPlanItem): Question {
  return {
    id: `q_real_${item.id}`,
    code: item.questionCode,
    title: item.questionTitle,
    type: "Written",
    roles: [],
    competencies: item.competencies?.length ? item.competencies : [{ name: item.questionTitle.slice(0, 24), fraction: 1 }],
    difficulty: "Medium",
    estMinutes: 120,
    language: "中文",
    version: 1,
    status: "published",
    author: "system",
    favorite: false,
    prompt: item.questionPrompt,
    materials: [],
    deliverables: item.deliverables ?? [],
    usageCount: 0,
    seenByCount: 0,
    caseScoped: true,
  };
}

function toPlanItem(item: RealPlanItem, caseId: string, questionId: string): PlanItem {
  return { id: item.id, caseId, questionId, kind: item.kind, status: item.status, customPrompt: item.customPrompt };
}

/**
 * Replaces (not appends) a case's plan items with the real backend list — safe to call more than
 * once for the same case (e.g. a re-fetch, or React StrictMode's double effect invocation in dev)
 * since it assigns the id list rather than pushing onto it.
 */
export function applyRealPlanItems(
  caseId: string,
  items: RealPlanItem[],
  c: { planItems: string[] },
  round: { planItemIds: string[] },
): void {
  const ids = items.map((item) => {
    const questionId = `q_real_${item.id}`;
    QUESTIONS[questionId] = toQuestion(item);
    PLANS[item.id] = toPlanItem(item, caseId, questionId);
    return item.id;
  });
  // Two independent arrays, not the same reference -- c.planItems and round.planItemIds are
  // pushed onto separately elsewhere (see PlanPage.handleQuestionConfirm/deleteQuestion), and
  // aliasing them here made every later push apply twice.
  c.planItems = [...ids];
  round.planItemIds = [...ids];
}

function toOrphanedQuestion(snapshot: QuestionSnapshot): Question {
  return {
    id: snapshot.questionId,
    code: snapshot.code,
    title: snapshot.title,
    type: "Written",
    roles: [],
    competencies: [{ name: snapshot.title.slice(0, 24), fraction: 1 }],
    difficulty: "Medium",
    estMinutes: 120,
    language: "中文",
    version: 1,
    status: "published",
    author: "system",
    favorite: false,
    prompt: snapshot.prompt,
    materials: [],
    deliverables: [],
    usageCount: 0,
    seenByCount: 0,
    caseScoped: true,
  };
}

/**
 * A sent Invitation snapshots its questions at send time (see SendToCandidateDrawer) so it never
 * needs the originating PlanItem to still exist. But before the plan-items persistence fix, a
 * question generated client-side only (never saved as a real PlanItem) could vanish from `items`
 * on the next reload while its Invitation/Submission stayed real in the backend -- leaving a
 * candidate's real submitted answer with no card to show it on. This recovers exactly those:
 * any invitation question that isn't already covered by a current plan item gets a read-only
 * synthetic PlanItem so its status/submission is never silently invisible.
 */
export function synthesizeOrphanedInvitationItems(caseId: string, realInvitations: RealInvitation[], currentQuestionIds: Set<string>): PlanItem[] {
  const seen = new Set<string>();
  const orphaned: PlanItem[] = [];
  for (const inv of realInvitations) {
    for (const q of inv.questions) {
      if (currentQuestionIds.has(q.questionId) || seen.has(q.questionId)) continue;
      seen.add(q.questionId);
      QUESTIONS[q.questionId] = toOrphanedQuestion(q);
      orphaned.push({ id: `orphan_${q.questionId}`, caseId, questionId: q.questionId, kind: "optional", status: inv.status, customPrompt: null });
    }
  }
  return orphaned;
}

function toCriterion(c: RealEvaluation["criteria"][number]): Criterion {
  return { name: c.name, max: c.max, ai: c.score, human: null, confidence: "Medium", coverage: "Full", evidence: c.evidence, source: "AI evaluation" };
}

function toFinalCriterion(c: RealFinalCriterion): Criterion {
  return {
    name: c.name, max: c.max, ai: c.ai, human: c.human, confidence: "Medium", coverage: "Full",
    overridden: c.overridden, overrideReason: c.overrideReason, evidence: "", source: "AI evaluation",
  };
}

/**
 * Writes a real submission into the ATTEMPTS/EVALUATIONS/RESULTS/RELEASES fixture dicts in exactly
 * the shape EvaluationReviewContent / ReleaseContent already expect, so reviewers get the existing
 * accept/override/finalize/publish workflow unchanged.
 *
 * - A persisted finalized scoring / published result (hireos-written-backend) always wins -- that is
 *   what makes them survive a page reload.
 * - Otherwise the AI draft is seeded only once: this runs on every PlanPage render, and re-seeding
 *   would wipe the reviewer's in-progress human scores.
 *
 * Returns the synthetic attemptId to pass into <EvaluationReviewContent attemptId=... />.
 */
export function applyRealEvaluation(caseId: string, questionId: string, submission: RealSubmission): string {
  const attemptId = `att_real_${caseId}`;
  const attempt: Attempt = {
    id: attemptId, caseId, questionId, round: 1, status: "submitted",
    submittedAt: submission.submittedAt, fileRef: "", receivedAt: submission.submittedAt, processedAt: submission.submittedAt,
  };
  ATTEMPTS[attemptId] = attempt;

  const evaluationId = `eval_${caseId}`;
  const final = submission.finalEvaluation;
  if (final && submission.finalizedAt) {
    if (EVALUATIONS[evaluationId]?.status !== "final") {
      EVALUATIONS[evaluationId] = {
        id: evaluationId, attemptId, status: "final", finalizedBy: submission.finalizedBy ?? null, finalizedAt: submission.finalizedAt,
        criteria: final.criteria.map(toFinalCriterion),
      };
    }
    const resultId = `result_${caseId}`;
    const relId = `rel_${caseId}`;
    const released = !!(submission.release && submission.releasedAt);
    RESULTS[resultId] = { id: resultId, caseId, evaluationId, overall: final.overall, status: released ? "published" : "final_not_released", releaseId: released ? relId : null };
    if (released) {
      RELEASES[relId] = { ...RELEASES[relId], id: relId, caseId, ...submission.release!, publishedAt: submission.releasedAt! };
      if (CASES[caseId]) CASES[caseId].status = "released";
    }
    return attemptId;
  }

  if (!submission.evaluation || EVALUATIONS[evaluationId]) return attemptId;
  const evaluation: Evaluation = {
    id: evaluationId, attemptId, status: "ai_draft", finalizedBy: null, finalizedAt: null,
    criteria: submission.evaluation.criteria.map(toCriterion),
  };
  EVALUATIONS[evaluation.id] = evaluation;
  return attemptId;
}
