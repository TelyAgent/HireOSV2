import type { BadgeTone } from "../components/ui/Primitives";
import { Badge } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";

/** Ported from the prototype's statusBadge() map — one badge vocabulary shared by every
 * entity's status field (tasks, invitations, mail, questions, cases, results, deliveries). */
const STATUS_MAP: Record<string, [BadgeTone, string]> = {
  open: ["neutral", "Open"], in_progress: ["info", "In progress"], waiting: ["warning", "Waiting"], completed: ["success", "Completed"], cancelled: ["neutral", "Cancelled"],
  accepted: ["info", "Accepted"], started: ["info", "Started"], submitted: ["success", "Submitted"], incomplete: ["warning", "Incomplete"],
  needs_confirmation: ["warning", "Needs confirmation"], quarantined: ["danger", "Quarantined"], duplicate: ["neutral", "Duplicate"],
  final: ["success", "Final"], ai_draft: ["warning", "AI draft — not final"], published: ["success", "Published"], draft: ["neutral", "Draft"],
  active: ["info", "Active"], evaluated: ["info", "Evaluated"], review_pending: ["warning", "Review pending"], issue_open: ["danger", "Issue open"],
  awaiting_submission: ["neutral", "Awaiting submission"], concept: ["neutral", "Concept"], draft_review: ["warning", "In review"],
  internal_only: ["neutral", "Internal only"], final_not_released: ["warning", "Final — not released"], awaiting_ack: ["warning", "Awaiting confirmation"],
  released: ["success", "Released"], linked: ["neutral", "Linked — no plan yet"],
  planned: ["neutral", "Planned"], ready_to_release: ["info", "Ready to release"], invited: ["info", "Invited"],
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useStore();
  const [tone, label] = STATUS_MAP[status] || ["neutral", status];
  return <Badge tone={tone}>{t(label)}</Badge>;
}

const TASK_TYPE_LABEL: Record<string, string> = {
  result_release: "Result release", evaluation_review: "Evaluation review", submission_issue: "Submission issue",
  reviewer_queue: "Reviewer queue", plan_review: "Plan review", delivery_recovery: "Delivery recovery",
};
export function taskTypeSource(type: string): string {
  return TASK_TYPE_LABEL[type] || type;
}
