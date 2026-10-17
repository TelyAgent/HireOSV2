import { useCallback, useEffect, useState } from "react";
import { decisionDiffersFromAi, humanStatus } from "../features/screening/humanStatus";
import type { Concern } from "../data/fixtures/concerns";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getJobDetail, listJobBelowThreshold, runJobMatch, type BelowThresholdCandidate } from "../data/api/jobs";
import { getJobRecommendations, type JobRecommendation } from "../data/api/candidates";
import { getApplicationDetail, listApplicationsForJob, type ApplicationWithNames } from "../data/api/screening";
import { createComparison, refreshComparison } from "../data/api/comparisons";
import { db } from "../data/db";
import type { Job } from "../data/fixtures/jobs";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { EligibilityStatus } from "../lib/scoring";
import { Icon } from "../components/ui/Icons";
import { ResumeImportModal, type ImportTab } from "../features/imports/ResumeImportPanel";
import { confidenceLabel, inferRecommendation } from "../lib/scoring";
import {
  AiRecommendationBadge,
  BackButton,
  Badge,
  Button,
  CandidateAvatar,
  CoverageBar,
  EligibilityBadge,
  EmptyState,
  scoreDisplay,
  ScoreRing,
} from "../components/ui/Primitives";
import { recommend, recommendationDisplay } from "../lib/recommendationRule";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { WithDisabledReason } from "../components/ui/DisabledReason";

type EligFilter = "all" | EligibilityStatus;

type WorkspaceRowData = { app: ApplicationWithNames; ev: Evaluation | undefined; openConcerns: number; concerns: Concern[] };



