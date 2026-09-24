import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getCandidateDetail, correctProfile, type CandidateDetail } from "../data/api/candidates";
import { runMatchAgain } from "../data/api/library";
import { ApiError } from "../data/api/shared";
import { db, getJob, getPerson } from "../data/db";
import type { Candidate } from "../data/fixtures/candidates";
import type { JobDiscoveryRun } from "../data/fixtures/jobDiscovery";
import { fmtDate, fmtMoney, relTime } from "../lib/format";
import { Icon } from "../components/ui/Icons";
import { Button, CandidateAvatar, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";

const MATCH_POLL_INTERVAL_MS = 3000;
const MATCH_POLL_TIMEOUT_MS = 90_000;

const REC_STATUS_TONE: Record<string, string> = {
  dismissed: "badge-outline",
  deferred: "badge-neutral",
};

export function NoJobState({ jd, onMatchAgain, onCorrect }: { candidate: Candidate; jd: JobDiscoveryRun; onMatchAgain: () => void; onCorrect: () => void }) {
  const { t } = useStore();
  if (jd.status === "running")
    return <EmptyState icon="travel_explore" title={t("Searching for matching roles…")} body={t("AI matching is running in the background — this can take up to a minute.")} />;
  if (jd.status === "no_open_jobs")
    return (
      <EmptyState
        icon="work_off"
        title={t("No open roles right now")}
        body={t("There are currently no open, accessible jobs to match against.")}
        actions={
          <Button variant="primary" onClick={onMatchAgain}>
            {t("Match again")}
          </Button>
        }
      />
    );
  if (jd.status === "failed")
    return (
      <EmptyState
        icon="error_outline"
        title={t("Matching failed")}
        body={t("The last matching run didn’t complete. This is not the same as “no match” — retry when ready.")}
        actions={
          <Button variant="primary" onClick={onMatchAgain}>
            {t("Retry")}
          </Button>
        }
      />
    );
  if (jd.status === "no_match") {
    const openRoles = Object.values(db.jobs).filter((j) => j.status === "open").length;
    return (
      <EmptyState
        icon="search_off"
        title={t("No matching roles right now", "No open role in the current job set matches this profile yet.")}
        body={
          <>
            {jd.reason || t("No open role in the current job set matches this profile yet.")}
            <br />
            <span className="tiny">
              {t("Current search scope:")} {openRoles} {t("open roles")} · {t("last checked")} {relTime(jd.lastRunAt, "en")}
            </span>
          </>
        }
        actions={
          <>
            <Link className="btn btn-secondary" to="/jobs">
              {t("Search roles")}
            </Link>
            <Button variant="secondary" onClick={onCorrect}>
              {t("Update profile")}
            </Button>
            <Button variant="primary" onClick={onMatchAgain}>
              {t("Match again")}
            </Button>
          </>
        }
      />
    );
  }
  return (
    <EmptyState
      icon="travel_explore"
      title={t("Not matched yet")}
      body={t("This candidate hasn’t been matched against open roles yet.")}
      actions={
        <Button variant="primary" onClick={onMatchAgain}>
          {t("Run matching")}
        </Button>
      }
    />
  );
}

function CorrectProfileModal({ candidate, onClose, onSaved }: { candidate: Candidate; onClose: () => void; onSaved: () => void }) {
  const { t, say } = useStore();
  const [location, setLocation] = useState(candidate.contact.location.value);
  const [min, setMin] = useState(candidate.compensationExpectation ? String(candidate.compensationExpectation.min) : "");
  const [max, setMax] = useState(candidate.compensationExpectation ? String(candidate.compensationExpectation.max) : "");
  const [reason, setReason] = useState("");

  const save = async () => {
    await correctProfile(candidate.id, {
      location: location.trim() || undefined,
      compensationMin: min.trim() ? parseInt(min, 10) : undefined,
      compensationMax: max.trim() ? parseInt(max, 10) : undefined,
      reason: reason.trim() || t("Manual correction"),
    });
    onClose();
    say(t("Profile corrected — affected screenings marked stale for refresh"), { type: "success" });
    onSaved();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Correct profile")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={save}>
            {t("Save correction")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("Corrections create a new profile snapshot and are logged with a reason. They don’t rewrite the original source material.")}
      </p>
      <div className="field">
        <label>{t("Location")}</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex gap-16">
        <div className="field" style={{ flex: 1 }}>
          <label>{t("Compensation expectation — min (USD/yr)")}</label>
          <input type="text" value={min} onChange={(e) => setMin(e.target.value)} placeholder="e.g. 160000" />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{t("Compensation expectation — max (USD/yr)")}</label>
          <input type="text" value={max} onChange={(e) => setMax(e.target.value)} placeholder="e.g. 190000" />
        </div>
      </div>
      <div className="field">
        <label>{t("Reason for correction")}</label>
        <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Candidate confirmed by email" />
      </div>
    </Modal>
  );
}

export function CandidateProfilePage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [detail, setDetail] = useState<CandidateDetail | null | undefined>(undefined);
  const [showCorrect, setShowCorrect] = useState(false);
  const [matching, setMatching] = useState(false);

  const load = useCallback(() => {
    getCandidateDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // A match already in flight (auto-triggered on paste/upload, or a prior manual
  // click) has no completion event to subscribe to yet -- poll until it settles so
  // the "run matching" control doesn't stay disabled forever and results appear
  // without a manual refresh.
  useEffect(() => {
    if (!detail?.jobDiscovery.isMatching) return;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - startedAt > MATCH_POLL_TIMEOUT_MS) {
        window.clearInterval(timer);
        return;
      }
      load();
    }, MATCH_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [detail?.jobDiscovery.isMatching, load]);

  if (detail === undefined) return null;
  if (detail === null) {
    return (
      <EmptyState
        icon="person_off"
        title={t("Candidate not found")}
        actions={
          <Link className="btn btn-primary" to="/library">
            {t("Back to Resume Library")}
          </Link>
        }
      />
    );
  }

  const { candidate, resumeVersions, applications, recommendations, jobDiscovery: jd } = detail;
  const pendingRecs = recommendations.filter((r) => r.status === "proposed");
  const versions = [...resumeVersions].sort((a, b) => b.version - a.version);
  const owner = getPerson(candidate.owner);
  const relationshipEntries: { key: string; jobTitle: string; team: string; status: React.ReactNode; when: string; action: React.ReactNode }[] = [
    ...applications.map((a) => {
      const job = getJob(a.jobId);
      return {
        key: a.id,
        jobTitle: job?.title || "—",
        team: job?.team || "—",
        status: <span className="badge badge-success">{t("Linked")}</span>,
        when: `${fmtDate(a.linkedAt, state.lang)} ${t("by")} ${getPerson(a.linkedBy)?.name}`,
        action: (
          <Link className="btn btn-sm btn-secondary" to={`/applications/${a.id}`}>
            {t("Open screening")}
          </Link>
        ),
      };
    }),
    ...recommendations
      .filter((r) => r.status !== "confirmed")
      .map((r) => {
        const job = getJob(r.jobId);
        const statusBadge =
          r.status === "proposed" ? (
            <span className="badge badge-info">{t("Pending recommendation")}</span>
          ) : (
            <span className={`badge ${REC_STATUS_TONE[r.status] || "badge-outline"}`}>{t(r.status.charAt(0).toUpperCase() + r.status.slice(1))}</span>
          );
        return {
          key: r.id,
          jobTitle: job?.title || "—",
          team: job?.team || "—",
          status: (
            <>
              {statusBadge}
              {job && job.status !== "open" && <span className="badge badge-warning"> {t("Role closed")}</span>}
            </>
          ),
          when: `${t("Proposed")} ${relTime(r.createdAt, state.lang)}`,
          action: (
            <Link className="btn btn-sm btn-secondary" to={`/candidates/${candidate.id}/jobs`}>
              {t("Review", "Review (action)")}
            </Link>
          ),
        };
      }),
  ];

  const handleMatchAgain = async () => {
    if (jd.isMatching) return;
    setMatching(true);
    try {
      await runMatchAgain(candidate.id);
    } catch (error) {
      if (error instanceof ApiError && error.code === "MATCH_IN_PROGRESS") {
        say(t("A matching run is already in progress for this candidate."), { type: "info" });
      } else {
        say(t("Could not start matching."), { type: "error" });
      }
    }
    setMatching(false);
    load();
  };

  return (
    <>
      <PageHeader
        title={candidate.displayName}
        subtitle={`${state.lang === "zh" ? `入库时间：${fmtDate(candidate.createdAt, state.lang)}` : `In library since ${fmtDate(candidate.createdAt, state.lang)}`} · ${t("Owner:")} ${owner?.name}`}
        crumbs={[{ label: t("Resume Library"), href: "/library" }, { label: candidate.displayName }]}
        actions={
          <>
            <Button variant="secondary" icon="edit" onClick={() => setShowCorrect(true)}>
              {t("Correct profile")}
            </Button>
            <Button variant="secondary" icon="travel_explore" onClick={handleMatchAgain} disabled={matching || jd.isMatching}>
              {jd.isMatching ? t("Matching…") : t("Match again")}
            </Button>
            <Link className="btn btn-primary" to={`/candidates/${candidate.id}/jobs`}>
              <Icon name="work_outline" />
              {t("Job recommendations")}
              {pendingRecs.length > 0 && <span className="badge-count">{pendingRecs.length}</span>}
            </Link>
          </>
        }
      />

      <div className="two-col">
        <div className="col-list flex-col gap-16">
          <div className="card card-pad">
            <div className="flex items-center gap-12" style={{ marginBottom: 12 }}>
              <CandidateAvatar id={candidate.id} name={candidate.displayName} size="md" />
              <div>
                <div style={{ fontWeight: 600 }}>{candidate.displayName}</div>
                <div className="tiny">
                  {t("Identity:")} {t(candidate.identityStatus === "confirmed" ? "Confirmed" : "Provisional")}
                </div>
              </div>
            </div>
            <table className="data-table">
              <tbody>
                <tr>
                  <td className="tiny">{t("Email")}</td>
                  <td>{candidate.contact.email}</td>
                </tr>
                <tr>
                  <td className="tiny">{t("Phone")}</td>
                  <td>{candidate.contact.phone || "—"}</td>
                </tr>
                <tr>
                  <td className="tiny">{t("Location")}</td>
                  <td>
                    {candidate.contact.location.value} {candidate.contact.location.status === "unknown" && <span className="badge badge-outline">{t("Unknown")}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="tiny">{t("Work authorization")}</td>
                  <td>
                    {candidate.workAuth.value} {candidate.workAuth.status === "unknown" && <span className="badge badge-outline">{t("Unknown")}</span>}
                  </td>
                </tr>
                <tr>
                  <td className="tiny">{t("Compensation expectation")}</td>
                  <td>{candidate.compensationExpectation ? fmtMoney(candidate.compensationExpectation, state.lang) : <span className="badge badge-outline">{t("Not provided")}</span>}</td>
                </tr>
              </tbody>
            </table>
            <div style={{ marginTop: 10 }}>
              {candidate.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {candidate.missingFields.length > 0 && (
            <div className="card card-pad" style={{ borderColor: "var(--warning-border)", background: "var(--warning-bg)" }}>
              <div className="flex items-center gap-8" style={{ color: "var(--warning-text)", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                <Icon name="info" size={18} />
                {t("Missing information")}
              </div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
                {candidate.missingFields.map((f) => (
                  <li key={f}>{f.replace(/_/g, " ")}</li>
                ))}
              </ul>
              <p className="tiny" style={{ marginTop: 6 }}>
                {t("An empty field is not treated as a “no” — it stays unknown until confirmed.")}
              </p>
            </div>
          )}

          <div className="card card-pad">
            <div className="section-title">{t("Resume versions")}</div>
            {versions.length ? (
              versions.map((v) => (
                <div className="list-row" style={{ padding: "8px 2px" }} key={v.id}>
                  <Icon name="description" size={18} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "var(--fs-sm)" }}>
                      {v.fileName} {v.isLatest ? <span className="badge badge-success">{t("Latest")}</span> : <span className="badge badge-outline">v{v.version}</span>}
                    </div>
                    <div className="tiny">
                      {v.source} · {fmtDate(v.uploadedAt, state.lang)}
                      {v.changeNote ? ` · ${v.changeNote}` : ""}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="tiny">{t("No resume file — structured entry only.")}</p>
            )}
          </div>
        </div>

        <div className="flex-col gap-16">
          <div className="card card-pad">
            <div className="section-title">{t("Job relationships")}</div>
            {relationshipEntries.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Job")}</th>
                    <th>{t("Team")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("When")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {relationshipEntries.map((row) => (
                    <tr key={row.key}>
                      <td>{row.jobTitle}</td>
                      <td>{row.team}</td>
                      <td>{row.status}</td>
                      <td className="tiny">{row.when}</td>
                      <td className="text-right">{row.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <NoJobState candidate={candidate} jd={jd} onMatchAgain={handleMatchAgain} onCorrect={() => setShowCorrect(true)} />
            )}
          </div>

          <div className="card card-pad">
            <div className="section-title">{t("Employment history")}</div>
            {candidate.employment.length ? (
              candidate.employment.map((e, i) => (
                <div style={{ marginBottom: 14 }} key={i}>
                  <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>
                    {e.title} {e.company ? `· ${e.company}` : ""}
                  </div>
                  <div className="tiny">
                    {e.start} – {e.end}
                  </div>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
                    {e.achievements.map((a, ai) => (
                      <li key={ai}>{a}</li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="tiny">{t("No employment history captured.")}</p>
            )}
            <div className="flex gap-8 flex-wrap" style={{ marginTop: 8 }}>
              <div>
                <div className="tiny" style={{ marginBottom: 4 }}>
                  {t("Skills")}
                </div>
                {candidate.skills.length ? candidate.skills.map((s) => <span className="tag" key={s}>{s}</span>) : <span className="tiny muted">{t("None captured")}</span>}
              </div>
            </div>
            {candidate.education.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="tiny" style={{ marginBottom: 4 }}>
                  {t("Education")}
                </div>
                {candidate.education.map((e, i) => (
                  <div style={{ fontSize: "var(--fs-sm)" }} key={i}>
                    {e.statement} <span className="tiny">({e.period || ""})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCorrect && <CorrectProfileModal candidate={candidate} onClose={() => setShowCorrect(false)} onSaved={load} />}
    </>
  );
}
