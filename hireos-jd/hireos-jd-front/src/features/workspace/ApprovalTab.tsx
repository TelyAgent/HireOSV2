import { useState } from "react";
import { Icon } from "../../components/ui/Icons";
import { Button, EmptyState, StatusBadge } from "../../components/ui/Primitives";
import { CancelButton, ConfirmDialog, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtDate, fmtRelative, nowISO } from "../../lib/format";
import { BlueprintDrawer } from "./BlueprintDrawer";

type Decision = "approve" | "request_changes" | "reject";

export function ApprovalTab({ jobId }: { jobId: string }) {
  const { state, t, openDrawer } = useStore();
  const appr = state.approvals[jobId];

  if (!appr) {
    return (
      <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
        <EmptyState
          icon="fact_check"
          title={t("Not submitted")}
          body={t("This job has no approval request yet. Submit the working draft when requirements are ready.")}
          actions={
            <Button onClick={() => openDrawer(<BlueprintDrawer jobId={jobId} />, { wide: true })}>
              {t("Check requirements")}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
      <div className="page-header">
        <div>
          <h2 className="section-title">{t("Workflow & Approval")}</h2>
          <p className="tiny">
            {t("Policy")}: {t(appr.policy)}
          </p>
        </div>
        <StatusBadge kind="approval_status" value={appr.status} />
      </div>

      <div className="approval-stepper">
        {appr.steps.map((s) => (
          <div
            key={s.id}
            className={`step-node ${
              s.status === "approved"
                ? "done"
                : s.status === "active"
                  ? "active"
                  : s.status === "rejected" || s.status === "changes_requested"
                    ? "rejected"
                    : ""
            }`}
          >
            <div className="step-line" />
            <div className="step-circle">{s.status === "approved" ? "✓" : s.order}</div>
            <div className="step-label">{t(s.role)}</div>
            <div className="step-sub">
              {getPerson(s.assignee)?.name}
              {s.decidedAt ? " • " + fmtDate(s.decidedAt) : ""}
            </div>
          </div>
        ))}
      </div>

      {appr.materialChanges && appr.materialChanges.length > 0 && (
        <div className="card card-pad" style={{ marginBottom: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t("Material changes in this candidate version")}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
            {appr.materialChanges.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="card card-pad">
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t("Candidate version")}
        </div>
        <div className="tiny">
          {t("Draft revision")} {appr.candidateRevision} • {t("Submitted by")} {getPerson(appr.submittedBy)?.name} •{" "}
          {fmtRelative(appr.submittedAt)}
        </div>
        <div className="tiny" style={{ marginTop: 6 }}>
          {t("Frozen content hash")}: <span className="mono">sha256:demo-{appr.id}</span>
        </div>
      </div>

      {appr.status === "pending" && <ApprovalActions jobId={jobId} />}
    </div>
  );
}

function ApprovalActions({ jobId }: { jobId: string }) {
  const { state, t, openModal } = useStore();
  const decide = useDecideApproval(jobId);
  const appr = state.approvals[jobId];
  const activeStep = appr?.steps.find((s) => s.status === "active");
  if (!activeStep) return null;
  const canAct = activeStep.assignee === state.currentUserId;

  return (
    <div className="card card-pad" style={{ marginTop: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {t("Your decision")} — {t(activeStep.role)} {t("step")}
      </div>
      {!canAct ? (
        <div className="info-inline">
          <Icon name="info" />
          {t("This step is assigned to")} {getPerson(activeStep.assignee)?.name}. {t("Switch demo role to act on it.")}
        </div>
      ) : (
        <div className="flex gap-10 flex-wrap">
          <Button
            variant="primary"
            onClick={() =>
              openModal(
                <ConfirmDialog
                  title={`${t("Approve")} ${t(activeStep.role)} ${t("step")}`}
                  body={`${t("This approves the exact candidate version above (revision")} ${appr.candidateRevision}). ${t("Approving does not activate or publish it automatically.")}`}
                  confirmLabel={t("Approve")}
                  onConfirm={() => decide("approve")}
                />,
              )
            }
          >
            {t("Approve")}
          </Button>
          <Button onClick={() => openModal(<DecisionReasonModal jobId={jobId} action="request_changes" />)}>
            {t("Request changes")}
          </Button>
          <Button variant="danger" onClick={() => openModal(<DecisionReasonModal jobId={jobId} action="reject" />)}>
            {t("Reject")}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Port of the prototype's `A.decideApproval` step transition. */
function useDecideApproval(jobId: string) {
  const { t, mutate, say } = useStore();
  return (action: Decision, reason?: string) => {
    mutate((draft) => {
      const appr = draft.approvals[jobId];
      if (!appr) return;
      const idx = appr.steps.findIndex((s) => s.status === "active");
      const step = appr.steps[idx];
      if (!step) return;
      step.decidedAt = nowISO();
      if (action === "approve") {
        step.status = "approved";
        const next = appr.steps[idx + 1];
        if (next) next.status = "active";
        else {
          appr.status = "approved";
          draft.jobs[jobId].approvalStatus = "approved";
        }
      } else if (action === "request_changes") {
        step.status = "changes_requested";
        step.reason = reason ?? null;
        appr.status = "changes_requested";
        draft.jobs[jobId].approvalStatus = "changes_requested";
      } else {
        step.status = "rejected";
        step.reason = reason ?? null;
        appr.status = "rejected";
        draft.jobs[jobId].approvalStatus = "rejected";
      }
      (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
        at: nowISO(),
        actor: draft.currentUserId,
        text: `${action === "approve" ? "Approved" : action === "request_changes" ? "Requested changes on" : "Rejected"} step ${step.order} (${step.role}).`,
      });
    });
    say(action === "approve" ? t("Approved") : action === "request_changes" ? t("Changes requested") : t("Rejected"));
  };
}

function DecisionReasonModal({ jobId, action }: { jobId: string; action: Exclude<Decision, "approve"> }) {
  const { t, closeModal } = useStore();
  const decide = useDecideApproval(jobId);
  const [reason, setReason] = useState("");
  return (
    <>
      <ModalHeader title={action === "reject" ? t("Reject") : t("Request changes")} />
      <ModalBody>
        <div className="field">
          <label>{t("Reason")}</label>
          <textarea
            placeholder={t("Explain what needs to change")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant={action === "reject" ? "danger-solid" : "primary"}
          onClick={() => {
            closeModal();
            decide(action, reason);
          }}
        >
          {t("Confirm")}
        </Button>
      </ModalFooter>
    </>
  );
}