function WorkspaceRow({ app, ev, openConcerns, concerns }: WorkspaceRowData) {
  const { t } = useStore();
  const navigate = useNavigate();
  const decision = db.decisions[app.id];
  // The person's status, separate from the AI's columns: decided, or awaiting the next step (#187).
  const status = humanStatus(decision);
  const aiOutcome = ev ? inferRecommendation(ev, concerns) : null;
  const differs = decisionDiffersFromAi(aiOutcome, decision);
  const humanStatusCell = status.decided ? (
    <span className="flex-col" style={{ gap: 2 }}>
      <Badge tone="success">
        {t("Decided —")} {t(status.label)}
      </Badge>
      {differs && (
        <Link className="tiny" to={`/applications/${app.id}/decision`} onClick={(e) => e.stopPropagation()} title={t("A person decided differently from the AI recommendation. The person's decision is the one in effect.")}>
          {t("Differs from AI — see why")}
        </Link>
      )}
    </span>
  ) : (
    <span title={t(status.detail)}>
      <Badge tone="info">{t(status.label)}</Badge>
    </span>
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
      {/* Ordered by decision value (#27): score first, then coverage and concerns, explanations last. */}
      <td>
        {!ev ? (
          <span className="muted">—</span>
        ) : scoreDisplay(ev.overall) == null ? (
          <span className="tiny muted">{t("Insufficient evidence")}</span>
        ) : (
          <span className="score-big">{scoreDisplay(ev.overall)}</span>
        )}
      </td>
      <td className="coverage-col">{ev ? <CoverageBar coverage={ev.coverage} /> : "—"}</td>
      <td>
        {openConcerns > 0 && (
          <Badge tone="danger">
            {openConcerns} {t(openConcerns === 1 ? "concern" : "concerns")}
          </Badge>
        )}
      </td>
      <td>{ev ? <EligibilityBadge status={ev.eligibilityStatus} /> : <Badge tone="outline">{t("Not run")}</Badge>}</td>
      <td className="secondary-col">
        {!ev ? null : <AiRecommendationBadge display={recommendationDisplay(recommend(ev, concerns))} />}
      </td>
      <td>
        {humanStatusCell}
        {/* Where the AI column is hidden for width (#203), its recommendation stays readable here. */}
        {ev && (
          <div className="ai-inline tiny">
            {t("AI:")} <AiRecommendationBadge display={recommendationDisplay(recommend(ev, concerns))} />
          </div>
        )}
      </td>
      <td className="text-right open-col">
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
  { id: "folder", icon: "folder_open", title: "Import from folder", desc: "Import every resume in a local folder" },
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
  const [belowThreshold, setBelowThreshold] = useState<BelowThresholdCandidate[]>([]);
  const [showBelow, setShowBelow] = useState(false);

  const load = useCallback(async () => {
    try {
      const jobDetail = await getJobDetail(id);
      setJob(jobDetail);
      const [recs, apps, below] = await Promise.all([
        getJobRecommendations(jobDetail.id),
        listApplicationsForJob(jobDetail.id),
        listJobBelowThreshold(jobDetail.id).catch(() => []),
      ]);
      setSuggested(recs);
      setBelowThreshold(below);
      // Each application's evaluation is fetched individually -- there is no
      // bulk "evaluations for this job" endpoint, and at workspace scale
      // (a handful of linked candidates per role) N requests is fine.
      const details = await Promise.all(
        apps.map((app) => getApplicationDetail(app.id).catch(() => null)),
      );
      setRows(
        apps.map((app, i) => ({
          app,
          ev: details[i]?.evaluation || undefined,
          openConcerns: (details[i]?.concerns || []).filter((c) => c.status === "open").length,
          concerns: details[i]?.concerns || [],
        })),
      );
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
      const result = await runJobMatch(job.id);
      say(
        result.candidatesQueued > 0 || result.alreadyPending > 0
          ? t("Matching started in the background — new suggestions will appear here as each resume finishes")
          : t("No resumes in the library to match"),
        { type: "success" },
      );
    } catch {
      say(t("Could not start matching."), { type: "error" });
    } finally {
      setMatching(false);
    }
  };

  if (job === undefined) return <PageSkeleton />;

  if (job === null) return <EmptyState icon="work_off" title={t("Job not found")} />;

  const eligCount = (status: EligFilter) => rows.filter((r) => r.ev && r.ev.eligibilityStatus === status).length;
  let visibleRows = rows;
  if (eligFilter !== "all") visibleRows = visibleRows.filter((r) => r.ev && r.ev.eligibilityStatus === eligFilter);
  // Newly linked, not-yet-screened candidates float to the top (newest first); the rest by score.
  const isNew = (r: WorkspaceRowData) => !r.ev && r.app.screeningStatus === "not_started";
  visibleRows = [...visibleRows].sort((a, b) => {
    if (isNew(a) !== isNew(b)) return isNew(a) ? -1 : 1;
    if (isNew(a)) return new Date(b.app.linkedAt).getTime() - new Date(a.app.linkedAt).getTime();
    return (b.ev?.overall ?? -1) - (a.ev?.overall ?? -1);
  });

  const criteriaConfirmed = job.criteriaStatus === "confirmed";
  /** Resumes uploaded before the rubric is confirmed can't be matched, so uploading waits for it. */
  const openImport = (tab: ImportTab) => {
    if (!criteriaConfirmed) {
      say(t("Please confirm the requirements & rubric first"), { type: "warning" });
      return;
    }
    setImportTab(tab);
  };

  return (
    <div className="screening-workspace">
      <div className="screening-toolbar ws-head">
        <div>
          <BackButton fallback="/jobs" />
          <div className="job-title-line">
            <h2 style={{ margin: 0, fontSize: "var(--fs-h1)", lineHeight: 1.2 }}>{job.title}</h2>
          </div>
          <p className="page-subtitle">
            {job.team} · {job.location} · {t("Standard")} v{job.criteriaVersion} ({criteriaConfirmed ? t("confirmed") : t("pending confirmation")})
          </p>
        </div>
      </div>

      {!criteriaConfirmed && (
        <div className="criteria-guide" role="status">
          <Icon name="rule" />
          <span>{t("Confirm the requirements & rubric to start matching resumes for this job.")}</span>
          <Link to={`/jobs/${job.id}/criteria`}>{t("Confirm the rubric")} →</Link>
        </div>
      )}

      <ResumeUploadStrip onOpen={openImport} />

      <div className="candidate-section-heading">
        {t("AI Suggested candidates")} <span className="cnt">{suggested.length}</span>
        <span className="heading-action flex gap-8">
          <WithDisabledReason reason={criteriaConfirmed ? null : t("Confirm the job criteria before matching")}>
            <Button
              size="sm"
              variant="secondary"
              icon="refresh"
              onClick={handleMatchAgain}
              disabled={matching || !criteriaConfirmed}
              title={criteriaConfirmed ? t("Re-match the resume library against the current criteria") : undefined}
            >
              {t("Match again")}
            </Button>
          </WithDisabledReason>
          {!criteriaConfirmed && <Badge tone="warning">{t("Rubric not confirmed")}</Badge>}
          <Link className="btn btn-sm btn-secondary" to={`/jobs/${job.id}/criteria`}>
            {t("Requirements & rubric")}
          </Link>
        </span>
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
              <WithDisabledReason align="start" reason={criteriaConfirmed ? null : t("Confirm the job criteria before matching")}>
                <Button variant="primary" onClick={handleMatchAgain} disabled={matching || !criteriaConfirmed}>
                  {t("Match again")}
                </Button>
              </WithDisabledReason>
            }
          />
        )}
      </div>

      <div className="page-header candidate-list-header">
        <div className="candidate-section-heading compact">
          {t("Linked candidates")} <span className="cnt">{rows.length}</span>
        </div>
        <div className="actions">
          <WithDisabledReason reason={rows.length < 2 ? t("Link at least two candidates to this job before comparing.") : null}>
            <Button size="sm" variant="secondary" onClick={handleCompare} disabled={rows.length < 2 || creatingComparison}>
              {t("Compare candidates")}
            </Button>
          </WithDisabledReason>
        </div>
      </div>
      <div className="card">
        <table className="data-table linked-candidates-table">
          <thead>
            <tr>
              <th></th>
              <th>{t("Candidate")}</th>
              <th>{t("Overall")}</th>
              <th>{t("Coverage")}</th>
              <th>{t("Concerns")}</th>
              <th>
                {/* Each option shows how many rows it would leave (#27 AC-5). */}
                <select className="table-head-filter" aria-label={t("Eligibility")} value={eligFilter} onChange={(e) => setEligFilter(e.target.value as EligFilter)}>
                  <option value="all">
                    {t("Eligibility")} ({rows.length})
                  </option>
                  <option value="eligible">
                    {t("Eligible")} ({eligCount("eligible")})
                  </option>
                  <option value="needs_verification">
                    {t("Needs verification")} ({eligCount("needs_verification")})
                  </option>
                  <option value="not_eligible">
                    {t("Not eligible")} ({eligCount("not_eligible")})
                  </option>
                </select>
              </th>
              <th className="secondary-col">{t("AI recommendation")}</th>
              <th>{t("Human status")}</th>
              <th className="open-col"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((r) => <WorkspaceRow key={r.app.id} app={r.app} ev={r.ev} openConcerns={r.openConcerns} concerns={r.concerns} />)
            ) : (
              <tr>
                <td colSpan={9}>
                  <EmptyState icon="group_off" title={t("No linked candidates match this filter")} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {belowThreshold.length > 0 && (
        <>
          <button type="button" className="candidate-section-heading collapse-heading" style={{ marginTop: 16 }} aria-expanded={showBelow} onClick={() => setShowBelow((v) => !v)}>
            <Icon name={showBelow ? "expand_more" : "chevron_right"} size={18} />
            {t("Below match threshold")} <span className="cnt">{belowThreshold.length}</span>
            <span className="tiny muted" style={{ marginLeft: 8, fontWeight: 400 }}>
              {t("Evaluated against this job but not suggested — you can still review them.")}
            </span>
          </button>
          {showBelow && (
            <div className="card ws-card">
              <table className="data-table ai-suggested-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t("Candidate")}</th>
                    <th>{t("Overall")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Rationale")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {belowThreshold.map((c) => (
                    <tr className="clickable" key={c.candidateId} onClick={() => navigate(`/candidates/${c.candidateId}`)}>
                      <td>
                        <CandidateAvatar id={c.candidateId} name={c.candidateName} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.candidateName}</div>
                      </td>
                      <td>{c.score != null ? <ScoreRing overall={c.score} size="sm" /> : "—"}</td>
                      <td>
                        {c.reason === "below_threshold" ? <Badge tone="outline">{t("Below threshold")}</Badge> : <Badge tone="neutral">{t("Dismissed")}</Badge>}
                      </td>
                      <td>
                        <div className="secondary-copy" title={c.rationale}>{c.rationale}</div>
                      </td>
                      <td className="text-right">
                        <Link className="btn btn-sm btn-secondary" to={`/candidates/${c.candidateId}`} onClick={(e) => e.stopPropagation()}>
                          {t("Open", "Open (action)")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

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
      {/* Confidence and rationale explain the suggestion; they stay secondary to the candidate (#27 AC-3). */}
      <td>
        <span className="confidence-chip">{confidence}</span>
      </td>
      <td>
        <div className="secondary-copy" title={recommendation.rationale}>{recommendation.rationale}</div>
      </td>
      <td className="text-right">
        <Link className="btn btn-sm btn-primary" to={`/candidates/${recommendation.candidateId}/jobs`} onClick={(e) => e.stopPropagation()}>
          {t("Review", "Review (action)")}
        </Link>
      </td>
    </tr>
  );
}
