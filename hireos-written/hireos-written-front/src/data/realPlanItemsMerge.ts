/**
 * Mirrors realTasksMerge.ts's "write real records into the fixture module dicts" pattern for a
 * case's plan items (see PlanPage) -- a real PlanItem row (hireos-written-backend) is turned into a
 * synthetic Question + PlanItem pair so every existing helper (writtenTaskJob, QuestionCard, the
 * send-to-candidate preview, ...) keeps working unchanged whether the item is fixture demo data or
 * a real, backend-persisted one.
 */
import { PLANS, QUESTIONS, type PlanItem, type Question } from "./fixtures";
import type { RealPlanItem } from "./writtenApi";

function toQuestion(item: RealPlanItem): Question {
  return {
    id: `q_real_${item.id}`,
    code: item.questionCode,
    title: item.questionTitle,
    type: "Written + File",
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
