import { useCallback, useEffect, useState } from "react";
import { recommendationStatus, staleReason } from "../features/recommendations/recommendationCopy";
import { sourceLabel } from "../features/imports/sources";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  getCandidateDetail,
  correctProfile,
  reparseCandidate,
  COMPENSATION_CURRENCIES,
  CORRECTION_REASON_LABEL,
  CORRECTION_REASON_TYPES,
  type CorrectionReasonType,
  type CandidateDetail,
  type CompensationCurrency,
} from "../data/api/candidates";
import { runMatchAgain } from "../data/api/library";
import { ApiError } from "../data/api/shared";
import { db, getJob, getPerson } from "../data/db";
import type { Candidate } from "../data/fixtures/candidates";
import type { JobDiscoveryRun } from "../data/fixtures/jobDiscovery";
import { fmtDate, fmtDateTime, fmtMoney, relTime } from "../lib/format";
import { Icon } from "../components/ui/Icons";
import { Button, CandidateAvatar, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";
import { useBoundedPolling } from "../lib/usePolling";
import { StillProcessingNotice } from "../components/ui/StillProcessing";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { useFieldValidation } from "../lib/useFieldValidation";
import { ProfileHistoryModal } from "../features/candidates/ProfileHistoryModal";
import { ParsedFieldsCard } from "../features/candidates/ParsedFieldsCard";

const MATCH_POLL_INTERVAL_MS = 3000;
const PARSE_POLL_INTERVAL_MS = 3000;

export function latestParseStatus(resumeVersions: CandidateDetail["resumeVersions"]) {
  return [...resumeVersions].sort((a, b) => b.version - a.version)[0]?.parseStatus;
}

export function NoJobState({
  jd,
  parseStatus,
  onMatchAgain,
  onCorrect,
  onReparse,
}: {
  candidate: Candidate;
  jd: JobDiscoveryRun;
  parseStatus?: string;
  onMatchAgain: () => void;
  onCorrect: () => void;
  onReparse: () => void;
}) {
  const { t, state } = useStore();
  // Matching reads the parsed profile, so without one a run can only end as "insufficient
  // data" -- point at the parse instead of offering a match button that can't work.
  if (parseStatus === "pending")
    return <EmptyState icon="hourglass_top" title={t("Waiting for resume parsing")} body={t("Roles will be matched automatically once the resume has been parsed.")} />;
  if (parseStatus === "failed")
    return (
      <EmptyState
        icon="error_outline"
        title={t("Can't match roles yet")}
        body={t("The resume couldn't be parsed, so there is no profile to match against. Parse it again first.")}
        actions={
          <Button variant="primary" icon="refresh" onClick={onReparse}>
            {t("Parse again")}
          </Button>
        }
      />
    );
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
            {/* The backend's reason is an English sentence; it reads in the interface language (#184). */}
            {jd.reason ? t(jd.reason) : t("No open role in the current job set matches this profile yet.")}
            <br />
            <span className="tiny">
              {t("Current search scope:")} {openRoles} {t("open roles")} · {t("last checked")} {relTime(jd.lastRunAt, state.lang)}
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
  // Only a monthly figure can prefill the monthly fields; yearly ones start empty (left empty = unchanged).
  const comp = candidate.compensationExpectation?.period === "month" ? candidate.compensationExpectation : null;
  const [name, setName] = useState(candidate.displayName);
  const [email, setEmail] = useState(candidate.contact.email);
  const [phone, setPhone] = useState(candidate.contact.phone);
  const [location, setLocation] = useState(candidate.contact.location.value);
  const [currency, setCurrency] = useState<CompensationCurrency>(
    COMPENSATION_CURRENCIES.find((c) => c === comp?.currency) ?? "CNY",
  );
  const [min, setMin] = useState(comp?.min != null ? String(comp.min) : "");
  const [max, setMax] = useState(comp?.max != null ? String(comp.max) : "");
  const [projects, setProjects] = useState((candidate.projects ?? []).map((p) => p.description));
  const [reasonType, setReasonType] = useState<CorrectionReasonType | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  // Which fields this correction changes, by the same names the backend uses (#158).
  const changedFields = [
    ...(name.trim() !== candidate.displayName ? ["display_name"] : []),
    ...(email.trim() !== candidate.contact.email ? ["email"] : []),
    ...(phone.trim() !== candidate.contact.phone ? ["phone"] : []),
    ...(location.trim() && location.trim() !== candidate.contact.location.value ? ["location"] : []),
    ...(min.trim() && max.trim() && (Number(min) !== comp?.min || Number(max) !== comp?.max || currency !== comp?.currency) ? ["compensation_expectation"] : []),
    ...(projects.some((d, i) => d !== candidate.projects?.[i]?.description) ? ["projects"] : []),
  ];
  // COR-1: a reason is needed only when the change touches what a current recommendation or evaluation used.
  const reasonRequired = changedFields.some((field) => candidate.correctionReasonRequiredFor?.includes(field));
  const amount = (v: string) => (v.trim() && !/^\d+$/.test(v.trim()) ? t("Enter a whole number, e.g. 30000.") : null);
  const fields = useFieldValidation({
    name: () => (!name.trim() ? t("Name can't be empty.") : null),
    email: () => (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? t("Enter a valid email address.") : null),
    phone: () => (phone.trim() && !/^\+?[\d\s()-]{5,40}$/.test(phone.trim()) ? t("Enter a valid phone number.") : null),
    min: () => amount(min) ?? (!min.trim() && max.trim() ? t("Enter both the minimum and the maximum.") : null),
    max: () =>
      amount(max) ??
      (min.trim() && !max.trim() ? t("Enter both the minimum and the maximum.") : null) ??
      (min.trim() && max.trim() && Number(max) < Number(min) ? t("The maximum can't be lower than the minimum.") : null),
    reasonType: () =>
      reasonRequired && !reasonType ? t("Choose a reason — this field is used by a current recommendation or evaluation.") : null,
    reason: () => (reasonType === "other" && !reason.trim() ? t("Describe the reason when choosing “Other”.") : null),
  });

  const save = async () => {
    if (!fields.validateAll()) return;
    setSaving(true);
    try {
      await correctProfile(candidate.id, {
        displayName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim() || undefined,
        ...(min.trim() && max.trim()
          ? { compensationMin: parseInt(min, 10), compensationMax: parseInt(max, 10), compensationCurrency: currency }
          : {}),
        ...(changedFields.includes("projects")
          ? { projects: projects.map((description, index) => ({ index, description: description.trim() })) }
          : {}),
        ...(reasonType ? { reasonType } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
    } catch (error) {
      const code = error instanceof ApiError ? error.code : "";
      say(code === "NO_CHANGES" ? t("Nothing was changed.") : t("Couldn't save the correction. Check the fields and try again."), { type: "error" });
      setSaving(false);
      return;
    }
    onClose();
    say(reasonRequired ? t("Profile corrected — affected screenings marked stale for refresh") : t("Profile corrected"), { type: "success" });
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
          <Button variant="primary" onClick={save} disabled={saving}>
            {t("Save correction")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 12 }}>
        {t("Corrections create a new profile snapshot and are logged with a reason. They don’t rewrite the original source material.")}
      </p>
      <div className="field">
        <label htmlFor={fields.labelFor("name")}>{t("Name")}</label>
        <input type="text" {...fields.field("name")} value={name} onChange={(e) => setName(e.target.value)} />
        {fields.error("name")}
      </div>
      <div className="flex gap-16">
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={fields.labelFor("email")}>{t("Email")}</label>
          <input type="email" {...fields.field("email", { required: false })} value={email} onChange={(e) => setEmail(e.target.value)} />
          {fields.error("email")}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={fields.labelFor("phone")}>{t("Phone")}</label>
          <input type="tel" {...fields.field("phone", { required: false })} value={phone} onChange={(e) => setPhone(e.target.value)} />
          {fields.error("phone")}
        </div>
      </div>
      <div className="field">
        <label>{t("Location")}</label>
        <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
      <div className="flex gap-16">
        <div className="field" style={{ width: 120 }}>
          <label>{t("Currency")}</label>
          <select value={currency} onChange={(e) => setCurrency(e.target.value as CompensationCurrency)}>
            {COMPENSATION_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {t(c, `currency.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={fields.labelFor("min")}>{t("Monthly salary expectation — min")}</label>
          <input type="text" inputMode="numeric" {...fields.field("min", { required: false })} value={min} onChange={(e) => setMin(e.target.value)} placeholder={t("e.g. %s").replace("%s", "30000")} />
          {fields.error("min")}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor={fields.labelFor("max")}>{t("Monthly salary expectation — max")}</label>
          <input type="text" inputMode="numeric" {...fields.field("max", { required: false })} value={max} onChange={(e) => setMax(e.target.value)} placeholder={t("e.g. %s").replace("%s", "40000")} />
          {fields.error("max")}
        </div>
      </div>
      {(candidate.projects ?? []).length > 0 && (
        <div className="field">
          <label>{t("Project descriptions")}</label>
          {(candidate.projects ?? []).map((project, index) => (
            <div key={index} style={{ marginBottom: 8 }}>
              <div className="tiny" style={{ marginBottom: 4 }}>{project.name || t("Project %s").replace("%s", String(index + 1))}</div>
              <textarea
                rows={2}
                aria-label={t("Description of %s").replace("%s", project.name || String(index + 1))}
                value={projects[index] ?? ""}
                onChange={(e) => setProjects((current) => current.map((d, i) => (i === index ? e.target.value : d)))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="field">
        <label htmlFor={fields.labelFor("reasonType")}>
          {t("Reason for correction")}
          {reasonRequired && <span className="required-mark">*</span>}
        </label>
        <select {...fields.field("reasonType", { required: reasonRequired })} value={reasonType} onChange={(e) => setReasonType(e.target.value as CorrectionReasonType | "")}>
          <option value="">{reasonRequired ? t("Choose a reason") : t("No reason given")}</option>
          {CORRECTION_REASON_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(CORRECTION_REASON_LABEL[type])}
            </option>
          ))}
        </select>
        {fields.error("reasonType")}
        <p className="tiny" style={{ marginTop: 4 }}>
          {reasonRequired
            ? t("Required: this change touches a field a current recommendation or evaluation used.")
            : t("Optional: nothing current relies on the fields you changed.")}
        </p>
      </div>
      <div className="field">
        <label htmlFor={fields.labelFor("reason")}>
          {t("Note")}
          {reasonType === "other" && <span className="required-mark">*</span>}
        </label>
        <input
          type="text"
          {...fields.field("reason", { required: reasonType === "other" })}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t("e.g. Candidate confirmed by email")}
        />
        {fields.error("reason")}
      </div>
    </Modal>
  );
}

/** English labels for the profile fields the parser reports as missing (zh via `missingField.*`). */
const MISSING_FIELD_LABELS: Record<string, string> = {
  location: "Location",
  employment_history: "Work experience",
  education: "Education",
  compensation_expectation: "Salary expectation",
};

export function CandidateProfilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { t, state, say } = useStore();
  const [detail, setDetail] = useState<CandidateDetail | null | undefined>(undefined);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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
  // without a manual refresh. Past 90 s the page says so instead of going quiet (#23).
  const matchPoll = useBoundedPolling(!!detail?.jobDiscovery.isMatching, load, MATCH_POLL_INTERVAL_MS);

  // The profile fields stay blank until the resume parse finishes (it runs in the
  // background and retries on transient AI failures) -- poll so they fill in by themselves.
  const parseStatus = detail ? latestParseStatus(detail.resumeVersions) : undefined;
  const parsePoll = useBoundedPolling(parseStatus === "pending", load, PARSE_POLL_INTERVAL_MS);
  const [reparsing, setReparsing] = useState(false);

  if (detail === undefined) return <PageSkeleton />;
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
  const versions = [...resumeVersions].sort((a, b) => b.version - a.version);
  const owner = getPerson(candidate.owner);
  const relationshipEntries: { key: string; jobTitle: string; team: string; status: React.ReactNode; when: string; route: string; action: React.ReactNode }[] = [
    ...applications.map((a) => {
      const job = getJob(a.jobId);
      const route = `/applications/${a.id}`;
      return {
        key: a.id,
        jobTitle: job?.title || "—",
        team: job ? [job.team, job.location].filter(Boolean).join(" · ") : "—",
        status: <span className="badge badge-success">{t("Linked")}</span>,
        when: `${fmtDate(a.linkedAt, state.lang)} ${t("by")} ${getPerson(a.linkedBy)?.name}`,
        route,
        action: (
          <Link className="btn btn-sm btn-secondary" to={route}>
            {t("Open screening")}
          </Link>
        ),
      };
    }),
    ...recommendations
      .filter((r) => r.status !== "confirmed")
      .map((r) => {
        const job = getJob(r.jobId);
        // Straight to this job's card, so two same-named roles in different cities can't be mixed up (#185).
        const route = `/candidates/${candidate.id}/jobs#rec-${r.id}`;
        const status = recommendationStatus(r);
        const statusBadge = (
          <span className={`badge ${status.tone}`} title={staleReason(r) ? t(staleReason(r)!) : undefined} data-testid="rec-status">
            {t(r.status === "proposed" ? "Pending recommendation" : status.label)}
          </span>
        );
        return {
          key: r.id,
          jobTitle: job?.title || "—",
          team: job ? [job.team, job.location].filter(Boolean).join(" · ") : "—",
          status: (
            <>
              {statusBadge}
              {r.eligibility === "not_eligible" && r.status !== "stale" && <span className="badge badge-danger"> {t("Not eligible")}</span>}
              {job && job.status !== "open" && <span className="badge badge-warning"> {t("Role closed")}</span>}
            </>
          ),
          when: `${t("Proposed")} ${relTime(r.createdAt, state.lang)}`,
          route,
          action: (
            <Link className="btn btn-sm btn-secondary" to={route}>
              {t("Review", "Review (action)")}
            </Link>
          ),
        };
      }),
  ];

  const handleReparse = async () => {
    setReparsing(true);
    try {
      await reparseCandidate(candidate.id);
    } catch {
      say(t("Could not restart resume parsing."), { type: "error" });
    }
    setReparsing(false);
    load();
  };

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
        back="/library"
        actions={
          <>
            <Button variant="secondary" icon="history" onClick={() => setShowHistory(true)}>
              {candidate.profileVersion ? `${t("Profile history")} · v${candidate.profileVersion}` : t("Profile history")}
            </Button>
            <Button variant="secondary" icon="edit" onClick={() => setShowCorrect(true)}>
              {t("Correct profile")}
            </Button>
            <Button variant="secondary" icon="travel_explore" onClick={handleMatchAgain} disabled={matching || jd.isMatching || parseStatus === "pending" || parseStatus === "failed"}>
              {jd.isMatching ? t("Matching…") : t("Match again")}
            </Button>
          </>
        }
      />

      {(parseStatus === "pending" || parseStatus === "failed") && (
        <div className="card card-pad flex items-center justify-between gap-12 flex-wrap" style={{ marginBottom: 16 }}>
          <div className="flex items-center gap-8">
            <span className={`badge ${parseStatus === "failed" ? "badge-warning" : "badge-info"}`}>
              {parseStatus === "failed" ? t("Resume parsing failed") : t("Parsing resume…")}
            </span>
            <span className="tiny">
              {parseStatus === "failed"
                ? t("Profile details could not be extracted from this resume. Try parsing it again.")
                : t("Profile details will appear here once the resume has been parsed.")}
            </span>
          </div>
          {parseStatus === "failed" && (
            <Button variant="secondary" size="sm" icon="refresh" onClick={handleReparse} disabled={reparsing}>
              {t("Parse again")}
            </Button>
          )}
        </div>
      )}

      {(matchPoll.overdue || parsePoll.overdue) && (
        <StillProcessingNotice
          style={{ marginBottom: 16 }}
          onRetry={() => {
            matchPoll.retry();
            parsePoll.retry();
          }}
        />
      )}

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
                  <li key={f}>{t(MISSING_FIELD_LABELS[f] ?? f.replace(/_/g, " "), `missingField.${f}`)}</li>
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
                      {t(sourceLabel(v.source))} · {fmtDate(v.uploadedAt, state.lang)}
                      {v.changeNote ? ` · ${v.changeNote}` : ""}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="tiny">{t("No resume file — structured entry only.")}</p>
            )}
            {(detail.sources?.length ?? 0) > 0 && (
              <div style={{ marginTop: 12 }} data-testid="source-records">
                <div className="tiny muted" style={{ marginBottom: 4 }}>
                  {t("Source records")}
                </div>
                {detail.sources!.map((source) => (
                  <div className="tiny" key={source.id}>
                    {t(sourceLabel(source.channel))} · {fmtDateTime(source.receivedAt, state.lang)}
                  </div>
                ))}
              </div>
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
                    <th>{t("Team · location")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("When")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {relationshipEntries.map((row) => (
                    <tr key={row.key} className="clickable" onClick={() => navigate(row.route)}>
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
              <NoJobState
                candidate={candidate}
                jd={jd}
                parseStatus={parseStatus}
                onMatchAgain={handleMatchAgain}
                onCorrect={() => setShowCorrect(true)}
                onReparse={handleReparse}
              />
            )}
          </div>

          {parseStatus === "succeeded" && candidate.profileFields && <ParsedFieldsCard fields={candidate.profileFields} />}

          <div className="card card-pad">
            <div className="section-title">{t("Employment history")}</div>
            {candidate.totalExperience && (
              <div className="tiny" style={{ marginBottom: 12 }} data-testid="total-experience">
                {candidate.totalExperience.status === "derived" ? (
                  <>
                    {t("Total experience")}: <strong>{t("%s years").replace("%s", String(candidate.totalExperience.years))}</strong>{" "}
                    <span className="badge badge-outline" title={t("Worked out from the start and end dates above; overlapping months are counted once.")}>
                      {t("Derived")}
                    </span>
                  </>
                ) : (
                  <>
                    {t("Total experience")}: {t("Can't be calculated — the résumé gives no usable start and end dates.")}
                  </>
                )}
              </div>
            )}
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

      {showHistory && (
        <ProfileHistoryModal
          candidateId={candidate.id}
          materialByResumeVersion={Object.fromEntries(versions.flatMap((v) => (v.materialId ? [[v.id, { materialId: v.materialId, fileName: v.fileName }]] : [])))}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showCorrect && <CorrectProfileModal candidate={candidate} onClose={() => setShowCorrect(false)} onSaved={load} />}
    </>
  );
}
