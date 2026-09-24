import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getJobDetail } from "../data/api/jobs";
import { getJobRecommendations, type JobRecommendation } from "../data/api/candidates";
import { getApplicationDetail, listApplicationsForJob, type ApplicationWithNames } from "../data/api/screening";
import { createComparison, refreshComparison } from "../data/api/comparisons";
import { db } from "../data/db";
import type { Job } from "../data/fixtures/jobs";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { DecisionOutcome } from "../data/fixtures/decisions";
import type { EligibilityStatus } from "../lib/scoring";
import { confidenceLabel, inferRecommendation } from "../lib/scoring";
import {
  Badge,
  Button,
  CandidateAvatar,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
  FreshnessBadge,
  PageHeader,
  RecommendationBadge,
  ScoreRing,
} from "../components/ui/Primitives";

type EligFilter = "all" | EligibilityStatus;

type WorkspaceRowData = { app: ApplicationWithNames; ev: Evaluation | undefined };

const DECISION_LABEL: Record<DecisionOutcome, string> = {
  strong_advance: "Strong advance",
  advance: "Advance",
  hold: "Hold",
  do_not_advance: "Do not advance",
  request_information: "Request Information",
};

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function WorkspaceRow({ app, ev }: WorkspaceRowData) {
  const { t } = useStore();
  const navigate = useNavigate();
  const decision = db.decisions[app.id];
  const humanStatus = decision ? (
    <Badge tone="success">
      {t("Decided —")} {t(DECISION_LABEL[decision.outcome] || cap(decision.outcome))}
    </Badge>
  ) : app.screeningStatus === "review_pending" ? (
    <Badge tone="info">{t("Review pending")}</Badge>
  ) : (
    <Badge tone="outline">{t(cap((app.screeningStatus || "not started").replace(/_/g, " ")))}</Badge>
  );

  return (
    <tr className="clickable" onClick={() => navigate(`/applications/${app.id}`)}>
      <td>
        <CandidateAvatar id={app.candidateId} name={app.candidateName || app.candidateId} />
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{app.candidateName || app.candidateId}</div>
        {ev?.freshness === "stale" && <FreshnessBadge freshness="stale" />}
      </td>
      <td>{ev ? <EligibilityBadge status={ev.eligibilityStatus} /> : <Badge tone="outline">{t("Not run")}</Badge>}</td>
      <td>{ev ? <ScoreRing overall={ev.overall} size="sm" /> : "—"}</td>
      <td style={{ minWidth: 120 }}>{ev ? <CoverageBar coverage={ev.coverage} /> : "—"}</td>
      <td>
        {ev?.evaluationStatus === "insufficient_evidence" ? (
          <Badge tone="warning">{t("Review (insufficient evidence)")}</Badge>
        ) : (
          <RecommendationBadge outcome={inferRecommendation(ev)} />
        )}
      </td>
      <td>{humanStatus}</td>
      <td className="text-right">
        <Link className="btn btn-sm btn-secondary" to={`/applications/${app.id}`} onClick={(e) => e.stopPropagation()}>
          {t("Open", "Open (action)")}
        </Link>
      </td>
    </tr>
  );
}

