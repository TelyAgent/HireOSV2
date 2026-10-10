import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, ErrorState, PersonAvatar, StatusBadge } from "../components/ui/Primitives";
import { useStore } from "../store/StoreContext";
import { DocumentTab } from "../features/workspace/DocumentTab";
import { ApprovalTab } from "../features/workspace/ApprovalTab";
import { PublicationTab } from "../features/workspace/PublicationTab";
import { AttachmentsTab } from "../features/workspace/AttachmentsTab";
import { ActivityTab } from "../features/workspace/ActivityTab";
import { VersionsTab } from "../features/workspace/VersionsTab";
import { BlueprintDrawer } from "../features/workspace/BlueprintDrawer";
import { PublishModal, VersionHistoryDrawer } from "../features/workspace/VersionHistory";
import { diffBlocks, getVersions } from "../features/workspace/versions";
import { selectDraft } from "../features/workspace/docHelpers";
import { useCompleteness } from "../features/workspace/useCompleteness";
import { issueCount } from "../features/workspace/completeness";
import { useSubmitForApproval, useActivateVersion } from "../features/workspace/approvalActions";
import { getJob } from "../features/jobs/jobsApi";
import { coreJobToLocalJob } from "../features/jobs/jobsMapping";

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
const DOC_ALIASES: Record<string, { tab: TabKey; blueprint?: boolean }> = {
  requirements: { tab: "document", blueprint: true },
  "internal-jd": { tab: "document" },
  "external-jd": { tab: "document" },
};

export function JobWorkspacePage() {
  const { id = "", tab: rawTab = "document" } = useParams();
  const { state, t, set, mutate, say, openModal, openDrawer } = useStore();
  const navigate = useNavigate();
  const submitForApproval = useSubmitForApproval();
  const activateVersion = useActivateVersion();

  const alias = DOC_ALIASES[rawTab];
  const tab: TabKey = alias ? alias.tab : (TABS.find((x) => x.key === rawTab)?.key ?? "document");

  const job = state.jobs[id];
  const completeness = useCompleteness(id);

  // Keep the editor's job context in sync with the URL.
  useEffect(() => {
    if (!job) return;
    if (state.wsCurrentJob !== id) set({ wsCurrentJob: id, wsSelection: null });
  }, [id, job, state.wsCurrentJob, set]);

  // `/jobs/:id/requirements` opens the Requirements Blueprint on arrival.
  useEffect(() => {
    if (job && alias?.blueprint) openDrawer(<BlueprintDrawer jobId={id} />, { wide: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, rawTab]);

  // A job created this session (e.g. via Copilot) or opened via a direct link won't be in the local
  // store after a reload — it's real, backend-held data, so fall back to fetching it by id before
  // giving up and showing "Job not found".
  const [remoteChecked, setRemoteChecked] = useState(false);
  // JD ID and published versions.
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    getVersions(id)
      .then((v) => {
        if (!cancelled) mutate((d) => void (d.wsVersions = { ...d.wsVersions, [id]: v }));
      })
      .catch((error) => console.warn("Failed to load JD versions:", error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, !!job]);
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
  // Publishing needs every required item filled, nothing left to revise and no blocking issue.
  const issues = completeness ? issueCount(completeness) : 0;
  const versionInfo = state.wsVersions[id];
  const latestVersion = versionInfo?.versions[versionInfo.versions.length - 1];
  const unpublished = latestVersion ? diffBlocks(latestVersion.blocks, selectDraft(state, id).blocks).count : 0;
  const publishBlockedReason = !versionInfo
    ? t("Loading…")
    : issues
      ? `${issues} ${t("item(s) to complete or revise before publishing — see Analysis")}`
      : latestVersion && !unpublished
        ? t("No changes since v{n}.").replace("{n}", String(latestVersion.versionNo))
        : undefined;
  const collaborators = [job.owner, job.hiringManager].filter((v, i, a) => v && a.indexOf(v) === i);

  const primaryAction = () => {
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

  return (
    <MainInner variant="flush">
      <div className="jw-shell">
        <div className="jw-header">
          <div className="breadcrumbs" style={{ marginBottom: 6 }}>
            <button
              type="button"
              className="jw-back-btn"
              title={t("Back")}
              aria-label={t("Back")}
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/jobs"))}
            >
              <Icon name="arrow_back" />
            </button>
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
            {versionInfo && (
              <button
                type="button"
                className="jd-id"
                title={t("Unique JD ID — click to copy")}
                onClick={() => {
                  void navigator.clipboard?.writeText(versionInfo.jdCode);
                  say(`${t("Copied")} ${versionInfo.jdCode}`);
                }}
              >
                <Icon name="tag" />
                {versionInfo.jdCode}
              </button>
            )}
            {latestVersion ? (
              <span className="badge badge-success" title={t("Latest published version")}>
                v{latestVersion.versionNo} {t("published")}
              </span>
            ) : (
              versionInfo && <span className="badge badge-neutral">{t("Not published")}</span>
            )}
            {latestVersion && unpublished > 0 && (
              <span className="badge badge-warning" title={t("The draft differs from v{n}").replace("{n}", String(latestVersion.versionNo))}>
                {t("Unpublished changes")}
              </span>
            )}
            <div style={{ flex: 1 }} />
            <div className="jw-collab-avatars">
              {collaborators.map((p) => (
                <PersonAvatar key={p} id={p} />
              ))}
            </div>
            <Button variant="icon" title={t("Version history")} onClick={() => openDrawer(<VersionHistoryDrawer jobId={id} />, { wide: true })}>
              <Icon name="history" />
            </Button>
            {primaryAction()}
            <Button
              variant="primary"
              disabled={!!publishBlockedReason}
              title={publishBlockedReason}
              onClick={() => openModal(<PublishModal jobId={id} />)}
            >
              <Icon name="public" />
              {t("Publish")}
            </Button>
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
                  onClick={() => navigate(`/jobs/${id}/${x.key}`)}
                >
                  <Icon name={x.icon} size={15} style={{ verticalAlign: -3 }} /> {t(x.label)}
                </div>
              ))}
            </div>
          </div>
        </div>

        {tab === "document" && <DocumentTab jobId={id} />}
        {tab === "approval" && <ApprovalTab jobId={id} />}
        {tab === "publication" && <PublicationTab jobId={id} />}
        {tab === "attachments" && <AttachmentsTab jobId={id} />}
        {tab === "activity" && <ActivityTab jobId={id} />}
        {tab === "versions" && <VersionsTab jobId={id} />}
      </div>
    </MainInner>
  );
}
