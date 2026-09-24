import type { Task } from "../features/project-intake/api";
import type { Screen } from "../store/types";

// Single source of truth for "can the user be on this project-flow screen right now",
// shared by FlowNav (blocks the click) and ProjectShell (bounces a direct URL visit).
// Gates only the stages with a real backend prerequisite — review/debrief/decision need
// real round progress, package needs a real recorded decision. Everything upstream of
// review (overview/rubric/plan/schedule/brief/live) still belongs to the old mock-only
// flow and isn't touched here.
export function flowGateReason(task: Task | null, screen: Screen, zh: boolean): string | null {
  if (!task) return null;
  const completedRounds = task.rounds.filter((r) => r.status === "completed").length;
  if (screen === "review" && completedRounds < 1) {
    return zh ? "请先完成至少一轮面试，再查看评审。" : "Complete at least one interview round before reviewing.";
  }
  if ((screen === "debrief" || screen === "decision") && (task.rounds.length === 0 || completedRounds < task.rounds.length)) {
    return zh ? "请先完成全部面试轮次，再继续。" : "Complete every interview round before continuing.";
  }
  if (screen === "package" && task.status !== "awaiting_confirmation" && task.status !== "package_published") {
    return zh ? "请先在「决定与后续步骤」记录决定，再前往评估包。" : "Record a decision on Decision & Next Steps before opening the evaluation package.";
  }
  return null;
}
