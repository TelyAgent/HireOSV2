import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, ErrorState, PersonAvatar, StatusBadge } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { GeminiPanel } from "../features/copilot/GeminiPanel";
import { DocumentTab } from "../features/workspace/DocumentTab";
import { ApprovalTab } from "../features/workspace/ApprovalTab";
import { PublicationTab } from "../features/workspace/PublicationTab";
import { AttachmentsTab } from "../features/workspace/AttachmentsTab";
import { ActivityTab } from "../features/workspace/ActivityTab";
import { VersionsTab } from "../features/workspace/VersionsTab";
import { BlueprintDrawer } from "../features/workspace/BlueprintDrawer";
import { VersionHistoryModal } from "../features/workspace/VersionHistoryModal";
import { useSubmitForApproval, useActivateVersion } from "../features/workspace/approvalActions";
import { nowISO } from "../lib/format";
import { getJob } from "../features/jobs/jobsApi";
import { coreJobToLocalJob } from "../features/jobs/jobsMapping";
import type { Audience } from "../data/types";

const TABS = [
  { key: "document", label: "Document", icon: "description" },
  { key: "approval", label: "Workflow & Approval", icon: "fact_check" },
  { key: "publication", label: "Publication", icon: "public" },
  { key: "attachments", label: "Attachments", icon: "attach_file" },
  { key: "activity", label: "Activity", icon: "history" },
  { key: "versions", label: "Versions & Impact", icon: "timeline" },
] as const;

// Only the Document tab is shown for now — the richer Workflow & Approval / Publication / Attachments /
// Activity / Versions tabs are deferred in favor of the simple Draft → Published flow (see the header's
// Publish button below). Their routes/components are untouched, just not linked from the tab bar.
const VISIBLE_TABS = TABS.filter((x) => x.key === "document");

type TabKey = (typeof TABS)[number]["key"];

/** Aliases the prototype routed separately but rendered as the Document tab. */
const DOC_ALIASES: Record<string, { tab: TabKey; audience?: Audience; blueprint?: boolean }> = {
  requirements: { tab: "document", blueprint: true },
  "internal-jd": { tab: "document", audience: "internal" },
  "external-jd": { tab: "document", audience: "external" },
};

