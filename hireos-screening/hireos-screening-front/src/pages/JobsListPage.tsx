import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { createDraftJob, listJobs } from "../data/api/jobs";
import { getApplicationsForJob, getRecsForJob } from "../data/db";
import type { Job, JobStatus } from "../data/fixtures/jobs";
import { Badge, Button, PageHeader } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { Modal } from "../components/ui/Overlays";

function JobStatusBadge({ status }: { status: JobStatus }) {
  const { t } = useStore();
  if (status === "draft") return <Badge tone="warning">{t("Draft")}</Badge>;
  if (status === "open") return <Badge tone="success">{t("Open", "Open (job status)")}</Badge>;
  if (status === "closed") return <Badge tone="outline">{t("Closed")}</Badge>;
  return <Badge tone="warning">{t("Paused")}</Badge>;
}

function CreateJobModal({ onClose, onCreated }: { onClose: () => void; onCreated: (jobId: string) => void }) {
  const { t, say } = useStore();
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [jdText, setJdText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError(t("Job title is required"));
      say(t("Job title is required"), { type: "error" });
      return;
    }
    const job = await createDraftJob({ title, team, jdText });
    onClose();
    say(t("Draft job created — confirm requirements before screening"), { type: "success" });
    onCreated(job.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Import / create job")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit}>
            {t("Create draft job")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("A job description alone is enough to create a project — candidates can be added later.")}
      </p>
      <div className="field">
        <label>{t("Job title")}</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Platform Reliability Engineer" />
      </div>
      <div className="field">
        <label>Team / function</label>
        <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="e.g. Design, Data Infrastructure, Sales" />
      </div>
      <div className="field">
        <label>{t("Paste job description")}</label>
        <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder={t("Paste the JD text here")} style={{ minHeight: 120 }} />
      </div>
      {error && <p className="error-inline">{error}</p>}
    </Modal>
  );
}

export function JobsListPage() {
  const { t } = useStore();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    listJobs().then(setJobs);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title={t("Jobs")}
        subtitle={t("Every job here can be screened against independently — Application counts, standards and permissions never mix across roles.")}
        actions={
          <Button variant="primary" icon="add" onClick={() => setShowCreate(true)}>
            {t("Import / create job")}
          </Button>
        }
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Job")}</th>
              <th>{t("Team")}</th>
              <th>{t("Status")}</th>
              <th>{t("Criteria")}</th>
              <th>{t("Suggested")}</th>
              <th>{t("Linked")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const suggested = getRecsForJob(j.id).filter((r) => r.status === "proposed").length;
              const linked = getApplicationsForJob(j.id).length;
              return (
                <tr className="clickable" key={j.id} onClick={() => navigate(`/jobs/${j.id}/screening`)}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{j.title}</div>
                    <div className="tiny">
                      {j.location} · {j.seniority}
                    </div>
                  </td>
                  <td>{j.team}</td>
                  <td>
                    <JobStatusBadge status={j.status} />
                  </td>
                  <td>
                    {j.criteriaStatus === "confirmed" ? (
                      <Badge tone="success">
                        {t("Confirmed")} v{j.criteriaVersion}
                      </Badge>
                    ) : (
                      <Badge tone="warning">{t("Draft")}</Badge>
                    )}
                  </td>
                  <td>{suggested}</td>
                  <td>{linked}</td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    <a className="btn btn-sm btn-secondary" href={`/jobs/${j.id}/criteria`} onClick={(e) => { e.preventDefault(); navigate(`/jobs/${j.id}/criteria`); }}>
                      {t("Requirements")}
                    </a>{" "}
                    <a className="btn btn-sm btn-primary" href={`/jobs/${j.id}/screening`} onClick={(e) => { e.preventDefault(); navigate(`/jobs/${j.id}/screening`); }}>
                      {t("Open workspace")}
                      <Icon name="arrow_forward" size={14} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {showCreate && (
        <CreateJobModal onClose={() => setShowCreate(false)} onCreated={(jobId) => navigate(`/jobs/${jobId}/criteria`)} />
      )}
    </>
  );
}
