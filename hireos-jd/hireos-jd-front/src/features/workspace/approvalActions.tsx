/**
 * Approval / activation actions, ported from the prototype's
 * `A.submitForApproval`, `A.decideApproval` and `A.activateVersion`.
 */
import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../store/StoreContext";
import { ConfirmDialog } from "../../components/ui/Overlays";
import { JOB_A_DIMENSIONS } from "../../data/fixtures/jobs";
import { nowISO, uid } from "../../lib/format";
import type { RoleVersion } from "../../data/types";

export function useSubmitForApproval() {
  const { state, t, mutate, say, openModal } = useStore();
  const navigate = useNavigate();

  return useCallback(
    (jobId: string) => {
      const job = state.jobs[jobId];
      const blockers = (state.requirements[jobId] || []).filter((r) => r.flagVague);
      const body = (
        <>
          {t("Candidate version")}: {t("draft revision")} {job.draftRevision}. {t("Approvers")}: {t("Hiring Manager → HR")}.
          {blockers.length > 0 && (
            <>
              <br />
              <br />
              <span style={{ color: "var(--warning-text)" }}>
                {blockers.length}{" "}
                {t("requirement(s) still need an evidence standard — you can still submit; reviewers will see the same flag.")}
              </span>
            </>
          )}
        </>
      );

      const confirm = () => {
        mutate((draft) => {
          const j = draft.jobs[jobId];
          j.approvalStatus = "pending";
          j.collaborationStatus = "ready";
          if (!draft.approvals[jobId]) {
            draft.approvals[jobId] = {
              id: uid("appr"),
              jobId,
              status: "pending",
              policy: "HM → HR (default)",
              candidateRevision: j.draftRevision,
              submittedBy: draft.currentUserId,
              submittedAt: nowISO(),
              steps: [
                { id: uid("step"), order: 1, role: "Hiring Manager", assignee: j.hiringManager, status: "active", decidedAt: null },
                { id: uid("step"), order: 2, role: "HR", assignee: "alex", status: "waiting", decidedAt: null },
              ],
            };
          } else {
            draft.approvals[jobId].status = "pending";
          }
          (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
            at: nowISO(),
            actor: draft.currentUserId,
            text: "Submitted working draft for approval.",
          });
        });
        say(t("Submitted for approval"));
        navigate(`/jobs/${jobId}/approval`);
      };

      openModal(<ConfirmDialog title={t("Submit for approval")} body={body} confirmLabel={t("Submit")} onConfirm={confirm} />);
    },
    [state.jobs, state.requirements, t, mutate, say, openModal, navigate],
  );
}

export function useActivateVersion() {
  const { t, mutate, say, openModal } = useStore();

  return useCallback(
    (jobId: string) => {
      const run = () => {
        mutate((draft) => void (draft.jobs[jobId].activationStatus = "pending"));
        say(t("Activation in progress…"));
        setTimeout(() => {
          mutate((draft) => {
            const j = draft.jobs[jobId];
            const current = j.activeRoleVersionRef ? draft.roleVersions[j.activeRoleVersionRef] : null;
            const nextNo = (current?.versionNo ?? 0) + 1;
            const newVerId = `role-${jobId.split("-").pop()}-v${nextNo}`;
            const base: Partial<RoleVersion> = current ?? {
              responsibilities: [],
              dimensions: JOB_A_DIMENSIONS,
              successCriteria: [],
              internalCompensation: null,
              publicCompensation: null,
              roleSummary: "",
              origin: "jd_module",
              evaluationReadiness: "ready",
            };
            draft.roleVersions[newVerId] = {
              ...(base as RoleVersion),
              id: newVerId,
              versionNo: nextNo,
              jobId,
              status: "confirmed",
              confirmedBy: "alex",
              confirmedAt: nowISO(),
            };
            j.activeRoleVersionRef = newVerId;
            j.activationStatus = "succeeded";
            j.collaborationStatus = "ready";
            if (draft.approvals[jobId]) draft.approvals[jobId].status = "approved";
            (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
              at: nowISO(),
              actor: "alex",
              text: `Activated role version ${nextNo} (confirmed standard).`,
            });
          });
          say(t("Activated — new standard is now live"), { type: "success" });
        }, 900);
      };

      openModal(
        <ConfirmDialog
          title={t("Activate approved version")}
          body={t(
            "This will make the approved candidate the new active requirement standard for this job. New evaluations will use it; anything already started keeps its old snapshot.",
          )}
          confirmLabel={t("Activate")}
          onConfirm={run}
        />,
      );
    },
    [t, mutate, say, openModal],
  );
}