export function JobWorkspacePage() {
  const { id = "", tab: rawTab = "document" } = useParams();
  const [params] = useSearchParams();
  const { state, t, set, mutate, say, openModal, openDrawer } = useStore();
  const navigate = useNavigate();
  const submitForApproval = useSubmitForApproval();
  const activateVersion = useActivateVersion();

  const alias = DOC_ALIASES[rawTab];
  const tab: TabKey = alias ? alias.tab : (TABS.find((x) => x.key === rawTab)?.key ?? "document");
  const audience: Audience = alias?.audience ?? ((params.get("audience") as Audience) || state.wsAudience);

  const job = state.jobs[id];

  // Keep the editor's job/audience context in sync with the URL.
  useEffect(() => {
    if (!job) return;
    if (state.wsCurrentJob !== id || state.wsAudience !== audience) {
      set({ wsCurrentJob: id, wsAudience: audience, wsSelection: null });
    }
  }, [id, audience, job, state.wsCurrentJob, state.wsAudience, set]);

  // `/jobs/:id/requirements` opens the Requirements Blueprint on arrival.
  useEffect(() => {
    if (job && alias?.blueprint) openDrawer(<BlueprintDrawer jobId={id} />, { wide: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rawTab]);

  // A job created this session (e.g. via Copilot) or opened via a direct link won't be in the local
  // store after a reload — it's real, backend-held data, so fall back to fetching it by id before
  // giving up and showing "Job not found".
  const [remoteChecked, setRemoteChecked] = useState(false);
  useEffect(() => {
    if (job || !id) {
      setRemoteChecked(true);
      return;
    }
    let cancelled = false;
    getJob(id)
      .then((core) => {
        if (cancelled || !core) return;
        mutate((draft) => {
          draft.jobs[id] = coreJobToLocalJob(core, draft.jobs[id]);
        });
      })
      .catch((error) => console.warn("Failed to load job from the backend:", error))
      .finally(() => {
        if (!cancelled) setRemoteChecked(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, job]);

  if (!job) {
    if (!remoteChecked) return <MainInner>{null}</MainInner>;
    return (
      <MainInner>
        <ErrorState title={t("Job not found")} body={id} />
      </MainInner>
    );
  }

  const approval = state.approvals[id];
  const activeVer = job.activeRoleVersionRef ? state.roleVersions[job.activeRoleVersionRef] : null;
  const collaborators = [job.owner, job.hiringManager].filter((v, i, a) => v && a.indexOf(v) === i);

  const primaryAction = () => {
    if (job.hiringStatus === "draft" && !job.activeRoleVersionRef) {
      return (
        <Button variant="primary" onClick={() => openDrawer(<BlueprintDrawer jobId={id} />, { wide: true })}>
          {t("Review missing details")}
        </Button>
      );
    }
    if (approval?.status === "pending") {
      return (
        <Button variant="primary" onClick={() => navigate(`/jobs/${id}/approval`)}>
          {t("Review approval")}
        </Button>
      );
    }
    // The pending case already returned above, so this is the non-pending branch.
    if (job.collaborationStatus === "in_collaboration") {
      return (
        <Button variant="primary" onClick={() => submitForApproval(id)}>
          {t("Submit for approval")}
        </Button>
      );
    }
    if (approval?.status === "approved" && job.activationStatus !== "succeeded") {
      return (
        <Button variant="primary" onClick={() => activateVersion(id)}>
          {t("Activate approved version")}
        </Button>
      );
    }
    return null;
  };

  const publishJob = () => {
    mutate((draft) => {
      const j = draft.jobs[id];
      if (!j) return;
      j.hiringStatus = "published";
      j.updatedAt = nowISO();
      (draft.activity[id] = draft.activity[id] || []).unshift({
        at: nowISO(),
        actor: draft.currentUserId,
        text: "Published this job.",
      });
    });
    say(t("Job published"));
  };

  return (
    <MainInner variant="flush">
      <div className="jw-shell">
        <div className="jw-header">
          <div className="breadcrumbs" style={{ marginBottom: 6 }}>
            <a
              href={`#/jobs`}
              onClick={(e) => {
                e.preventDefault();
                navigate("/jobs");
              }}
            >
              {t("Job Library")}
            </a>
            <span className="sep material-icons-o" style={{ fontSize: 14 }} aria-hidden="true">
              chevron_right
            </span>
            <span className="current">{job.title}</span>
          </div>
          <div className="jw-header-top">
            <h1 className="jw-title">{job.title}</h1>
            <StatusBadge kind="hiring_status" value={job.hiringStatus} />
            {activeVer ? (
              <span className="badge badge-info">
                {t("Active")} v{activeVer.versionNo}
              </span>
            ) : (
              <span className="badge badge-neutral">{t("No active standard")}</span>
            )}
            {job.collaborationStatus === "in_collaboration" && (
              <span className="badge badge-warning">
                {t("Draft")} v{job.draftRevision} {t("in progress")}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <div className="jw-collab-avatars">
              {collaborators.map((p) => (
                <PersonAvatar key={p} id={p} />
              ))}
            </div>
            <Button variant="icon" title={t("Version history")} onClick={() => openModal(<VersionHistoryModal jobId={id} />, { wide: true })}>
              <Icon name="history" />
            </Button>
            <Button size="sm" onClick={() => openDrawer(<BlueprintDrawer jobId={id} />, { wide: true })}>
              <Icon name="checklist_rtl" />
              {t("Check requirements")}
            </Button>
            {primaryAction()}
            {job.hiringStatus === "draft" && (
              <Button variant="primary" onClick={publishJob}>
                <Icon name="public" />
                {t("Publish")}
              </Button>
            )}
          </div>
          {job.qualityNote && (
            <div className="warning-inline" style={{ margin: "8px 0 0" }}>
              <Icon name="flag" />
              {job.qualityNote}
            </div>
          )}
          <div className="jw-header-row2">
            <div className="underline-tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
              {VISIBLE_TABS.map((x) => (
                <div
                  key={x.key}
                  className={`u-tab${tab === x.key ? " active" : ""}`}
                  onClick={() => navigate(`/jobs/${id}/${x.key}?audience=${audience}`)}
                >
                  <Icon name={x.icon} size={15} style={{ verticalAlign: -3 }} /> {t(x.label)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {tab === "document" && <DocumentTab jobId={id} audience={audience} />}
        {tab === "approval" && <ApprovalTab jobId={id} />}
        {tab === "publication" && <PublicationTab jobId={id} />}
        {tab === "attachments" && <AttachmentsTab jobId={id} />}
        {tab === "activity" && <ActivityTab jobId={id} />}
        {tab === "versions" && <VersionsTab jobId={id} />}
      </div>
      <button
        className="gemini-fab"
        title={t("Ask Copilot — voice or chat")}
        aria-label={t("Ask Copilot — voice or chat")}
        onClick={() => {
          const sel = window.getSelection()?.toString().trim();
          openDrawer(
            <GeminiPanel ctx={{ mode: "edit", jobId: id, audience, selText: sel && sel.length > 1 ? sel : null }} />,
            { drawerClass: "gemini-drawer-shell", overlayClass: "gemini-overlay" },
          );
        }}
      >
        <Icon name="auto_awesome" />
      </button>
    </MainInner>
  );
}
