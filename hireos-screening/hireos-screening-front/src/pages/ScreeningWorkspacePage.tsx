import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getJobDetail, runJobMatch } from "../data/api/jobs";
import { getJobRecommendations, type JobRecommendation } from "../data/api/candidates";
import { getApplicationDetail, listApplicationsForJob, type ApplicationWithNames } from "../data/api/screening";
import { createComparison, refreshComparison } from "../data/api/comparisons";
import { db } from "../data/db";
import type { Job } from "../data/fixtures/jobs";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { DecisionOutcome } from "../data/fixtures/decisions";
import type { EligibilityStatus } from "../lib/scoring";
import { Icon } from "../components/ui/Icons";
import { ResumeImportModal, type ImportTab } from "../features/imports/ResumeImportPanel";
import { confidenceLabel, inferRecommendation } from "../lib/scoring";
import {
  Badge,
  Button,
  CandidateAvatar,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
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
        {ev?.freshness === "stale" && <div className="tiny">{t("Refresh available")}</div>}
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

const UPLOAD_METHODS: { id: ImportTab; icon: string; title: string; desc: string }[] = [
  { id: "upload", icon: "upload_file", title: "Upload files", desc: "PDF, DOCX or TXT resumes" },
  { id: "paste", icon: "edit_note", title: "Paste profile", desc: "Add a structured candidate profile" },
  { id: "email", icon: "mail_outline", title: "Import from email", desc: "Read from an authorized mailbox" },
  { id: "folder", icon: "folder_open", title: "Import from folder", desc: "Watch a connected folder" },
];

function ResumeUploadStrip({ onOpen }: { onOpen: (tab: ImportTab) => void }) {
  const { t } = useStore();
  return (
    <div className="upload-strip">
      <div className="upload-strip-label">
        <span className="us-icon">
          <Icon name="upload_file" />
        </span>
        <span>
          <span className="us-title">{t("Upload resumes")}</span>
          <span className="us-sub">{t("Choose a source to add resumes to the library for this screening workspace.")}</span>
        </span>
      </div>
      <div className="upload-strip-actions">
        {UPLOAD_METHODS.map((m) => (
          <button key={m.id} type="button" className="btn btn-secondary btn-sm" title={t(m.desc)} onClick={() => onOpen(m.id)}>
            <Icon name={m.icon} />
            {t(m.title)}
          </button>
        ))}
      </div>
    </div>
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
  const [matching, setMatching] = useState(false);
  const [importTab, setImportTab] = useState<ImportTab | null>(null);

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

  const handleMatchAgain = async () => {
    if (!job) return;
    setMatching(true);
    try {
      await runJobMatch(job.id);
      say(t("Matching started — new suggestions will appear here"), { type: "success" });
      await load();
    } catch {
      say(t("Could not start matching."), { type: "error" });
    } finally {
      setMatching(false);
    }
  };

  if (job === undefined) return null;

  if (job === null) return <EmptyState icon="work_off" title={t("Job not found")} />;

  let visibleRows = rows;
  if (eligFilter !== "all") visibleRows = visibleRows.filter((r) => r.ev && r.ev.eligibilityStatus === eligFilter);
  // Newly linked, not-yet-screened candidates float to the top (newest first); the rest by score.
  const isNew = (r: WorkspaceRowData) => !r.ev && r.app.screeningStatus === "not_started";
  visibleRows = [...visibleRows].sort((a, b) => {
    if (isNew(a) !== isNew(b)) return isNew(a) ? -1 : 1;
    if (isNew(a)) return new Date(b.app.linkedAt).getTime() - new Date(a.app.linkedAt).getTime();
    return (b.ev?.overall ?? -1) - (a.ev?.overall ?? -1);
  });

  return (
    <div className="screening-workspace">
      <div className="screening-toolbar ws-head">
        <div>
          <button type="button" className="breadcrumb-back" style={{ marginBottom: 10 }} title={t("Back to jobs")} aria-label={t("Back to jobs")} onClick={() => navigate("/jobs")}>
            <Icon name="arrow_back" />
          </button>
          <div className="job-title-line">
            <h2 style={{ margin: 0, fontSize: "var(--fs-h1)", lineHeight: 1.2 }}>{job.title}</h2>
          </div>
          <p className="page-subtitle">
            {job.team} · {job.location} · {t("Standard")} v{job.criteriaVersion} ({t("confirmed")})
          </p>
        </div>
      </div>

      <ResumeUploadStrip onOpen={setImportTab} />

      <div className="candidate-section-heading">
        {t("AI Suggested candidates")} <span className="cnt">{suggested.length}</span>
        <Link className="btn btn-sm btn-secondary heading-action" to={`/jobs/${job.id}/criteria`}>
          {t("Requirements & rubric")}
        </Link>
      </div>
      <div className="card ws-card">
        {suggested.length ? (
          <table className="data-table ai-suggested-table">
            <thead>
              <tr>
                <th></th>
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
        ) : (
          <EmptyState
            icon="inbox"
            title={t("No pending recommendations")}
            body={t("AI-proposed matches for this role will appear here before anyone confirms them.")}
            actions={
              <Button variant="primary" onClick={handleMatchAgain} disabled={matching || job.criteriaStatus !== "confirmed"}>
                {t("Match again")}
              </Button>
            }
          />
        )}
      </div>

      <div className="page-header candidate-list-header">
        <div className="candidate-section-heading compact">
          {t("Linked candidates")} <span className="cnt">{rows.length}</span>
        </div>
        <div className="actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCompare}
            disabled={rows.length < 2 || creatingComparison}
            title={rows.length < 2 ? t("Link at least two candidates to this job before comparing.") : undefined}
          >
            {t("Compare candidates")}
          </Button>
        </div>
      </div>
      <div className="card">
        <table className="data-table linked-candidates-table">
          <thead>
            <tr>
              <th></th>
              <th>{t("Candidate")}</th>
              <th>
                <select className="table-head-filter" aria-label={t("Eligibility")} value={eligFilter} onChange={(e) => setEligFilter(e.target.value as EligFilter)}>
                  <option value="all">{t("Eligibility")}</option>
                  <option value="eligible">{t("Eligible")}</option>
                  <option value="needs_verification">{t("Needs verification")}</option>
                  <option value="not_eligible">{t("Not eligible")}</option>
                </select>
              </th>
              <th>{t("Overall")}</th>
              <th>{t("Coverage")}</th>
              <th>{t("AI recommendation")}</th>
              <th>{t("Human status")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((r) => <WorkspaceRow key={r.app.id} app={r.app} ev={r.ev} />)
            ) : (
              <tr>
                <td colSpan={8}>
                  <EmptyState icon="group_off" title={t("No linked candidates match this filter")} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {importTab && (
        <ResumeImportModal
          jobId={job.id}
          jobTitle={job.title}
          initialTab={importTab}
          onClose={() => {
            setImportTab(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function RecommendationRow({ recommendation, confidence }: { recommendation: JobRecommendation; confidence: string }) {
  const { t } = useStore();
  const navigate = useNavigate();
  const name = recommendation.candidateName || recommendation.candidateId;
  return (
    <tr className="clickable" onClick={() => navigate(`/candidates/${recommendation.candidateId}/jobs`)}>
      <td>
        <CandidateAvatar id={recommendation.candidateId} name={name} />
      </td>
      <td>
        <div style={{ fontWeight: 500 }}>{name}</div>
      </td>
      <td className="tiny suggestion-copy">{confidence}</td>
      <td className="tiny suggestion-copy">{recommendation.rationale}</td>
      <td className="text-right">
        <Link className="btn btn-sm btn-primary" to={`/candidates/${recommendation.candidateId}/jobs`} onClick={(e) => e.stopPropagation()}>
          {t("Review", "Review (action)")}
        </Link>
      </td>
    </tr>
  );
}
