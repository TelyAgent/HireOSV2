import { useNavigate, useSearchParams } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, EmptyState, PageHeader, PersonChip, StatusBadge } from "../components/ui/Primitives";
import { CloseButton, ConfirmDialog, ModalBody, ModalFooter, ModalHeader } from "../components/ui/Overlays";
import { useStore } from "../store/StoreContext";
import { SAVED_VIEWS } from "../data/fixtures/savedViews";
import { fmtRelative } from "../lib/format";
import { deleteJob, updateJobStatus } from "../features/jobs/jobsApi";
import { coreJobToLocalJob } from "../features/jobs/jobsMapping";
import type { AppState } from "../store/types";
import type { HiringStatus, Job } from "../data/types";

type ViewKind = "table" | "cards" | "board" | "organization";
const VIEW_TABS: ViewKind[] = ["table", "cards", "board", "organization"];
const VIEW_ICONS: Record<ViewKind, string> = {
  table: "table_rows",
  cards: "grid_view",
  board: "view_kanban",
  organization: "account_tree",
};
const VIEW_LABELS: Record<ViewKind, string> = {
  table: "Table",
  cards: "Cards",
  board: "Board",
  organization: "Organization",
};

/** Port of the prototype's `jobsForSavedView(view)`. */
export function jobsForSavedView(state: AppState, view: string): Job[] {
  const all = Object.values(state.jobs);
  const u = state.currentUserId;
  switch (view) {
    case "My Jobs":
      return all.filter((j) => j.owner === u || j.hiringManager === u || j.recruiter === u);
    case "Published":
      return all.filter((j) => j.hiringStatus === "published");
    case "Needs My Attention":
      return all.filter(
        (j) =>
          (j.approvalStatus === "pending" &&
            state.approvals[j.id]?.steps?.find((s) => s.status === "active")?.assignee === u) ||
          (j.hiringManager === u && j.collaborationStatus === "in_collaboration"),
      );
    case "Drafts":
      return all.filter((j) => j.hiringStatus === "draft");
    case "Pending Approval":
      return all.filter((j) => j.approvalStatus === "pending");
    case "Recently Updated":
      return all.slice().sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    default:
      return all;
  }
}

/** Port of the prototype's `nextActionFor(job)` — returns an untranslated key. */
export function nextActionFor(j: Job): string {
  if (j.hiringStatus === "draft" && !j.activeRoleVersionRef) return "Complete requirements";
  if (j.approvalStatus === "pending") return "Awaiting approval";
  if (j.activationStatus === "pending") return "Activation pending";
  if (j.hiringStatus === "published") return "Hiring in progress";
  return "No action needed";
}

function QualityFlag({ note }: { note: string }) {
  return (
    <span
      className="material-icons-o"
      title={note}
      style={{ fontSize: 15, verticalAlign: -3, color: "var(--warning-text)" }}
    >
      flag
    </span>
  );
}

