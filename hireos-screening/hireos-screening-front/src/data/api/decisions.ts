import { db, getApplication } from "../db";
import type { Decision, DecisionOutcome } from "../fixtures/decisions";
import type { PersonId } from "../fixtures/people";
import type { Delivery } from "../fixtures/deliveries";
import { uid } from "../../lib/daysAgo";
import { ApiError, apiFetch, delay, isRealApi } from "./shared";

export type NextStepTarget = "record_only" | "send_assessment" | "move_to_interview";

export interface RecordDecisionInput {
  outcome: DecisionOutcome;
  reason: string;
  decidedBy: PersonId;
  nextStepTarget: NextStepTarget;
  overrideAi?: boolean;
  exceptionApproved?: boolean;
}

/** The shared decision-recording core — used both by the single-application
 * Decision page and by Compare's bulk "submit next steps." Each candidate is
 * still handled independently: a failure for one never affects the others. */
export async function recordDecision(applicationId: string, input: RecordDecisionInput): Promise<{ decision: Decision; delivery: Delivery | null }> {
  if (isRealApi()) {
    const result = await apiFetch<{ decision: Decision; delivery: Delivery | null }>(`/applications/${applicationId}/decisions`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    db.decisions[applicationId] = result.decision;
    const application = getApplication(applicationId);
    if (application) application.screeningStatus = "decided";
    if (result.delivery) db.deliveries.push(result.delivery);
    return result;
  }
  const application = getApplication(applicationId);
  if (!application) throw new ApiError("NOT_FOUND", `Application ${applicationId} not found`);
  if (!input.reason.trim()) throw new ApiError("REASON_REQUIRED", "Required — explain the basis for this decision");

  const job = db.jobs[application.jobId];
  const assessment = db.assessments[applicationId];
  const requiresAssessment = job?.workflowPolicy?.assessmentDisposition === "required" && assessment?.status !== "completed";
  if (input.nextStepTarget === "move_to_interview" && requiresAssessment && !input.exceptionApproved) {
    throw new ApiError("ASSESSMENT_REQUIRED", "Required assessment is missing — request an exception to proceed");
  }

  await delay(500);

  const decision: Decision = {
    id: uid("dec"),
    applicationId,
    outcome: input.outcome,
    reason: input.reason,
    decidedBy: input.decidedBy,
    decidedAt: new Date().toISOString(),
    status: "approved",
    overrideAi: !!input.overrideAi,
    exceptionRef: input.exceptionApproved ? uid("exc") : undefined,
  };
  db.decisions[applicationId] = decision;
  application.screeningStatus = "decided";

  let delivery: Delivery | null = null;
  if (input.nextStepTarget === "send_assessment" || input.nextStepTarget === "move_to_interview") {
    delivery = {
      id: uid("deliv"),
      applicationId,
      kind: input.nextStepTarget === "send_assessment" ? "create_assessment" : "create_interview",
      transport: "email",
      targetLabel: input.nextStepTarget === "send_assessment" ? "assessments-intake@partner-vendor.demo" : "interviews@partner-agency.demo",
      status: "prepared",
      createdAt: new Date().toISOString(),
      history: [{ at: new Date().toISOString(), state: "Package ready" }],
    };
    db.deliveries.push(delivery);
  }

  // Complete the related "choose next step" task, if any.
  const task = db.tasks.find((t) => t.type === "next_step" && t.candidateId === application.candidateId && t.jobId === application.jobId && t.status !== "completed");
  if (task) {
    task.status = "completed";
    task.completedAt = new Date().toISOString();
  }

  return { decision, delivery };
}

export async function generateReviewOnlyReport(applicationId: string): Promise<Delivery> {
  if (isRealApi()) {
    const delivery = await apiFetch<Delivery>(`/applications/${applicationId}/review-report`, { method: "POST" });
    db.deliveries.push(delivery);
    return delivery;
  }
  if (!getApplication(applicationId)) throw new ApiError("NOT_FOUND", `Application ${applicationId} not found`);
  await delay(500);
  const delivery: Delivery = {
    id: uid("deliv"),
    applicationId,
    kind: "review_only",
    targetLabel: "Report on file (not routed — review only)",
    reviewStatus: "human_reviewed",
    status: "prepared",
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), state: "Package ready" }],
  };
  db.deliveries.push(delivery);
  return delivery;
}

export async function sendDeclineNotice(applicationId: string): Promise<void> {
  if (isRealApi()) {
    await apiFetch(`/applications/${applicationId}/decline-notice`, { method: "POST" });
    return;
  }
  if (!getApplication(applicationId)) throw new ApiError("NOT_FOUND", `Application ${applicationId} not found`);
  await delay(500);
  db.activity.unshift({ id: uid("act"), op: "Decline notice", actor: "System (demo)", target: applicationId, status: "succeeded", at: new Date().toISOString() });
}
