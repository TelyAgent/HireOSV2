import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  addManualRecommendation,
  confirmJobLink,
  deferRecommendation,
  dismissRecommendation,
  getCandidateDetail,
} from "../data/api/candidates";
import { runMatchAgain } from "../data/api/library";
import { db, getJob, getPerson } from "../data/db";
import type { Candidate } from "../data/fixtures/candidates";
import type { CandidateJobRecommendation } from "../data/fixtures/recommendations";
import type { JobDiscoveryRun } from "../data/fixtures/jobDiscovery";
import { fmtDateTime, relTime } from "../lib/format";
import { confidenceLabel } from "../lib/scoring";
import { Button, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";
import { Icon } from "../components/ui/Icons";
import { NoJobState } from "./CandidateProfilePage";

function ChooseAnotherRoleModal({ candidate, onClose, onAdded }: { candidate: Candidate; onClose: () => void; onAdded: () => void }) {
  const { t, say } = useStore();
  const existingRecs = db.recommendations.filter((r) => r.candidateId === candidate.id && r.status !== "dismissed");
  const openJobs = Object.values(db.jobs).filter((j) => j.status === "open" && !existingRecs.some((r) => r.jobId === j.id));

  const pick = async (jobId: string) => {
    await addManualRecommendation(candidate.id, jobId);
    onClose();
    say(t("Added as a manual recommendation — pending confirmation"), { type: "success" });
    onAdded();
  };

  return (
    <Modal open onClose={onClose} title={t("Choose another role")}>
      {openJobs.length ? (
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
  onClose,
  onConfirmed,
}: {
  candidate: Candidate;
  rec: CandidateJobRecommendation;
  onClose: () => void;
  onConfirmed: (applicationId: string) => void;
}) {
  const { t, state, say } = useStore();
  const [reason, setReason] = useState("");
  const job = getJob(rec.jobId)!;
  const existingApp = db.applications.find((a) => a.candidateId === candidate.id && a.jobId === job.id);

  const confirm = async () => {
    const app = await confirmJobLink(rec.id, { reason: reason.trim() || undefined, confirmedBy: state.currentUser });
    onClose();
    say(t('Linked to role — "Review screening & choose next step" added to My Tasks'), { type: "success" });
    onConfirmed(app.id);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Confirm job link")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={confirm}>
            {t("Confirm job link")}
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
  const navigate = useNavigate();
  const [detail, setDetail] = useState<{ candidate: Candidate; recommendations: CandidateJobRecommendation[] } | null | undefined>(undefined);
  const [chooseRoleOpen, setChooseRoleOpen] = useState(false);
  const [confirmRec, setConfirmRec] = useState<CandidateJobRecommendation | null>(null);

  const load = useCallback(() => {
    getCandidateDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (detail === undefined) return null;
  if (detail === null) return <EmptyState icon="person_off" title={t("Candidate not found")} />;

  const { candidate, recommendations } = detail;
  const jd: JobDiscoveryRun = db.jobDiscovery[candidate.id] || { status: "not_started", lastRunAt: null, jobsScanned: 0 };

  const handleMatchAgain = async () => {
    await runMatchAgain(candidate.id);
    load();
  };

  const handleAction = async (rec: CandidateJobRecommendation, action: "defer" | "dismiss") => {
    if (action === "dismiss") {
      await dismissRecommendation(rec.id);
      say(t("Recommendation dismissed — candidate stays in the library"));
    } else {
      await deferRecommendation(rec.id);
      say(t("Deferred — task remains open"));
    }
    load();
  };

  if (!recommendations.length) {
    return (
      <>
        <PageHeader
          title={t("Job recommendations")}
          subtitle={candidate.displayName}
          crumbs={[{ label: t("Resume Library"), href: "/library" }, { label: candidate.displayName, href: `/candidates/${candidate.id}` }, { label: t("Job recommendations") }]}
        />
        <div className="card">
          <NoJobState candidate={candidate} jd={jd} onMatchAgain={handleMatchAgain} onCorrect={() => {}} />
        </div>
      </>
    );
  }

  const subtitle =
    state.lang === "zh"
      ? `为 ${candidate.displayName} 提供的 AI 候选人 × 职位匹配建议。确认仅表示"纳入考虑范围"——不会自动推进流程或通知任何人。`
      : `AI-proposed candidate × job matches for ${candidate.displayName}. Confirming only means "include in consideration" — it does not advance or notify anyone.`;

  return (
    <>
      <PageHeader
        title={t("Job recommendations")}
        subtitle={subtitle}
        crumbs={[{ label: t("Resume Library"), href: "/library" }, { label: candidate.displayName, href: `/candidates/${candidate.id}` }, { label: t("Job recommendations") }]}
      />
      <div className="flex-col gap-16">
        {recommendations.map((rec) => {
          const job = getJob(rec.jobId)!;
          const app = db.applications.find((a) => a.candidateId === candidate.id && a.jobId === rec.jobId);
          const roleClosed = job.status !== "open";
          let statusChip: React.ReactNode;
          if (rec.status === "confirmed") statusChip = <span className="badge badge-success">{t("Confirmed — linked to role")}</span>;
          else if (rec.status === "dismissed") statusChip = <span className="badge badge-outline">{t("Dismissed")}</span>;
          else if (rec.status === "deferred") statusChip = <span className="badge badge-neutral">{t("Deferred")}</span>;
          else statusChip = <span className="badge badge-info">{t("Pending confirmation")}</span>;

          return (
            <div className="card card-pad" key={rec.id}>
              <div className="flex items-center justify-between flex-wrap gap-8">
                <div>
                  <div style={{ fontWeight: 600, fontSize: "var(--fs-lg)" }}>
                    {job.title} <span className="tiny muted">{job.team} · {job.location}</span>
                  </div>
                  <div className="flex items-center gap-8" style={{ marginTop: 4 }}>
                    {statusChip}
                    {roleClosed && <span className="badge badge-warning">{t("Role closed")}</span>}
                    <span className="tiny">{confidenceLabel(rec, state.lang)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="tiny">
                    {t("Proposed")} {relTime(rec.createdAt, state.lang)}
                  </div>
                </div>
              </div>
              <div className="divider" />
              <p style={{ fontSize: "var(--fs-sm)", margin: "0 0 8px" }}>
                <strong>{t("Why this match:")}</strong> {rec.rationale}
              </p>
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
                      <Button variant="secondary" onClick={() => setChooseRoleOpen(true)}>
                        {t("Choose another role")}
                      </Button>
                      <Button variant="secondary" onClick={() => handleAction(rec, "defer")}>
                        {t("Defer")}
                      </Button>
                      <Button variant="secondary" onClick={() => handleAction(rec, "dismiss")}>
                        {t("Dismiss recommendation")}
                      </Button>
                      <Button variant="primary" disabled={roleClosed} onClick={() => setConfirmRec(rec)}>
                        {t("Confirm job link")}
                      </Button>
                    </>
                  )}
                  {rec.status === "deferred" && (
                    <>
                      <Button variant="secondary" onClick={() => handleAction(rec, "dismiss")}>
                        {t("Dismiss")}
                      </Button>
                      <Button variant="primary" onClick={() => setConfirmRec(rec)}>
                        {t("Confirm job link")}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {chooseRoleOpen && <ChooseAnotherRoleModal candidate={candidate} onClose={() => setChooseRoleOpen(false)} onAdded={load} />}
      {confirmRec && (
        <ConfirmLinkModal
          candidate={candidate}
          rec={confirmRec}
          onClose={() => setConfirmRec(null)}
          onConfirmed={() => navigate(`/candidates/${candidate.id}/jobs`)}
        />
      )}
    </>
  );
}