export function JobLibraryPage() {
  const { state, t, mutate, say, openModal } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const view = (params.get("view") as ViewKind) || "table";
  const savedView = params.get("savedView") || "All Jobs";
  const jobs = jobsForSavedView(state, savedView);

  const goto = (nextView: ViewKind, nextSaved: string) =>
    navigate(`/jobs?view=${nextView}&savedView=${encodeURIComponent(nextSaved)}`);

  const dropOnBoard = async (jobId: string, newStatus: HiringStatus) => {
    const j = state.jobs[jobId];
    if (!j || j.hiringStatus === newStatus) return;
    if (newStatus === "published" && !j.activeRoleVersionRef) {
      say(t("Cannot open — no confirmed requirements yet. Complete and approve requirements first."), { type: "error" });
      return;
    }
    let updated;
    try {
      updated = await updateJobStatus(jobId, newStatus);
    } catch (error) {
      say(error instanceof Error ? error.message : t("Couldn't update the job status. Please try again."), { type: "error" });
      return;
    }
    mutate((draft) => {
      const target = draft.jobs[jobId];
      if (target) draft.jobs[jobId] = coreJobToLocalJob(updated, target);
    });
    say(`${t("Moved")} ${j.title} → ${t(newStatus.charAt(0).toUpperCase() + newStatus.slice(1), `hiring_status.${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`)}`);
  };

  const confirmDeleteJob = (j: Job) => {
    openModal(
      <ConfirmDialog
        title={t("Delete job")}
        body={`${t("Delete")} “${j.title}”? ${t("This cannot be undone.")}`}
        confirmLabel={t("Delete")}
        danger
        onConfirm={async () => {
          try {
            await deleteJob(j.id);
            mutate((draft) => {
              delete draft.jobs[j.id];
            });
            say(`${t("Deleted")} “${j.title}”`);
          } catch (error) {
            say(error instanceof Error ? error.message : t("Couldn't delete this job. Please try again."), { type: "error" });
          }
        }}
      />,
    );
  };

  return (
    <MainInner variant="wide">
      <PageHeader
        title={t("Job Library")}
        subtitle={t("Every requisition at Sending Labs, in one place.")}
        actions={
          <>
            <Button onClick={() => openModal(<SemanticSearchModal />)}>
              <Icon name="travel_explore" />
              {t("Semantic search")}
            </Button>
            <Button variant="primary" onClick={() => navigate("/jobs/new")}>
              <Icon name="add" />
              {t("New job")}
            </Button>
          </>
        }
      />

      <div className="saved-views">
        {SAVED_VIEWS.map((v) => (
          <div
            key={v}
            className={`saved-view-pill${savedView === v ? " active" : ""}`}
            onClick={() => goto(view, v)}
          >
            {t(v, `savedView.${v}`)} <span className="tiny">({jobsForSavedView(state, v).length})</span>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="pill-tabs">
          {VIEW_TABS.map((v) => (
            <button key={v} className={`pill-tab${view === v ? " active" : ""}`} onClick={() => goto(v, savedView)}>
              <Icon name={VIEW_ICONS[v]} size={15} style={{ verticalAlign: -3 }} /> {t(VIEW_LABELS[v])}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span className="tiny">
          {jobs.length} {jobs.length === 1 ? t("job") : t("jobs")}
        </span>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon="work_off"
          title={t("No jobs match these filters")}
          body={t("Try a different saved view, or clear filters to see all jobs.")}
          actions={<Button onClick={() => navigate("/jobs")}>{t("Clear filters")}</Button>}
        />
      ) : view === "table" ? (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Job title")}</th>
                <th>{t("Hiring status")}</th>
                <th>{t("Active version")}</th>
                <th>{t("Draft/Approval")}</th>
                <th>{t("Department")}</th>
                <th>{t("HM")}</th>
                <th>{t("Recruiter")}</th>
                <th>{t("Location")}</th>
                <th>{t("HC")}</th>
                <th>{t("Next action")}</th>
                <th>{t("Updated")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="clickable" onClick={() => navigate(`/jobs/${j.id}`)}>
                  <td>
                    <strong>{j.title}</strong> {j.qualityNote && <QualityFlag note={j.qualityNote} />}
                  </td>
                  <td>
                    <StatusBadge kind="hiring_status" value={j.hiringStatus} />
                  </td>
                  <td className="tiny">
                    {j.activeRoleVersionRef ? "v" + state.roleVersions[j.activeRoleVersionRef]?.versionNo : t("None")}
                  </td>
                  <td>
                    <StatusBadge kind="approval_status" value={j.approvalStatus} />
                  </td>
                  <td>{j.department}</td>
                  <td>
                    <PersonChip id={j.hiringManager} />
                  </td>
                  <td>
                    <PersonChip id={j.recruiter} />
                  </td>
                  <td className="tiny">{j.location}</td>
                  <td className="tiny">{j.headcount}</td>
                  <td className="tiny">{t(nextActionFor(j))}</td>
                  <td className="tiny">{fmtRelative(j.updatedAt)}</td>
                  <td>
                    <button
                      className="icon-btn"
                      title={t("Delete job")}
                      aria-label={t("Delete job")}
                      onClick={(e) => {
                        e.stopPropagation();
                        confirmDeleteJob(j);
                      }}
                    >
                      <Icon name="delete" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : view === "cards" ? (
        <div className="job-card-grid">
          {jobs.map((j) => (
            <div key={j.id} className="job-card" onClick={() => navigate(`/jobs/${j.id}`)}>
              <div className="jc-row justify-between">
                <span className="jc-title">
                  {j.title} {j.qualityNote && <QualityFlag note={j.qualityNote} />}
                </span>
                <StatusBadge kind="hiring_status" value={j.hiringStatus} />
              </div>
              <div className="jc-meta">
                {j.department} • {j.location}
              </div>
              <div className="jc-row">
                <PersonChip id={j.hiringManager} />
              </div>
              <div className="jc-row">
                <StatusBadge kind="approval_status" value={j.approvalStatus} />
                <span className="tiny">{t(nextActionFor(j))}</span>
              </div>
            </div>
          ))}
        </div>
      ) : view === "board" ? (
        <div className="board-cols">
          {(["draft", "published"] as HiringStatus[]).map((col) => {
            const items = jobs.filter((j) => j.hiringStatus === col);
            const label = col.charAt(0).toUpperCase() + col.slice(1);
            return (
              <div
                key={col}
                className="board-col"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void dropOnBoard(e.dataTransfer.getData("text"), col);
                }}
              >
                <div className="board-col-head">
                  <span>{t(label, `hiring_status.${label}`)}</span>
                  <span className="tiny">{items.length}</span>
                </div>
                {items.map((j) => (
                  <div
                    key={j.id}
                    className="board-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text", j.id)}
                    onClick={() => navigate(`/jobs/${j.id}`)}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 4 }}>{j.title}</div>
                    <div className="tiny">{j.department}</div>
                    <div style={{ marginTop: 6 }}>
                      <StatusBadge kind="approval_status" value={j.approvalStatus} />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <OrganizationView jobs={jobs} />
      )}
    </MainInner>
  );
}

function OrganizationView({ jobs }: { jobs: Job[] }) {
  const navigate = useNavigate();
  const byDept: Record<string, Job[]> = {};
  jobs.forEach((j) => {
    (byDept[j.department] = byDept[j.department] || []).push(j);
  });
  return (
    <div className="card card-pad org-tree">
      {Object.keys(byDept).map((dept) => (
        <details key={dept} className="org-node" open>
          <summary className="org-node-head">
            <Icon name="domain" size={17} />
            {dept} <span className="tiny">({byDept[dept].length})</span>
          </summary>
          <div className="org-children">
            {byDept[dept].map((j) => (
              <div
                key={j.id}
                className="list-row"
                style={{ cursor: "pointer", borderRadius: 6 }}
                onClick={() => navigate(`/jobs/${j.id}`)}
              >
                <span style={{ flex: 1 }}>{j.title}</span>
                <StatusBadge kind="hiring_status" value={j.hiringStatus} />
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function SemanticSearchModal() {
  const { t, closeModal } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <ModalHeader title={t("Semantic search")} />
      <ModalBody>
        <div className="field">
          <input type="text" defaultValue={t("Roles in Vietnam that need finance experience")} autoFocus />
        </div>
        <div className="info-inline">
          <Icon name="info" />
          {t("Interpreted as: location = Vietnam AND requirements mention “finance”. Restricted-field matches are never shown in results.")}
        </div>
        <div className="card" style={{ marginTop: 12 }}>
          <div className="list-row">
            <span style={{ flex: 1 }}>HR Lead — Ho Chi Minh City</span>
            <span className="badge badge-neutral">{t("Draft", "hiring_status.Draft")}</span>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <CloseButton />
        <Button
          variant="primary"
          onClick={() => {
            closeModal();
            navigate("/jobs/job-demo-101");
          }}
        >
          {t("Open result")}
        </Button>
      </ModalFooter>
    </>
  );
}
