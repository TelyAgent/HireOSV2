import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { confirmJobCriteria, getJobDetail, reopenJobCriteriaForEdit, updateJobCriteria } from "../data/api/jobs";
import { DIMENSION_POOL } from "../data/fixtures/jobs";
import type { Dimension, Job, Requirement } from "../data/fixtures/jobs";
import { uid } from "../lib/daysAgo";
import { fmtMoney, pct } from "../lib/format";
import { computeAggregate, round2 } from "../lib/scoring";
import { Badge, Button, EmptyState, PageHeader, scoreDisplay } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { ConfirmDialog } from "../components/ui/Overlays";

function JobStatusBadge({ status }: { status: Job["status"] }) {
  const { t } = useStore();
  if (status === "draft") return <Badge tone="warning">{t("Draft")}</Badge>;
  if (status === "open") return <Badge tone="success">{t("Open", "Open (job status)")}</Badge>;
  if (status === "closed") return <Badge tone="outline">{t("Closed")}</Badge>;
  return <Badge tone="warning">{t("Paused")}</Badge>;
}

function ScoringMethodologyNote() {
  const { t } = useStore();
  const ex1 = computeAggregate([
    { weight: 0.5, status: "evaluated", score: 80 },
    { weight: 0.3, status: "evaluated", score: 60 },
    { weight: 0.2, status: "unknown", score: null },
  ]);
  const ex2 = computeAggregate([
    { weight: 0.5, status: "evaluated", score: 80 },
    { weight: 0.3, status: "unknown", score: null },
    { weight: 0.2, status: "unknown", score: null },
  ]);
  return (
    <details>
      <summary style={{ cursor: "pointer", fontSize: "var(--fs-sm)", color: "var(--accent-600)", fontWeight: 500 }}>
        {t("How overall score and coverage are calculated")}
      </summary>
      <div style={{ fontSize: "var(--fs-sm)", marginTop: 10, lineHeight: 1.6 }}>
        <p>
          {t(
            "Overall is the weighted average of {i}evaluated{/i} dimensions only. Coverage is the share of applicable weight that was actually evaluated. Below the coverage threshold (default 70%), overall is left blank rather than guessed.",
          )
            .replace("{i}", "")
            .replace("{/i}", "")}
        </p>
        <p className="mono tiny" style={{ background: "var(--surface-alt)", padding: "8px 10px", borderRadius: 6 }}>
          {t("Example — weights 0.5 / 0.3 / 0.2, scores 80 / 60 / Unknown → coverage {c}, overall {o} (displayed {d})")
            .replace("{c}", pct(ex1.coverage))
            .replace("{o}", String(ex1.overall))
            .replace("{d}", String(scoreDisplay(ex1.overall)))}
        </p>
        <p className="mono tiny" style={{ background: "var(--surface-alt)", padding: "8px 10px", borderRadius: 6 }}>
          {t("Example — only the first dimension evaluated → coverage {c}, overall is blank (insufficient evidence)").replace("{c}", pct(ex2.coverage))}
        </p>
        <p className="tiny">
          {t(
            "This is a sample scoring policy for the prototype, not a measurement of real model quality. A hard requirement left unknown still shows “Needs verification” even when overall looks high.",
          )}
        </p>
      </div>
    </details>
  );
}

