import { useNavigate } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Button, PageHeader, StatusBadge } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { useStore } from "../store/StoreContext";
import { fmtRelative, nowISO } from "../lib/format";

export function HomePage() {
  const { state, t, set, person } = useStore();
  const navigate = useNavigate();
  const u = state.currentUserId;

  const myTasks = state.tasks.filter((x) => x.assignee === u && ["open", "in_progress", "waiting"].includes(x.status));
  const myApprovals = state.tasks.filter(
    (x) => x.assignee === u && x.type === "Review / approve JD" && ["open", "in_progress"].includes(x.status),
  );
  const wsJobs = Object.values(state.jobs);
  const myOpenJobs = wsJobs.filter(
    (j) => (j.owner === u || j.hiringManager === u || j.recruiter === u) && j.hiringStatus === "published",
  );
  const hiringNow = wsJobs.filter((j) => j.hiringStatus === "published");
  const pendingApproval = wsJobs.filter((j) => j.approvalStatus === "pending");
  const recentJobs = wsJobs
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const firstName = (person?.name ?? "").split(" ")[0];

  return (
    <MainInner>
      <PageHeader
        title={t("Home")}
        subtitle={`${t("Welcome back")}, ${firstName}. ${t("Here's what needs your attention at Sending Labs.")}`}
        actions={
          <Button variant="primary" onClick={() => navigate("/jobs/new")}>
            <Icon name="add" />
            {t("New job")}
          </Button>
        }
      />

      <div className="section-block">
        <div className="section-title">{t("My work")}</div>
        <div className="stat-row">
          <div className="stat-card" onClick={() => navigate("/tasks")}>
            <div className={`num${myTasks.length === 0 ? " zero" : ""}`}>{myTasks.length}</div>
            <div className="lbl">{t("My unfinished tasks")}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/tasks")}>
            <div className={`num${myApprovals.length === 0 ? " zero" : ""}`}>{myApprovals.length}</div>
            <div className="lbl">{t("Approvals awaiting me")}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/jobs?view=table&savedView=My%20Jobs")}>
            <div className={`num${myOpenJobs.length === 0 ? " zero" : ""}`}>{myOpenJobs.length}</div>
            <div className="lbl">{t("My open jobs")}</div>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            {t("Workspace overview")} <span className="tiny">• {t("as of")} {fmtRelative(nowISO())}</span>
          </div>
        </div>
        <div className="stat-row">
          <div className="stat-card" onClick={() => navigate("/jobs")}>
            <div className="num">{wsJobs.length}</div>
            <div className="lbl">{t("Workspace jobs")}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/jobs?savedView=Hiring%20Now")}>
            <div className="num">{hiringNow.length}</div>
            <div className="lbl">{t("Jobs hiring now")}</div>
          </div>
          <div className="stat-card" onClick={() => navigate("/jobs?savedView=Pending%20Approval")}>
            <div className="num">{pendingApproval.length}</div>
            <div className="lbl">{t("Jobs awaiting approval")}</div>
          </div>
          <div className="stat-card unavailable">
            <div className="num">{t("Not connected")}</div>
            <div className="lbl">{t("Candidate pipeline (Screening)")}</div>
          </div>
        </div>
      </div>

      <div className="section-block">
        <button className="collapse-toggle" onClick={() => set({ homeTrendsOpen: !state.homeTrendsOpen })}>
          <Icon name={state.homeTrendsOpen ? "expand_less" : "expand_more"} size={16} />
          {state.homeTrendsOpen ? t("Show less statistics") : t("Show more statistics")}
        </button>
        {state.homeTrendsOpen && (
          <div className="stat-row" style={{ marginTop: 8 }}>
            <div className="stat-card">
              <div className="num">3</div>
              <div className="lbl">{t("Jobs opened — last 30 days")}</div>
            </div>
            <div className="stat-card">
              <div className="num">6</div>
              <div className="lbl">{t("Tasks completed — this week")}</div>
            </div>
            <div className="stat-card">
              <div className="num">2.1 {t("days")}</div>
              <div className="lbl">{t("Approval turnaround — median")}</div>
            </div>
          </div>
        )}
      </div>

      <div className="section-block">
        <div className="section-title">{t("Recent jobs")}</div>
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Job title")}</th>
                <th>{t("Hiring status")}</th>
                <th>{t("Approval")}</th>
                <th>{t("Department")}</th>
                <th>{t("Updated")}</th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((j) => (
                <tr key={j.id} className="clickable" onClick={() => navigate(`/jobs/${j.id}`)}>
                  <td>
                    <strong>{j.title}</strong>
                    <div className="tiny">{j.location}</div>
                  </td>
                  <td>
                    <StatusBadge kind="hiring_status" value={j.hiringStatus} />
                  </td>
                  <td>
                    <StatusBadge kind="approval_status" value={j.approvalStatus} />
                  </td>
                  <td>{j.department}</td>
                  <td className="tiny">{fmtRelative(j.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </MainInner>
  );
}
