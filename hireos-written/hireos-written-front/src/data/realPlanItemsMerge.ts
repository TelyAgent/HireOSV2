/**
 * Mirrors realTasksMerge.ts's "write real records into the fixture module dicts" pattern for a
 * case's plan items (see PlanPage) -- a real PlanItem row (hireos-written-backend) is turned into a
 * synthetic Question + PlanItem pair so every existing helper (writtenTaskJob, QuestionCard, the
 * send-to-candidate preview, ...) keeps working unchanged whether the item is fixture demo data or
 * a real, backend-persisted one.
 */
import { finalOverall } from "../utils/score";
import {
  ATTEMPTS, EVALUATIONS, PLANS, QUESTIONS, RELEASES, RESULTS,
  type Attempt, type Criterion, type Evaluation, type PlanItem, type Question,
} from "./fixtures";
import type { QuestionSnapshot, RealEvaluation, RealFinalCriterion, RealInvitation, RealPlanItem } from "./writtenApi";

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
 * Writes one round's real submission into the ATTEMPTS/EVALUATIONS/RESULTS/RELEASES fixture dicts in
 * exactly the shape EvaluationReviewContent / ReleaseContent already expect, so reviewers get the
 * existing accept/override/finalize/publish workflow unchanged. Every id is per round (#48 -- each
 * round is scored, finalized and released on its own): `att_real_<invitationId>`, `eval_…`,
 * `result_…`, `rel_…`.
 *
 * - A persisted finalized scoring / published result (hireos-written-backend) always wins -- that is
 *   what makes them survive a page reload.
 * - Otherwise the AI draft is seeded only once: this runs on every PlanPage render, and re-seeding
 *   would wipe the reviewer's in-progress human scores.
 *
 * Returns the synthetic attemptId to pass into <EvaluationReviewContent attemptId=... />.
 */
export function applyRealEvaluation(caseId: string, invitation: RealInvitation): string | null {
  // A round's questions are looked up by the ids frozen in its snapshot -- make sure each resolves,
  // even if its plan item is gone or was keyed differently when it was sent.
  for (const q of invitation.questions) if (!QUESTIONS[q.questionId]) QUESTIONS[q.questionId] = toOrphanedQuestion(q);
  const submission = invitation.submission;
  if (!submission) return null;
  const key = invitation.id;
  const attemptId = `att_real_${key}`;
  const attempt: Attempt = {
    id: attemptId, caseId, questionId: invitation.questions[0]?.questionId ?? "", round: invitation.round, invitationId: invitation.id, status: "submitted",
    submittedAt: submission.submittedAt, fileRef: "", receivedAt: submission.submittedAt, processedAt: submission.submittedAt,
  };
  ATTEMPTS[attemptId] = attempt;

  const evaluationId = `eval_${key}`;
  const final = submission.finalEvaluation;
  if (final && submission.finalizedAt) {
    if (EVALUATIONS[evaluationId]?.status !== "final") {
      EVALUATIONS[evaluationId] = {
        id: evaluationId, attemptId, status: "final", finalizedBy: submission.finalizedBy ?? null, finalizedAt: submission.finalizedAt,
        criteria: final.criteria.map(toFinalCriterion),
      };
    }
    const resultId = `result_${key}`;
    const relId = `rel_${key}`;
    // Never downgrade: a result published in this session stays published even if `invitation` is an
    // older fetch from before the publish (this runs on every render).
    const released = !!(submission.release && submission.releasedAt) || RESULTS[resultId]?.status === "published";
    RESULTS[resultId] = {
      id: resultId, caseId, evaluationId, overall: finalOverall(final), status: released ? "published" : "final_not_released",
      releaseId: released ? relId : null, invitationId: invitation.id, round: invitation.round,
    };
    if (submission.release && submission.releasedAt) {
      RELEASES[relId] = { ...RELEASES[relId], id: relId, caseId, ...submission.release, publishedAt: submission.releasedAt };
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

/** A case's latest-round result -- what task lists and comparisons summarise a candidate by. */
export function latestResultForCase(caseId: string) {
  return Object.values(RESULTS)
    .filter((r) => r.caseId === caseId)
    .sort((a, b) => (b.round ?? 0) - (a.round ?? 0))[0];
}