export function JobCriteriaPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [touched, setTouched] = useState(false);
  const [confirmStep, setConfirmStep] = useState<"none" | "touched-warning" | "confirm-version" | "reopen">("none");

  const load = useCallback(() => {
    getJobDetail(id)
      .then((j) => {
        setJob(j);
        setRequirements(j.requirements);
        setDimensions(j.dimensions);
        setTouched(false);
      })
      .catch(() => setJob(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (job === undefined) return null;
  if (job === null) return <EmptyState icon="work_off" title={t("Job not found")} />;

  const editable = job.criteriaStatus !== "confirmed";
  const weightSum = dimensions.reduce((s, d) => s + d.weight, 0);
  const weightOk = Math.abs(weightSum - 1) < 0.001;
  const countOk = dimensions.length >= 3 && dimensions.length <= 8;
  const reqsOk = requirements.every((r) => r.label.trim());
  const canConfirm = weightOk && countOk && reqsOk;
  const usedNames = new Set(dimensions.map((d) => d.name));
  const remainingPool = DIMENSION_POOL.filter((n) => !usedNames.has(n));

  const persist = (nextReq: Requirement[], nextDims: Dimension[]) => {
    setTouched(true);
    void updateJobCriteria(job.id, { requirements: nextReq, dimensions: nextDims });
  };

  const addRequirement = () => {
    const next = [...requirements, { id: uid("req"), label: "", dimension: dimensions[0]?.id || "", priority: "must_have" as const, hard: true, kind: "other" as const }];
    setRequirements(next);
    persist(next, dimensions);
  };
  const removeRequirement = (reqId: string) => {
    const next = requirements.filter((r) => r.id !== reqId);
    setRequirements(next);
    persist(next, dimensions);
  };
  const updateRequirement = (reqId: string, patch: Partial<Requirement>) => {
    const next = requirements.map((r) => (r.id === reqId ? { ...r, ...patch } : r));
    setRequirements(next);
    persist(next, dimensions);
  };
  const addDimension = (name: string) => {
    if (!name || dimensions.length >= 8 || dimensions.some((d) => d.name === name)) return;
    const next = [...dimensions, { id: uid("dim"), name, weight: 0, rubric: t("Describe how this dimension should be evaluated for this role.") }];
    setDimensions(next);
    persist(requirements, next);
  };
  const removeDimension = (dimId: string) => {
    if (dimensions.length <= 3) {
      say(t("A role needs at least 3 scoring dimensions"), { type: "error" });
      return;
    }
    const next = dimensions.filter((d) => d.id !== dimId);
    setDimensions(next);
    persist(requirements, next);
  };
  const updateDimensionWeight = (dimId: string, pctValue: string) => {
    const v = parseFloat(pctValue);
    const next = dimensions.map((d) => (d.id === dimId ? { ...d, weight: isNaN(v) ? 0 : Math.max(0, v) / 100 } : d));
    setDimensions(next);
    persist(requirements, next);
  };
  const updateDimensionRubric = (dimId: string, text: string) => {
    const next = dimensions.map((d) => (d.id === dimId ? { ...d, rubric: text } : d));
    setDimensions(next);
    persist(requirements, next);
  };
  const distributeEvenly = () => {
    const n = dimensions.length;
    if (!n) return;
    const even = Math.floor((1 / n) * 1000) / 1000;
    const next = dimensions.map((d, i) => ({ ...d, weight: i === n - 1 ? round2(1 - even * (n - 1)) : even }));
    setDimensions(next);
    persist(requirements, next);
    say(t("Weights distributed evenly"));
  };

  const doConfirm = async () => {
    await updateJobCriteria(job.id, { requirements, dimensions });
    const updated = await confirmJobCriteria(job.id, state.currentUser);
    setJob(updated);
    setConfirmStep("none");
    say(t("Requirements confirmed"), { type: "success" });
  };

  const handleConfirmClick = () => {
    if (!canConfirm) return;
    const wasFirstConfirm = !job.criteriaVersion || job.criteriaVersion === 0;
    if (wasFirstConfirm && !touched) setConfirmStep("touched-warning");
    else setConfirmStep("confirm-version");
  };

  const doReopen = async () => {
    const updated = await reopenJobCriteriaForEdit(job.id);
    setJob(updated);
    setRequirements(updated.requirements);
    setDimensions(updated.dimensions);
    setConfirmStep("none");
    say(t("Draft opened — edit and confirm to publish a new version"));
  };

  return (
    <>
      <PageHeader
        title={job.title}
        subtitle={
          <>
            {job.team} · {job.location} · <JobStatusBadge status={job.status} />
          </>
        }
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title }]}
        actions={
          <>
            {job.criteriaStatus === "confirmed" ? (
              <>
                <span className="badge badge-success" style={{ padding: "7px 14px" }}>
                  {t("Confirmed")} v{job.criteriaVersion}
                </span>
                <Button variant="secondary" onClick={() => setConfirmStep("reopen")}>
                  {t("Edit as new version")}
                </Button>
              </>
            ) : (
              <Button variant="primary" disabled={!canConfirm} onClick={handleConfirmClick}>
                {t("Confirm this version")}
              </Button>
            )}
            <Link className="btn btn-secondary" to={`/jobs/${job.id}/screening`}>
              {t("Open screening workspace")}
            </Link>
          </>
        }
      />

      {editable && !touched && (
        <div className="card card-pad" style={{ marginBottom: 16, background: "var(--warning-bg)", borderColor: "var(--warning-border)" }}>
          <div className="flex items-center gap-8">
            <Icon name="info" style={{ color: "var(--warning-text)" }} />
            <p style={{ fontSize: "var(--fs-sm)", margin: 0, color: "var(--warning-text)" }}>
              {t("These are the system's neutral default dimensions — they have not been adjusted for this role yet. Review and edit before confirming.")}
            </p>
          </div>
        </div>
      )}

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="section-title">{t("Compensation range")}</div>
        <p style={{ fontSize: "var(--fs-sm)" }}>{job.compRange ? fmtMoney(job.compRange, state.lang) : t("Not set")}</p>
      </div>

      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="flex items-center justify-between">
          <div className="section-title" style={{ margin: 0 }}>
            {t("Requirements")}
          </div>
          {editable && (
            <Button variant="secondary" size="sm" icon="add" onClick={addRequirement}>
              Add requirement
            </Button>
          )}
        </div>
        {requirements.length === 0 ? (
          <p className="tiny">{t("No requirements defined yet.")}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Requirement")}</th>
                <th>{t("Priority")}</th>
                <th>{t("Hard constraint")}</th>
                <th>{t("Scored dimension")}</th>
                {editable && <th></th>}
              </tr>
            </thead>
            <tbody>
              {requirements.map((r) =>
                editable ? (
                  <tr key={r.id}>
                    <td>
                      <input type="text" value={r.label} placeholder="e.g. 5+ years relevant experience" style={{ width: "100%" }} onChange={(e) => updateRequirement(r.id, { label: e.target.value })} />
                    </td>
                    <td>
                      <select value={r.priority} onChange={(e) => updateRequirement(r.id, { priority: e.target.value as Requirement["priority"] })}>
                        <option value="must_have">{t("Must-have")}</option>
                        <option value="nice_to_have">{t("Nice-to-have")}</option>
                      </select>
                    </td>
                    <td>
                      <input type="checkbox" checked={r.hard} onChange={(e) => updateRequirement(r.id, { hard: e.target.checked })} />
                    </td>
                    <td>
                      <select value={r.dimension} onChange={(e) => updateRequirement(r.id, { dimension: e.target.value })}>
                        {dimensions.map((d) => (
                          <option value={d.id} key={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      <button className="btn-icon" onClick={() => removeRequirement(r.id)}>
                        <Icon name="delete" size={16} />
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{r.label}</td>
                    <td>{r.priority === "must_have" ? <Badge tone="warning">{t("Must-have")}</Badge> : <Badge tone="outline">{t("Nice-to-have")}</Badge>}</td>
                    <td>{r.hard ? <Badge tone="danger">{t("Hard")}</Badge> : <span className="tiny muted">{t("No")}</span>}</td>
                    <td className="tiny">{dimensions.find((d) => d.id === r.dimension)?.name || "—"}</td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="card card-pad">
        <div className="flex items-center justify-between">
          <div className="section-title" style={{ margin: 0 }}>
            {t("Scoring dimensions")}
          </div>
          <span className={weightOk ? "tiny muted" : "tiny error-inline"} style={weightOk ? undefined : { display: "inline-flex", padding: "2px 8px" }}>
            {t("Weights total")} {Math.round(weightSum * 100)}%
          </span>
        </div>

        {dimensions.length === 0 ? (
          <p className="tiny">{t("No scoring dimensions defined yet.")}</p>
        ) : (
          dimensions.map((d) =>
            editable ? (
              <div className="list-row" style={{ padding: "10px 2px", alignItems: "flex-start" }} key={d.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{d.name}</div>
                  <input type="text" value={d.rubric} style={{ width: "100%", marginTop: 4 }} onChange={(e) => updateDimensionRubric(d.id, e.target.value)} />
                </div>
                <div style={{ width: 80 }}>
                  <input type="number" min={0} max={100} value={Math.round(d.weight * 100)} style={{ width: 64, textAlign: "right" }} onChange={(e) => updateDimensionWeight(d.id, e.target.value)} /> %
                </div>
                <div style={{ width: 28, textAlign: "right" }}>
                  <button className="btn-icon" disabled={dimensions.length <= 3} onClick={() => removeDimension(d.id)}>
                    <Icon name="delete" size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="list-row" style={{ padding: "10px 2px" }} key={d.id}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{d.name}</div>
                  <div className="tiny">{d.rubric}</div>
                </div>
                <div style={{ width: 110 }}>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.round(d.weight * 100)}%` }} />
                  </div>
                </div>
                <div style={{ width: 44, textAlign: "right", fontSize: "var(--fs-sm)", fontWeight: 600 }}>{Math.round(d.weight * 100)}%</div>
              </div>
            ),
          )
        )}

        {editable && (
          <div className="flex items-center gap-8" style={{ marginTop: 12 }}>
            <DimensionPicker options={remainingPool} onAdd={addDimension} disabled={dimensions.length >= 8} />
            <Button variant="secondary" size="sm" onClick={distributeEvenly}>
              {t("Distribute evenly")}
            </Button>
          </div>
        )}
        {!countOk && <p className="tiny error-inline" style={{ marginTop: 8 }}>A role needs between 3 and 8 scoring dimensions.</p>}
        <div className="divider" />
        <ScoringMethodologyNote />
      </div>

      {confirmStep === "touched-warning" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmStep("none")}
          title="Scoring dimensions are still the default starting point"
          body="These dimensions and weights have not been adjusted for this role yet — they're the system's neutral default, not a reviewed rubric. Confirm anyway?"
          confirmLabel="Confirm anyway"
          danger
          onConfirm={() => setConfirmStep("confirm-version")}
        />
      )}
      {confirmStep === "confirm-version" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmStep("none")}
          title={t("Confirm this requirements version")}
          body={t("Confirming locks these requirements and weights as the active scoring baseline for this job. Screening can only run against a confirmed version.")}
          confirmLabel={t("Confirm version")}
          onConfirm={doConfirm}
        />
      )}
      {confirmStep === "reopen" && (
        <ConfirmDialog
          open
          onClose={() => setConfirmStep("none")}
          title="Edit as new version"
          body="This opens a new draft based on the currently confirmed requirements. The confirmed version stays in effect for existing evaluations until the new draft is confirmed."
          confirmLabel="Start new draft"
          onConfirm={doReopen}
        />
      )}
    </>
  );
}

function DimensionPicker({ options, onAdd, disabled }: { options: string[]; onAdd: (name: string) => void; disabled: boolean }) {
  const { t } = useStore();
  const [value, setValue] = useState(options[0] || "");
  useEffect(() => {
    if (!options.includes(value)) setValue(options[0] || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join("|")]);
  return (
    <div className="flex items-center gap-8">
      <select value={value} onChange={(e) => setValue(e.target.value)} disabled={options.length === 0}>
        {options.length ? options.map((n) => <option value={n} key={n}>{n}</option>) : <option>All pool dimensions in use</option>}
      </select>
      <Button variant="secondary" size="sm" icon="add" disabled={disabled || !options.length} onClick={() => onAdd(value)}>
        {t("Add dimension")}
      </Button>
    </div>
  );
}
