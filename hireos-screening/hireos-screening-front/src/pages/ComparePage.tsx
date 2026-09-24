import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  addAnnotation,
  addCandidateToComparison,
  exportComparison,
  getComparison,
  refreshComparison,
} from "../data/api/comparisons";
import { recordDecision, type NextStepTarget } from "../data/api/decisions";
import { db, getApplication, getApplicationsForJob, getCandidate, getConcerns, getEvaluation, getJob } from "../data/db";
import type { ComparisonSet } from "../data/fixtures/comparisons";
import type { Application } from "../data/fixtures/applications";
import type { Candidate } from "../data/fixtures/candidates";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { Job, Dimension } from "../data/fixtures/jobs";
import type { DecisionOutcome } from "../data/fixtures/decisions";
import { fmtDate, fmtMoney, relTime } from "../lib/format";
import { Badge, Button, CandidateAvatar, EligibilityBadge, EmptyState, FreshnessBadge, PageHeader, PillTabs, ScoreRing } from "../components/ui/Primitives";
import { EvidenceCard } from "../components/ui/EvidenceCard";
import { Icon } from "../components/ui/Icons";
import { Drawer, Modal } from "../components/ui/Overlays";

type CompareMode = "same_stage" | "current_summary" | "round_changes";

interface Member {
  app: Application;
  cand: Candidate;
  ev: Evaluation | undefined;
}

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

/* ---------------------------------------------------------------
   Key differences / round changes narrative
   --------------------------------------------------------------- */
function computeKeyDifferences(job: Job, members: Member[], lang: "en" | "zh"): string[] {
  const diffs: string[] = [];
  for (const d of job.dimensions) {
    const vals = members
      .map((m) => {
        const ds = m.ev?.dimensionScores.find((x) => x.id === d.id);
        return { cand: m.cand, score: ds && ds.status === "evaluated" ? ds.score : null };
      })
      .filter((v): v is { cand: Candidate; score: number } => v.score != null);
    if (vals.length < 2) continue;
    const max = vals.reduce((a, b) => (b.score > a.score ? b : a));
    const min = vals.reduce((a, b) => (b.score < a.score ? b : a));
    if (max.score - min.score >= 15) {
      diffs.push(
        lang === "zh"
          ? `在「${d.name}」维度上，${max.cand.displayName} 的证据更强（${max.score}），高于 ${min.cand.displayName}（${min.score}）。如果该维度对本职位最重要，这会更有利于 ${max.cand.displayName} —— 但在将其视为决定性因素前，请先查看关联证据。`
          : `On ${d.name}, ${max.cand.displayName} shows stronger evidence (${max.score}) than ${min.cand.displayName} (${min.score}). If this dimension matters most for the role, that favors ${max.cand.displayName} — but confirm via the linked evidence before treating it as decisive.`,
      );
    }
  }
  const insufficient = members.filter((m) => m.ev?.evaluationStatus === "insufficient_evidence");
  if (insufficient.length) {
    const names = insufficient.map((m) => m.cand.displayName).join(", ");
    diffs.push(
      lang === "zh"
        ? `${names} 的总分证据不足 —— 这反映的是覆盖率问题，而非低分。`
        : `${names} ${insufficient.length > 1 ? "have" : "has"} insufficient evidence for an overall score — this reflects coverage, not a low score.`,
    );
  }
  const notEvaluated = members.filter((m) => {
    const a = db.assessments[m.app.id];
    return !a || a.status !== "completed";
  });
  if (notEvaluated.length) {
    const names = notEvaluated.map((m) => m.cand.displayName).join(", ");
    diffs.push(
      lang === "zh"
        ? `${names} 尚未完成技术测评 —— 这是"未评估"，不代表能力较弱。`
        : `${names} ${notEvaluated.length > 1 ? "have" : "has"} not yet taken the technical assessment — this is "not evaluated," not evidence of lower ability.`,
    );
  }
  if (!diffs.length) {
    diffs.push(
      lang === "zh"
        ? "根据现有证据，没有明显的总体领先者 —— 差异处于该阶段的正常范围内。"
        : "No clear overall leader based on current evidence — differences are within a normal range for this stage.",
    );
  }
  return diffs;
}