export function ScreeningWorkspacePage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const navigate = useNavigate();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [suggested, setSuggested] = useState<JobRecommendation[]>([]);
  const [rows, setRows] = useState<WorkspaceRowData[]>([]);
  const [eligFilter, setEligFilter] = useState<EligFilter>("all");
  const [creatingComparison, setCreatingComparison] = useState(false);

  const load = useCallback(async () => {
    try {
      const jobDetail = await getJobDetail(id);
      setJob(jobDetail);
      const [recs, apps] = await Promise.all([
        getJobRecommendations(jobDetail.id),
        listApplicationsForJob(jobDetail.id),
      ]);
      setSuggested(recs);
      // Each application's evaluation is fetched individually -- there is no
      // bulk "evaluations for this job" endpoint, and at workspace scale
      // (a handful of linked candidates per role) N requests is fine.
      const details = await Promise.all(
        apps.map((app) => getApplicationDetail(app.id).catch(() => null)),
      );
      setRows(apps.map((app, i) => ({ app, ev: details[i]?.evaluation || undefined })));
    } catch {
      setJob(null);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCompare = async () => {
    if (!job || rows.length < 2) return;
    setCreatingComparison(true);
    try {
      const cmp = await createComparison(job.id, `Shortlist review — ${job.title}`, rows.map((r) => r.app.id));
      // A comparison with zero snapshots has nothing for the page to render -- generate
      // the first one immediately so "Compare candidates" actually produces a comparison,
      // not an empty shell the user has to know to refresh.
      await refreshComparison(cmp.id);
      navigate(`/comparisons/${cmp.id}`);
    } catch {
      say(t("Could not create the comparison."), { type: "error" });
    } finally {
      setCreatingComparison(false);
    }
  };

  if (job === undefined) return null;

  if (job === null) return <EmptyState icon="work_off" title={t("Job not found")} />;

  let visibleRows = rows;
  if (eligFilter !== "all") visibleRows = visibleRows.filter((r) => r.ev && r.ev.eligibilityStatus === eligFilter);
  visibleRows = [...visibleRows].sort((a, b) => (b.ev?.overall ?? -1) - (a.ev?.overall ?? -1));

  return (
    <>
      <PageHeader
        title={`${job.title} — ${t("Screening workspace")}`}
        subtitle={`${job.team} · ${job.location} · ${t("Standard")} v${job.criteriaVersion} (${t("confirmed")})`}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title }]}
        actions={
          <>
            <Link className="btn btn-secondary" to={`/jobs/${job.id}/criteria`}>
              {t("Requirements & rubric")}
            </Link>
            <Button
              variant="primary"
              onClick={handleCompare}
              disabled={rows.length < 2 || creatingComparison}
              title={rows.length < 2 ? t("Link at least two candidates to this job before comparing.") : undefined}
            >
              {t("Compare candidates")}
            </Button>
          </>
        }
      />

      <div className="underline-tabs">
        <div className="u-tab active">
          {t("Suggested candidates")} <span className="cnt">{suggested.length}</span>
        </div>
      </div>
      {suggested.length ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Candidate")}</th>
                <th>{t("Confidence")}</th>
                <th>{t("Rationale")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {suggested.map((r) => (
                <RecommendationRow key={r.id} recommendation={r} confidence={confidenceLabel(r, state.lang)} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 24 }}>
          <EmptyState
            icon="inbox"
            title={t("No pending recommendations")}
            body={t("AI-proposed matches for this role will appear here before anyone confirms them.")}
          />
        </div>
      )}

      <div className="page-header">
        <div className="underline-tabs" style={{ marginBottom: 0, borderBottom: "none" }}>
          <div className="u-tab active">
            {t("Linked candidates")} <span className="cnt">{rows.length}</span>
          </div>
        </div>
        <div className="actions">
          <select
            value={eligFilter}
            onChange={(e) => setEligFilter(e.target.value as EligFilter)}
            style={{ padding: "7px 10px", border: "1px solid var(--border-strong)", borderRadius: 6, fontSize: "var(--fs-sm)", background: "var(--surface)", color: "var(--text)" }}
          >
            <option value="all">{t("All eligibility")}</option>
            <option value="eligible">{t("Eligible")}</option>
            <option value="needs_verification">{t("Needs verification")}</option>
            <option value="not_eligible">{t("Not eligible")}</option>
          </select>
        </div>
      </div>
      <div className="card">
        {visibleRows.length ? (
          <table className="data-table">
            <thead>
              <tr>
                <th></th>
                <th>{t("Candidate")}</th>
                <th>{t("Eligibility")}</th>
                <th>{t("Overall")}</th>
                <th>{t("Coverage")}</th>
                <th>{t("AI recommendation")}</th>
                <th>{t("Human status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <WorkspaceRow key={r.app.id} app={r.app} ev={r.ev} />
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon="group_off" title={t("No linked candidates match this filter")} />
        )}
      </div>
    </>
  );
}

function RecommendationRow({ recommendation, confidence }: { recommendation: JobRecommendation; confidence: string }) {
  const { t } = useStore();
  const navigate = useNavigate();
  const name = recommendation.candidateName || recommendation.candidateId;
  return (
    <tr className="clickable" onClick={() => navigate(`/candidates/${recommendation.candidateId}/jobs`)}>
      <td>
        <span className="flex items-center gap-8">
          <CandidateAvatar id={recommendation.candidateId} name={name} size="sm" /> {name}
        </span>
      </td>
      <td className="tiny">{confidence}</td>
      <td className="tiny">{recommendation.rationale}</td>
      <td className="text-right">
        <Link className="btn btn-sm btn-primary" to={`/candidates/${recommendation.candidateId}/jobs`} onClick={(e) => e.stopPropagation()}>
          {t("Review", "Review (action)")}
        </Link>
      </td>
    </tr>
  );
}
