import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { listJobs } from "../data/api/jobs";
import { BASE_URL } from "../data/api/shared";
import type { Job, JobFunnel, JobStatus } from "../data/fixtures/jobs";
import { Badge, Button, PageHeader } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";

/** Jobs are created in the JD subsystem; it is served next to this app (/screening/ ↔ /jd/). */
const JD_NEW_JOB_URL = `${BASE_URL.replace(/screening\/$/, "jd/")}jobs/new`;

const SOURCE_LABEL: Record<string, string> = { manual_upload: "Local upload", email: "Email", folder: "Folder", api: "API" };

/** An open job whose rubric isn't confirmed can't match resumes yet, so it isn't shown as plainly "Open". */
function JobStatusBadge({ status, criteriaStatus }: { status: JobStatus; criteriaStatus: Job["criteriaStatus"] }) {
  const { t } = useStore();
  if (status === "draft") return <Badge tone="warning">{t("Draft")}</Badge>;
  if (status === "open" && criteriaStatus !== "confirmed") return <Badge tone="warning">{t("Rubric pending")}</Badge>;
  if (status === "open") return <Badge tone="success">{t("Open", "Open (job status)")}</Badge>;
  if (status === "closed") return <Badge tone="outline">{t("Closed")}</Badge>;
  return <Badge tone="warning">{t("Paused")}</Badge>;
}

function rate(n: number, d: number) {
  return d > 0 ? `${Math.round((n / d) * 100)}%` : "—";
}

function FunnelBar({ n, d, level }: { n: number; d: number; level: 1 | 2 | 3 }) {
  return (
    <div className="fn-bar">
      <span className={`fn-fill-${level}`} style={{ width: `${d > 0 ? Math.round((n / d) * 100) : 0}%` }} />
    </div>
  );
}

function SourceChips({ sources }: { sources: JobFunnel["sources"] }) {
  const { t } = useStore();
  if (!sources.length) return <span className="tiny muted">—</span>;
  return (
    <div className="source-chips">
      {sources.map(({ source, count }) => {
        const label = SOURCE_LABEL[source] ? t(SOURCE_LABEL[source]) : source;
        return (
          <span className="source-chip" key={source} title={label}>
            {label} <b>{count}</b>
          </span>
        );
      })}
    </div>
  );
}

const EMPTY_FUNNEL: JobFunnel = { resumes: 0, matched: 0, linked: 0, pending: 0, today: 0, sources: [] };

export function JobsListPage() {
  const { t } = useStore();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);

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
        subtitle={t("Each job is screened independently — applications, standards and permissions never mix across roles.")}
        actions={
          <Button variant="primary" icon="add" onClick={() => window.open(JD_NEW_JOB_URL, "_blank", "noopener")}>
            {t("New job")}
          </Button>
        }
      />
      <div className="card">
        <table className="data-table jobs-table">
          <thead>
            <tr>
              <th>{t("Job")}</th>
              <th>{t("Status")}</th>
              <th className="num fn-th" title={t("Candidates evaluated against this job (people, not files)")}>
                {t("Resumes")}
              </th>
              <th className="num fn-th" title={t("AI-matched above the match threshold, including already linked")}>
                {t("Matched")}
              </th>
              <th className="num fn-th" title={t("Confirmed by a person — becomes an Application")}>
                {t("Linked")}
              </th>
              <th className="col-source">{t("Resume source")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => {
              const f = j.funnel || EMPTY_FUNNEL;
              const meta = [j.team, j.location, j.seniority].filter((x) => x && x !== "—" && x !== "Unspecified").join(" · ");
              return (
                <tr className="clickable" key={j.id} onClick={() => navigate(`/jobs/${j.id}/screening`)}>
                  <td className="job-cell">
                    <div className="job-title">{j.title}</div>
                    {meta && <div className="job-meta">{meta}</div>}
                  </td>
                  <td>
                    <div className="status-stack">
                      <JobStatusBadge status={j.status} criteriaStatus={j.criteriaStatus} />
                    </div>
                  </td>
                  <td className="num fn-cell">
                    <div className="fn-num">{f.resumes}</div>
                    <div className={`fn-sub${f.today > 0 ? " fresh" : ""}`} title={t("Added today")}>
                      +{f.today} {t("today")}
                    </div>
                    <FunnelBar n={f.resumes} d={f.resumes} level={1} />
                  </td>
                  <td className="num fn-cell">
                    <div className="fn-num">{f.matched}</div>
                    <div className="fn-sub">
                      {rate(f.matched, f.resumes)}
                      {f.pending > 0 && (
                        <>
                          {" · "}
                          <b className="fn-pend">
                            {f.pending} {t("to review")}
                          </b>
                        </>
                      )}
                    </div>
                    <FunnelBar n={f.matched} d={f.resumes} level={2} />
                  </td>
                  <td className="num fn-cell">
                    <div className="fn-num">{f.linked}</div>
                    <div className="fn-sub">{rate(f.linked, f.matched)}</div>
                    <FunnelBar n={f.linked} d={f.resumes} level={3} />
                  </td>
                  <td className="col-source">
                    <SourceChips sources={f.sources} />
                  </td>
                  <td className="action-cell" onClick={(e) => e.stopPropagation()}>
                    <a className="btn btn-sm btn-secondary row-open" href={`/jobs/${j.id}/screening`} onClick={(e) => { e.preventDefault(); navigate(`/jobs/${j.id}/screening`); }}>
                      {t("Open", "Open (action)")}
                      <Icon name="chevron_right" size={16} />
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ margin: "10px 2px 0", lineHeight: 1.5 }}>
        {t("Funnel counts people, not files: Resumes evaluated against the job → Matched by AI → Linked after a person confirms. Percentages show conversion from the previous stage.")}
      </p>
    </>
  );
}