function KeyDifferences({ job, members }: { job: Job; members: Member[] }) {
  const { t, state } = useStore();
  const diffs = computeKeyDifferences(job, members, state.lang);
  return (
    <div className="card card-pad" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>
      <div className="flex items-center gap-8" style={{ color: "var(--info-text)", fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: 8 }}>
        <Icon name="insights" size={18} />
        {t("Key differences")}
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
        {diffs.map((d, i) => (
          <li key={i} style={{ marginBottom: 6 }}>
            {d}
          </li>
        ))}
      </ul>
      <p className="tiny" style={{ marginTop: 8 }}>
        {t("Generated for this comparison snapshot — phrased conditionally, not as a forced ranking. Not a hiring recommendation.")}
      </p>
    </div>
  );
}

function RoundChanges({ cmp }: { cmp: ComparisonSet }) {
  const { t } = useStore();
  const snap = cmp.snapshots[cmp.snapshots.length - 1];
  return (
    <div className="card card-pad" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>
      <div className="flex items-center gap-8" style={{ color: "var(--info-text)", fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: 8 }}>
        <Icon name="history" size={18} />
        {t("Changes since last round")}
      </div>
      {snap.changesSinceLast?.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
          {snap.changesSinceLast.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      ) : (
        <p className="tiny">{t("This is the first snapshot for this comparison set.")}</p>
      )}
      {snap.note && (
        <p className="tiny" style={{ marginTop: 8 }}>
          {snap.note}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Evidence drawer for a matrix dimension cell
   --------------------------------------------------------------- */
function MatrixEvidenceDrawer({ member, dimension, onClose }: { member: Member; dimension: Dimension; onClose: () => void }) {
  const { t } = useStore();
  const ds = member.ev?.dimensionScores.find((x) => x.id === dimension.id);
  const items = ds ? [...ds.supporting.map((id) => ({ id, rel: "Supports" as const })), ...ds.counter.map((id) => ({ id, rel: "Contradicts" as const }))] : [];
  return (
    <Drawer open onClose={onClose} title={`${member.cand.displayName} — ${dimension.name}`}>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Requirement → rubric → rationale → evidence → source excerpt.")}
      </p>
      <div className="card card-pad" style={{ marginBottom: 14, background: "var(--surface-alt)" }}>
        <div className="tiny" style={{ fontWeight: 600 }}>
          {t("Rationale")}
        </div>
        <p style={{ fontSize: "var(--fs-sm)", margin: "4px 0 0" }}>{ds?.reason || ""}</p>
      </div>
      {items.length ? (
        items.map((it) => <EvidenceCard key={it.id} evidenceId={it.id} relationship={it.rel} />)
      ) : (
        <p className="tiny">{t("No linked evidence — Unknown is shown rather than a fabricated citation.")}</p>
      )}
    </Drawer>
  );
}

/* ---------------------------------------------------------------
   Comparison matrix
   --------------------------------------------------------------- */
function CompareMatrix({ job, members, diffOnly, onOpenEvidence }: { job: Job; members: Member[]; diffOnly: boolean; onOpenEvidence: (m: Member, d: Dimension) => void }) {
  const { t } = useStore();

  interface Row {
    label: string;
    dimId?: string;
    render: (m: Member) => React.ReactNode;
  }
  const rows: Row[] = [
    {
      label: t("Overall / Eligibility"),
      render: (m) => (
        <span className="flex items-center gap-8">
          <ScoreRing overall={m.ev?.overall} size="sm" />
          {m.ev ? <EligibilityBadge status={m.ev.eligibilityStatus} /> : "—"}
        </span>
      ),
    },
    ...job.dimensions.map((d) => ({
      label: d.name,
      dimId: d.id,
      render: (m: Member) => {
        const ds = m.ev?.dimensionScores.find((x) => x.id === d.id);
        if (!ds || ds.status !== "evaluated") {
          return <Badge tone="outline">{ds?.status === "not_evaluated" ? t("Not evaluated") : t("Unknown")}</Badge>;
        }
        return (
          <button className="link-btn" style={{ fontWeight: 600 }} onClick={() => onOpenEvidence(m, d)}>
            {ds.score}
          </button>
        );
      },
    })),
    {
      label: t("Technical assessment (same stage)"),
      render: (m) => {
        const a = db.assessments[m.app.id];
        if (!a || a.status !== "completed") return <Badge tone="outline">{t("Not evaluated")}</Badge>;
        return <Badge tone="success">{a.score}/100</Badge>;
      },
    },
    {
      label: t("Compensation & location"),
      render: (m) => {
        const c = m.cand.compensationExpectation;
        return c ? <span className="tiny">{fmtMoney(c, "en")}</span> : <Badge tone="outline">{t("Not provided")}</Badge>;
      },
    },
    {
      label: t("Evidence status"),
      render: (m) => {
        const open = getConcerns(m.app.id).filter((c) => c.status === "open").length;
        return open ? (
          <Badge tone="warning">
            {open} {t("open")}
          </Badge>
        ) : (
          <Badge tone="success">{t("Clear")}</Badge>
        );
      },
    },
  ];

  const filteredRows = diffOnly
    ? rows.filter((r, i) => {
        if (i === 0) return true;
        const vals = members.map((m) => JSON.stringify(r.render(m)));
        return new Set(vals).size > 1;
      })
    : rows;

  return (
    <table className="data-table" style={{ minWidth: 360 + members.length * 180 }}>
      <thead>
        <tr>
          <th style={{ position: "sticky", left: 0, background: "var(--surface)" }}>{t("Dimension")}</th>
          {members.map((m) => (
            <th key={m.app.id}>
              <span className="flex items-center gap-8">
                <CandidateAvatar id={m.cand.id} name={m.cand.displayName} size="sm" />
                {m.cand.displayName}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filteredRows.map((r) => (
          <tr key={r.label}>
            <td style={{ position: "sticky", left: 0, background: "var(--surface)", fontWeight: 500 }}>{r.label}</td>
            {members.map((m) => (
              <td key={m.app.id}>{r.render(m)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ---------------------------------------------------------------
   Modals
   --------------------------------------------------------------- */
function AddCandidateModal({ cmp, job, onClose, onAdded }: { cmp: ComparisonSet; job: Job; onClose: () => void; onAdded: () => void }) {
  const { t, say } = useStore();
  const others = getApplicationsForJob(job.id).filter((a) => !cmp.memberIds.includes(a.id));

  const add = async (appId: string) => {
    await addCandidateToComparison(cmp.id, appId);
    onClose();
    say(t("Added to comparison"), { type: "success" });
    onAdded();
  };

  return (
    <Modal open onClose={onClose} title={t("Add candidate to comparison")}>
      {others.length ? (
        others.map((a) => {
          const c = getCandidate(a.candidateId)!;
          return (
            <div className="radio-card" style={{ marginBottom: 8 }} key={a.id} onClick={() => add(a.id)}>
              <CandidateAvatar id={c.id} name={c.displayName} />
              <div style={{ fontWeight: 500 }}>{c.displayName}</div>
            </div>
          );
        })
      ) : (
        <p className="tiny">{t("Every linked candidate for this job is already in the comparison.")}</p>
      )}
    </Modal>
  );
}

function ExportModal({ cmp, members, onClose }: { cmp: ComparisonSet; members: Member[]; onClose: () => void }) {
  const { t, say } = useStore();
  const [format, setFormat] = useState<"png" | "pdf">("png");
  const [selected, setSelected] = useState<Set<string>>(new Set(members.slice(0, 4).map((m) => m.app.id)));
  const needsSubset = members.length > 4;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const run = async () => {
    const applicationIds = format === "png" ? Array.from(selected) : undefined;
    const result = await exportComparison(cmp.id, { format, applicationIds });
    if (format === "png" && result.exportedCount < members.length) {
      say(t("Exported one-page PNG for {n} selected candidates").replace("{n}", String(result.exportedCount)), { type: "success" });
    } else {
      say(t("Full comparison report exported (paginated)"), { type: "success" });
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Export comparison")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={run}>
            {t("Export")}
          </Button>
        </>
      }
    >
      <div className="field">
        <label>{t("Format")}</label>
        <div className="flex gap-8">
          <Button size="sm" variant={format === "png" ? "primary" : "secondary"} onClick={() => setFormat("png")}>
            {t("One-page PNG")}
          </Button>
          <Button size="sm" variant={format === "pdf" ? "primary" : "secondary"} onClick={() => setFormat("pdf")}>
            {t("Full report PDF")}
          </Button>
        </div>
      </div>
      {needsSubset && format === "png" && (
        <div className="field">
          <label>{t("{n} members — choose a subset for the one-page export, or use the full report for everyone").replace("{n}", String(members.length))}</label>
          {members.map((m) => (
            <label className="checkbox-row" style={{ marginBottom: 6 }} key={m.app.id}>
              <input type="checkbox" checked={selected.has(m.app.id)} onChange={() => toggle(m.app.id)} /> {m.cand.displayName}
            </label>
          ))}
        </div>
      )}
      <p className="tiny">{t("Export is scoped to your current permissions. Restricted evidence and contact details are excluded automatically.")}</p>
    </Modal>
  );
}

const NEXT_STEP_LABEL: Record<string, string> = {
  assessment: "Send Assessment",
  interview: "Move to Interview",
  request_information: "Request Information",
  hold: "Hold",
  do_not_advance: "Do Not Advance",
};
function mapNextStepToDecision(v: string): { outcome: DecisionOutcome; target: NextStepTarget } {
  if (v === "assessment") return { outcome: "advance", target: "send_assessment" };
  if (v === "interview") return { outcome: "advance", target: "move_to_interview" };
  if (v === "request_information") return { outcome: "request_information", target: "record_only" };
  if (v === "hold") return { outcome: "hold", target: "record_only" };
  return { outcome: "do_not_advance", target: "record_only" };
}

function SubmitNextStepsModal({
  entries,
  onClose,
  onSubmitted,
}: {
  entries: [string, string][];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t, state, say } = useStore();
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    let ok = 0;
    for (const [appId, v] of entries) {
      const { outcome, target } = mapNextStepToDecision(v);
      try {
        await recordDecision(appId, {
          outcome,
          nextStepTarget: target,
          reason: "Selected via candidate comparison.",
          decidedBy: state.currentUser,
        });
        ok++;
      } catch {
        // Each candidate is handled independently — one failure never blocks the others.
      }
    }
    setSubmitting(false);
    onClose();
    say(t("Submitted {n} next-step decision(s)").replace("{n}", String(ok)), { type: "success" });
    onSubmitted();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Confirm next steps")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit} disabled={submitting}>
            {t("Submit")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 10 }}>
        {t("Review the exact list before submitting. Each candidate is handled independently — a failure for one does not affect the others.")}
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("Candidate")}</th>
            <th>{t("Action")}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([appId, v]) => (
            <tr key={appId}>
              <td>{getCandidate(getApplication(appId)!.candidateId)!.displayName}</td>
              <td>{t(NEXT_STEP_LABEL[v])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}

/* ---------------------------------------------------------------
   Page
   --------------------------------------------------------------- */
export function ComparePage() {
  const { id = "" } = useParams();
  const { t, say } = useStore();
  const [cmp, setCmp] = useState<ComparisonSet | null | undefined>(undefined);
  const [mode, setMode] = useState<CompareMode>("current_summary");
  const [diffOnly, setDiffOnly] = useState(false);
  const [snapIdx, setSnapIdx] = useState(0);
  const [nextStepDraft, setNextStepDraft] = useState<Record<string, string>>({});
  const [evidenceTarget, setEvidenceTarget] = useState<{ member: Member; dimension: Dimension } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    getComparison(id)
      .then((c) => {
        setCmp(c);
        setSnapIdx(c.snapshots.length - 1);
      })
      .catch(() => setCmp(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (cmp === undefined) return null;
  if (cmp === null) return <EmptyState icon="compare_arrows" title={t("Comparison not found")} />;

  if (!cmp.snapshots.length) {
    return (
      <EmptyState
        icon="compare_arrows"
        title={t("No comparison data yet")}
        body={t("This comparison hasn't been generated. Create the first snapshot from the current screening evaluations.")}
        actions={
          <Button
            variant="primary"
            onClick={async () => {
              say(t("Generating comparison…"));
              await refreshComparison(cmp.id);
              load();
            }}
          >
            {t("Generate comparison")}
          </Button>
        }
      />
    );
  }

  const job = getJob(cmp.jobId)!;
  const members: Member[] = cmp.memberIds.map((appId) => {
    const app = getApplication(appId)!;
    return { app, cand: getCandidate(app.candidateId)!, ev: getEvaluation(appId) };
  });
  const snap = cmp.snapshots[snapIdx] ?? cmp.snapshots[cmp.snapshots.length - 1];

  const handleRefresh = async () => {
    say(t("Refreshing comparison with latest inputs…"));
    const snapshot = await refreshComparison(cmp.id);
    say(t("Comparison refreshed — new snapshot created, prior snapshots kept"), { type: "success" });
    load();
    setSnapIdx(cmp.snapshots.findIndex((s) => s.id === snapshot.id));
  };

  const handleAddAnnotation = async () => {
    const body = note.trim();
    if (!body) return;
    await addAnnotation(cmp.id, "", body, "emma");
    setNote("");
    load();
  };

  const entries = Object.entries(nextStepDraft).filter(([appId, v]) => v && cmp.memberIds.includes(appId) && !db.decisions[appId]);

  const applyAllNextStep = (value: string) => {
    if (!value) return;
    const next = { ...nextStepDraft };
    for (const appId of cmp.memberIds) {
      if (db.decisions[appId]) continue;
      next[appId] = value;
    }
    setNextStepDraft(next);
  };

  return (
    <>
      <PageHeader
        title={t("Compare candidates")}
        subtitle={`${job.title} · ${cmp.purpose}`}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: job.title, href: `/jobs/${job.id}/screening` }, { label: t("Compare") }]}
        actions={
          <>
            <Button variant="secondary" icon="person_add" onClick={() => setShowAdd(true)}>
              {t("Add candidate")}
            </Button>
            <Button variant="secondary" icon="refresh" onClick={handleRefresh}>
              {t("Refresh")}
            </Button>
            <Button variant="primary" icon="ios_share" onClick={() => setShowExport(true)}>
              {t("Export")}
            </Button>
          </>
        }
      />

      <div className="flex items-center justify-between flex-wrap gap-12" style={{ marginBottom: 16 }}>
        <PillTabs
          tabs={[
            { key: "same_stage", label: t("Same stage") },
            { key: "current_summary", label: t("Current summary") },
            { key: "round_changes", label: t("Changes since last round") },
          ]}
          active={mode}
          onChange={setMode}
        />
        <div className="flex items-center gap-12">
          <label className="checkbox-row">
            <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} /> {t("Show differences only")}
          </label>
          <select value={snapIdx} onChange={(e) => setSnapIdx(Number(e.target.value))}>
            {cmp.snapshots.map((s, i) => (
              <option key={s.id} value={i}>
                {t("Snapshot")} v{s.version} — {fmtDate(s.generatedAt, "en")}
              </option>
            ))}
          </select>
          <FreshnessBadge freshness={snap.freshness} />
        </div>
      </div>

      {mode === "round_changes" ? <RoundChanges cmp={cmp} /> : <KeyDifferences job={job} members={members} />}

      <div className="card" style={{ overflowX: "auto", marginTop: 18 }}>
        <CompareMatrix job={job} members={members} diffOnly={diffOnly} onOpenEvidence={(member, dimension) => setEvidenceTarget({ member, dimension })} />
      </div>

      <div className="section-block" style={{ marginTop: 24 }}>
        <div className="section-title">{t("Annotations")}</div>
        <div className="card card-pad">
          {cmp.annotations.length ? (
            cmp.annotations.map((a) => (
              <div style={{ marginBottom: 10 }} key={a.id}>
                <span style={{ fontWeight: 500, fontSize: "var(--fs-sm)" }}>{db.people[a.author]?.name}</span> <span className="tiny">{relTime(a.createdAt, "en")}</span>
                <p style={{ fontSize: "var(--fs-sm)", margin: "2px 0 0" }}>{a.body}</p>
              </div>
            ))
          ) : (
            <p className="tiny">{t("No annotations yet.")}</p>
          )}
          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <input
              type="text"
              placeholder={t("Add a note for the team...")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", border: "1px solid var(--border-strong)", borderRadius: 6, background: "var(--surface)", color: "var(--text)", fontSize: "var(--fs-sm)" }}
            />
            <Button variant="secondary" onClick={handleAddAnnotation}>
              {t("Add")}
            </Button>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="flex items-center justify-between">
          <div className="section-title" style={{ marginBottom: 6 }}>
            {t("Next steps")}
          </div>
          <div className="flex gap-8 items-center">
            <span className="tiny">{t("Apply to all:")}</span>
            <select value="" onChange={(e) => applyAllNextStep(e.target.value)}>
              <option value="">{t("Choose…")}</option>
              <option value="assessment">{t("Send Assessment")}</option>
              <option value="hold">{t("Hold")}</option>
            </select>
          </div>
        </div>
        <div className="card card-pad">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Candidate")}</th>
                <th>{t("Current status")}</th>
                <th>{t("Next step")}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const decided = db.decisions[m.app.id];
                return (
                  <tr key={m.app.id}>
                    <td>
                      <span className="flex items-center gap-8">
                        <CandidateAvatar id={m.cand.id} name={m.cand.displayName} size="sm" /> {m.cand.displayName}
                      </span>
                    </td>
                    <td>
                      {decided ? (
                        <Badge tone="success">
                          {t("Decided —")} {t(DECISION_LABEL[decided.outcome] || cap(decided.outcome))}
                        </Badge>
                      ) : (
                        <Badge tone="info">{t("Pending")}</Badge>
                      )}
                    </td>
                    <td>
                      {decided ? (
                        <span className="tiny muted">{t("Already decided")}</span>
                      ) : (
                        <select value={nextStepDraft[m.app.id] || ""} onChange={(e) => setNextStepDraft({ ...nextStepDraft, [m.app.id]: e.target.value })}>
                          <option value="">{t("Choose…")}</option>
                          <option value="assessment">{t("Send Assessment")}</option>
                          <option value="interview">{t("Move to Interview")}</option>
                          <option value="request_information">{t("Request Information")}</option>
                          <option value="hold">{t("Hold")}</option>
                          <option value="do_not_advance">{t("Do Not Advance")}</option>
                        </select>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Button
            variant="primary"
            style={{ marginTop: 12 }}
            onClick={() => {
              if (!entries.length) {
                say(t("Choose at least one next step first"), { type: "error" });
                return;
              }
              setShowSubmit(true);
            }}
          >
            {t("Submit selected next steps")}
          </Button>
          <p className="tiny" style={{ marginTop: 6 }}>
            {t("Generating this comparison or selecting values above does not notify anyone. Nothing is sent until you submit and confirm.")}
          </p>
        </div>
      </div>

      {evidenceTarget && <MatrixEvidenceDrawer member={evidenceTarget.member} dimension={evidenceTarget.dimension} onClose={() => setEvidenceTarget(null)} />}
      {showAdd && <AddCandidateModal cmp={cmp} job={job} onClose={() => setShowAdd(false)} onAdded={load} />}
      {showExport && <ExportModal cmp={cmp} members={members} onClose={() => setShowExport(false)} />}
      {showSubmit && (
        <SubmitNextStepsModal
          entries={entries}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => {
            setNextStepDraft({});
            load();
          }}
        />
      )}
    </>
  );
}
