import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  addManualRecommendation,
  confirmJobLink,
  deferRecommendation,
  dismissRecommendation,
  getCandidateDetail,
  reparseCandidate,
  type CandidateDetail,
} from "../data/api/candidates";
import { runMatchAgain } from "../data/api/library";
import { listJobs } from "../data/api/jobs";
import { ApiError } from "../data/api/shared";
import { getJob, getPerson } from "../data/db";
import type { Candidate } from "../data/fixtures/candidates";
import type { Application } from "../data/fixtures/applications";
import type { Job } from "../data/fixtures/jobs";
import type { CandidateJobRecommendation } from "../data/fixtures/recommendations";
import { fmtDateTime, relTime } from "../lib/format";
import { confidenceLabel } from "../lib/scoring";
import { Button, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";
import { Icon } from "../components/ui/Icons";
import { NoJobState, latestParseStatus } from "./CandidateProfilePage";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { recommendationStatus, showsConfidence, staleReason } from "../features/recommendations/recommendationCopy";

function ChooseAnotherRoleModal({
  candidate,
  recommendations,
  onClose,
  onAdded,
}: {
  candidate: Candidate;
  recommendations: CandidateJobRecommendation[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { t, say } = useStore();
  const [jobs, setJobs] = useState<Job[] | null>(null);

  useEffect(() => {
    listJobs().then(setJobs);
  }, []);

  const existingRecs = recommendations.filter((r) => r.status !== "dismissed");
  const openJobs = (jobs ?? []).filter((j) => j.status === "open" && !existingRecs.some((r) => r.jobId === j.id));

  const pick = async (jobId: string) => {
    await addManualRecommendation(candidate.id, jobId);
    onClose();
    say(t("Added as a manual recommendation — pending confirmation"), { type: "success" });
    onAdded();
  };

  return (
    <Modal open onClose={onClose} title={t("Choose another role")}>
      {jobs === null ? (
        <p className="tiny">{t("Loading…")}</p>
      ) : openJobs.length ? (
        openJobs.map((j) => (
          <div className="radio-card" style={{ marginBottom: 8 }} key={j.id} onClick={() => pick(j.id)}>
            <div>
              <div style={{ fontWeight: 500 }}>{j.title}</div>
              <div className="tiny">
                {j.team} · {j.location}
              </div>
            </div>
          </div>
        ))
      ) : (
        <p className="tiny">{t("No other open roles available to propose right now.")}</p>
      )}
    </Modal>
  );
}

function ConfirmLinkModal({
  candidate,
  rec,
  applications,
  onClose,
  onConfirmed,
  onPending,
}: {
  candidate: Candidate;
  rec: CandidateJobRecommendation;
  applications: Application[];
  onClose: () => void;
  onConfirmed: (app: Application) => void;
  /** Tells the page a confirmation is on its way, so the card can't be acted on twice (#188). */
  onPending: (pending: boolean) => void;
}) {
  const { t, state } = useStore();
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const job = getJob(rec.jobId)!;
  const existingApp = applications.find((a) => a.candidateId === candidate.id && a.jobId === job.id);

  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    setError(null);
    onPending(true);
    try {
      const app = await confirmJobLink(rec.id, { reason: reason.trim() || undefined, confirmedBy: state.currentUser });
      // The card turns "confirmed" in the same moment as the success message (#188).
      onConfirmed(app);
    } catch (error) {
      onPending(false);
      // Without this, a failed confirm (e.g. the recommendation went stale because the
      // candidate's profile or the job's criteria changed since it was proposed) used to
      // fail completely silently -- the modal just sat there and the status never moved,
      // with nothing telling the recruiter why.
      // The modal stays open with the reason as typed; the error says why and Confirm tries again (#188 AC-3).
      if (error instanceof ApiError && (error.code === "RECOMMENDATION_STALE" || error.code === "RECOMMENDATION_NOT_CONFIRMABLE")) {
        setError(t("This recommendation is out of date (profile or job criteria changed) — refresh matching and try again."));
      } else if (error instanceof ApiError && error.code === "JOB_NOT_OPEN") {
        setError(t("This role is no longer open."));
      } else {
        setError(t("Could not confirm this job link. Check your connection and try again."));
      }
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => {
        if (!confirming) onClose();
      }}
      title={t("Confirm job link")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={confirming}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={confirm} loading={confirming} data-testid="confirm-link">
            {error ? t("Try again") : t("Confirm job link")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("This confirms {name} should be considered for {job}. It does not advance them, invite them to anything, or send a notification.")
          .replace("{name}", candidate.displayName)
          .replace("{job}", job.title)}
      </p>
      <table className="data-table">
        <tbody>
          <tr>
            <td className="tiny">{t("Candidate")}</td>
            <td>{candidate.displayName}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Job")}</td>
            <td>
              {job.title} — {t("role criteria")} v{job.criteriaVersion} ({t("confirmed")})
            </td>
          </tr>
          <tr>
            <td className="tiny">{t("Already linked?")}</td>
            <td>{existingApp ? t("Yes — an existing Application will be reused, not duplicated.") : t("No — a new Application will be created.")}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Confirmed by")}</td>
            <td>
              {getPerson(state.currentUser)?.name}, {fmtDateTime(new Date().toISOString(), state.lang)}
            </td>
          </tr>
        </tbody>
      </table>
      {error && (
        <div className="error-inline" style={{ marginTop: 12 }} role="alert" data-testid="confirm-error">
          <Icon name="error" />
          {error}
        </div>
      )}
      <div className="field" style={{ marginTop: 12 }}>
        <label>{t("Reason (optional)")}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Why is this candidate a fit to screen for this role?")} />
      </div>
    </Modal>
  );
}

export function JobRecommendationsPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [detail, setDetail] = useState<CandidateDetail | null | undefined>(undefined);
  const [chooseRoleOpen, setChooseRoleOpen] = useState(false);
  const [confirmRec, setConfirmRec] = useState<CandidateJobRecommendation | null>(null);
  // The recommendation being confirmed, dismissed or deferred right now: its card can't be acted on again (#188).
  const [busyRec, setBusyRec] = useState<string | null>(null);
  const location = useLocation();

  const load = useCallback(() => {
    getCandidateDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Opened from a profile row for one job: bring that card into view, so Beijing and Shanghai aren't mixed up (#185).
  const focusId = location.hash.startsWith("#rec-") ? location.hash.slice(1) : null;
  useLayoutEffect(() => {
    if (focusId && detail) document.getElementById(focusId)?.scrollIntoView({ block: "center" });
  }, [focusId, detail]);

  if (detail === undefined) return <PageSkeleton />;
  if (detail === null) return <EmptyState icon="person_off" title={t("Candidate not found")} />;

  const { candidate, recommendations, applications, jobDiscovery: jd } = detail;

  const handleMatchAgain = async () => {
    await runMatchAgain(candidate.id);
    load();
  };
  const handleReparse = async () => {
    await reparseCandidate(candidate.id);
    load();
  };

  const handleAction = async (rec: CandidateJobRecommendation, action: "defer" | "dismiss") => {
    if (busyRec) return;
    setBusyRec(rec.id);
    try {
      if (action === "dismiss") {
        await dismissRecommendation(rec.id);
        say(t("Recommendation dismissed — candidate stays in the library"));
      } else {
        await deferRecommendation(rec.id);
        say(t("Deferred — you can come back to it later"));
      }
    } catch {
      say(t("Couldn't update this recommendation. Try again."), { type: "error" });
    } finally {
      setBusyRec(null);
      load();
    }
  };

  /** A confirmed link shows on its card at once, then the page refreshes in the background (#188 AC-2). */
  const handleConfirmed = (rec: CandidateJobRecommendation, app: Application) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            recommendations: current.recommendations.map((r) => (r.id === rec.id ? { ...r, status: "confirmed", applicationRef: app.id } : r)),
            applications: current.applications.some((a) => a.id === app.id) ? current.applications : [app, ...current.applications],
          }
        : current,
    );
    setConfirmRec(null);
    setBusyRec(null);
    // The person's status after linking is "awaiting next step" (F07 FR-4, #187); the AI screening runs on its own.
    say(t("Linked — awaiting next step. Open the screening to review the AI result and choose what happens next."), { type: "success" });
    load();
  };

  if (!recommendations.length) {
    return (
      <>
        <PageHeader
          title={t("Job recommendations")}
          subtitle={candidate.displayName}
          back={`/candidates/${candidate.id}`}
        />
        <div className="card">
          <NoJobState
            candidate={candidate}
            jd={jd}
            parseStatus={latestParseStatus(detail.resumeVersions)}
            onMatchAgain={handleMatchAgain}
            onCorrect={() => {}}
            onReparse={handleReparse}
          />
        </div>
      </>
    );
  }

  const subtitle =
    state.lang === "zh"
      ? `为 ${candidate.displayName} 提供的 AI 候选人 × 职位匹配建议。确认仅表示"纳入考虑范围"——不会自动推进流程或通知任何人。`
      : `AI-proposed candidate × job matches for ${candidate.displayName}. Confirming only means "include in consideration" — it does not advance or notify anyone.`;

  // Current recommendations first; those a newer run replaced follow, marked as such (#182).
  const current = recommendations.filter((r) => r.status !== "stale");
  const replaced = recommendations.filter((r) => r.status === "stale");
  const resumeFile = [...detail.resumeVersions].sort((a, b) => b.version - a.version)[0];

  return (
    <>
      <PageHeader
        title={t("Job recommendations")}
        subtitle={subtitle}
        back={`/candidates/${candidate.id}`}
        actions={
          // A stable way to the profile of the person these recommendations are about (#191); coming back
          // (Back or the browser) returns to this page with nothing decided on their behalf.
          <Link className="btn btn-secondary" to={`/candidates/${candidate.id}`} data-testid="open-profile">
            <Icon name="person" />
            {t("View candidate profile")}
          </Link>
        }
      />
      <p className="tiny muted" style={{ marginTop: -8, marginBottom: 12 }} data-testid="profile-scope">
        {resumeFile
          ? t("The profile shows work history, skills and résumé versions; the latest résumé is “%s”, readable from its version history.").replace("%s", resumeFile.fileName)
          : t("The profile shows work history and skills. There is no résumé file — structured profile only.")}
      </p>
      <div className="flex-col gap-16">
        {[...current, ...replaced].map((rec, index) => {
          const job = getJob(rec.jobId)!;
          const app = applications.find((a) => a.candidateId === candidate.id && a.jobId === rec.jobId);
          const roleClosed = job.status !== "open";
          const status = recommendationStatus(rec);
          const busy = busyRec === rec.id;
          const statusChip = busy ? (
            <span className="badge badge-info" data-testid="rec-busy">{t("Saving…")}</span>
          ) : (
            <span className={`badge ${status.tone}`} data-testid="rec-status">{t(status.label)}</span>
          );
          const notEligible = rec.eligibility === "not_eligible" && rec.status !== "stale";

          return (
            <div key={rec.id}>
            {index === current.length && replaced.length > 0 && (
              <div className="section-title" style={{ margin: "8px 0" }}>
                {t("Earlier recommendations — replaced by a newer match run")}
              </div>
            )}
            <div
              className={`card card-pad${focusId === `rec-${rec.id}` ? " card-focus" : ""}`}
              id={`rec-${rec.id}`}
              data-rec-status={rec.status}
              style={rec.status === "stale" ? { opacity: 0.75 } : undefined}
            >
              <div className="flex items-center justify-between flex-wrap gap-8">
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-lg)" }}>
                    {job.title} <span className="tiny muted">{job.team} · {job.location}</span>
                  </div>
                  <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
                    {statusChip}
                    {notEligible && <span className="badge badge-danger" data-testid="not-eligible">{t("Not eligible")}</span>}
                    {roleClosed && <span className="badge badge-warning">{t("Role closed")}</span>}
                    {/* No confidence level for a recommendation the résumé rules out, or one that was replaced (#181 #182). */}
                    {showsConfidence(rec) && <span className="tiny" data-testid="confidence">{confidenceLabel(rec, state.lang)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tiny">
                    {t("Proposed")} {relTime(rec.createdAt, state.lang)}
                  </div>
                </div>
              </div>
              {staleReason(rec) && (
                <p className="tiny muted" style={{ margin: "8px 0 0" }} data-testid="stale-reason">
                  {t(staleReason(rec)!)} {t("It can no longer be confirmed.")}
                </p>
              )}
              <div className="divider" />
              {notEligible && (rec.conflicts?.length ?? 0) > 0 && (
                <div className="error-inline" style={{ marginBottom: 10 }} data-testid="conflicts">
                  <Icon name="block" />
                  <div>
                    <strong>{t("The résumé rules this role out:")}</strong>
                    <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                      {rec.conflicts!.map((c, i) => (
                        <li key={i}>
                          {c.requirement}: “{c.quote}”
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <p style={{ fontSize: "var(--fs-sm)", margin: "0 0 8px" }}>
                <strong>{t("Why this match:")}</strong> {rec.rationale}
              </p>
              {(rec.evidence?.length ?? 0) > 0 && (
                <div style={{ fontSize: "var(--fs-sm)", marginBottom: 8 }} data-testid="rec-evidence">
                  <strong>{t("From the résumé:")}</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {rec.evidence!.map((e, i) => (
                      <li key={i}>
                        {e.requirementLabel ? <span className="tiny muted">{e.requirementLabel} — </span> : null}“{e.quote}”{" "}
                        <span className={`badge ${e.verification === "found" ? "badge-success" : e.verification === "not_found" ? "badge-warning" : "badge-outline"}`}>
                          {t(e.verification === "found" ? "Found in the résumé used" : e.verification === "not_found" ? "Not found in the résumé used" : "Not checked")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {rec.gaps.length > 0 && (
                <div style={{ fontSize: "var(--fs-sm)" }}>
                  <strong>{t("Key gaps / unknowns:")}</strong>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {rec.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {rec.basis && (
                <p className="tiny muted" style={{ margin: "8px 0 0" }} data-testid="rec-basis">
                  {t("Based on")} {rec.basis.profileVersion != null ? `${t("profile")} v${rec.basis.profileVersion}` : t("profile version not recorded")}
                  {" · "}
                  {rec.basis.criteriaVersion != null ? `${t("role criteria")} v${rec.basis.criteriaVersion}` : t("criteria version not recorded")}
                  {rec.basis.discoveryRunId ? ` · ${t("match run")} ${rec.basis.discoveryRunId.slice(0, 8)}` : ""}
                  {rec.basis.evaluatedAt ? ` · ${fmtDateTime(rec.basis.evaluatedAt, state.lang)}` : ""}
                </p>
              )}
              {roleClosed && rec.status === "proposed" && (
                <div className="error-inline" style={{ marginTop: 12 }}>
                  <Icon name="block" />
                  {t("This role closed after the recommendation was generated. It can no longer be confirmed — dismiss it or check for a refreshed match.")}
                </div>
              )}
              <div className="page-header" style={{ marginTop: 14, marginBottom: 0 }}>
                <div />
                <div className="actions">
                  {rec.status === "confirmed" && app && (
                    <Link className="btn btn-primary" to={`/applications/${app.id}`}>
                      {t("Open screening")}
                    </Link>
                  )}
                  {rec.status === "proposed" && (
                    <>
                      <Button variant="secondary" disabled={busy} onClick={() => setChooseRoleOpen(true)}>
                        {t("Choose another role")}
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => handleAction(rec, "defer")}>
                        {t("Defer")}
                      </Button>
                      <Button variant="secondary" disabled={busy} onClick={() => handleAction(rec, "dismiss")}>
                        {t("Dismiss recommendation")}
                      </Button>
                      <Button variant="primary" disabled={roleClosed || busy} onClick={() => setConfirmRec(rec)}>
                        {t("Confirm job link")}
                      </Button>
                    </>
                  )}
                  {rec.status === "deferred" && (
                    <>
                      <Button variant="secondary" disabled={busy} onClick={() => handleAction(rec, "dismiss")}>
                        {t("Dismiss")}
                      </Button>
                      <Button variant="primary" disabled={busy} onClick={() => setConfirmRec(rec)}>
                        {t("Confirm job link")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
            </div>
          );
        })}
      </div>

      {chooseRoleOpen && (
        <ChooseAnotherRoleModal candidate={candidate} recommendations={recommendations} onClose={() => setChooseRoleOpen(false)} onAdded={load} />
      )}
      {confirmRec && (
        <ConfirmLinkModal
          candidate={candidate}
          rec={confirmRec}
          applications={applications}
          onClose={() => setConfirmRec(null)}
          onConfirmed={(app) => handleConfirmed(confirmRec, app)}
          onPending={(pending) => setBusyRec(pending ? confirmRec.id : null)}
        />
      )}
    </>
  );
}
