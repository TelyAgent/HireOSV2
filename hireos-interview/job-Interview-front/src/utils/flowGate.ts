import type { Task } from "../features/project-intake/api";
import type { Screen } from "../store/types";

// Why each stage is still locked — named after the stage right before it, since a stage
// unlocks exactly when its predecessor is done (see backend intake/task-stages.ts).
const LOCKED_REASON: Record<string, [string, string]> = {
  plan: ["Confirm the rubric in Requirements & Rubric first.", "请先在「要求与评分标准」确认评分标准。"],
  schedule: ["Confirm the interview plan first.", "请先确定面试计划。"],
  brief: ["Schedule at least one interview round first.", "请先为至少一轮面试排期。"],
  live: ["Generate the Interview Brief questions first.", "请先在「面试提要」生成面试题目。"],
  review: ["Complete at least one interview round first.", "请先完成至少一轮面试。"],
  debrief: ["Finish Review with “Continue to debrief” first.", "请先在「评审」点击「继续到汇总评估」。"],
  decision: ["Finish Debrief with “Continue to decision” first.", "请先在「汇总评估」点击「继续到决定」。"],
  package: ["Record a decision on Decision & Next Steps first.", "请先在「决定与后续步骤」记录决定。"],
};

// Single source of truth for "can the user be on this project-flow screen right now",
// shared by FlowNav (blocks the click) and ProjectShell (bounces a direct URL visit).
export function flowGateReason(task: Task | null, screen: Screen, zh: boolean): string | null {
  const stage = task?.stages?.find((s) => s.stage === screen);
  if (!stage || stage.unlocked) return null;
  const reason = LOCKED_REASON[screen] ?? ["Complete the previous step first.", "请先完成上一步。"];
  return zh ? reason[1] : reason[0];
}
