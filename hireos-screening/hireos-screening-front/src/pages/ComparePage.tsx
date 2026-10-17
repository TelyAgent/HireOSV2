import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import {
  addCandidateToComparison,
  exportComparison,
  getComparison,
  refreshComparison,
} from "../data/api/comparisons";
import { getApplication, getApplicationsForJob, getCandidate, getConcerns, getEvaluation, getJob } from "../data/db";
import type { ComparisonSet } from "../data/fixtures/comparisons";
import type { Application } from "../data/fixtures/applications";
import type { Candidate } from "../data/fixtures/candidates";
import type { Evaluation } from "../data/fixtures/evaluations";
import type { Job, Dimension } from "../data/fixtures/jobs";
import { fmtDate, fmtMoney } from "../lib/format";
import { Badge, Button, CandidateAvatar, EligibilityBadge, EmptyState, FreshnessBadge, PageHeader, PillTabs, ScoreRing } from "../components/ui/Primitives";
import { EvidenceCard } from "../components/ui/EvidenceCard";
import { Icon } from "../components/ui/Icons";
import { Drawer, Modal } from "../components/ui/Overlays";
import { purposeLabel, roundChangesView } from "../lib/snapshotChanges";
import { PageSkeleton } from "../components/ui/PageSkeleton";

type CompareMode = "same_stage" | "current_summary" | "round_changes";

interface Member {
  app: Application;
  cand: Candidate;
  ev: Evaluation | undefined;
}

/* ---------------------------------------------------------------
   Key differences / round changes narrative
   --------------------------------------------------------------- */
function computeKeyDifferences(job: Job, members: Member[], lang: "en" | "zh", t: (s: string) => string): string[] {
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
          ? `在「${t(d.name)}」维度上，${max.cand.displayName} 的证据更强（${max.score}），高于 ${min.cand.displayName}（${min.score}）。如果该维度对本职位最重要，这会更有利于 ${max.cand.displayName} —— 但在将其视为决定性因素前，请先查看关联证据。`
          : `On ${t(d.name)}, ${max.cand.displayName} shows stronger evidence (${max.score}) than ${min.cand.displayName} (${min.score}). If this dimension matters most for the role, that favors ${max.cand.displayName} — but confirm via the linked evidence before treating it as decisive.`,
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
  const notEvaluated = members.filter((m) => m.app.assessmentStatus !== "completed");
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
  const diffs = computeKeyDifferences(job, members, state.lang, t);
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

function RoundChanges({ snap }: { snap: ComparisonSet["snapshots"][number] }) {
  const { t } = useStore();
  // The snapshot chosen in the picker, not always the newest (#206).
  const view = roundChangesView(snap, t);
  return (
    <div className="card card-pad" style={{ background: "var(--info-bg)", borderColor: "var(--info-border)" }}>
      <div className="flex items-center gap-8" style={{ color: "var(--info-text)", fontWeight: 600, fontSize: "var(--fs-sm)", marginBottom: 8 }}>
        <Icon name="history" size={18} />
        {t("Changes since last round")}
      </div>
      {view.state === "changed" ? (
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
          {view.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : view.state === "unchanged" ? (
        <p className="tiny">{t("No change since v{n}: the same members, scores and ranks.").replace("{n}", String(view.previousVersion))}</p>
      ) : (
        <p className="tiny">{t("This is the first snapshot for this comparison set.")}</p>
      )}
      {snap.note && (
        <p className="tiny" style={{ marginTop: 8 }}>
          {t(snap.note)}
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
    <Drawer open onClose={onClose} title={`${member.cand.displayName} — ${t(dimension.name)}`}>
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
  const { t, state } = useStore();

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
      label: t(d.name),
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
        if (m.app.assessmentStatus !== "completed") return <Badge tone="outline">{t("Not evaluated")}</Badge>;
        return <Badge tone="success">{t("Completed")}</Badge>;
      },
    },
    {
      label: t("Compensation & location"),
      render: (m) => {
        const c = m.cand.compensationExpectation;
        return c ? <span className="tiny">{fmtMoney(c, state.lang)}</span> : <Badge tone="outline">{t("Not provided")}</Badge>;
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

/* ---------------------------------------------------------------
   Page
   --------------------------------------------------------------- */
export function ComparePage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [cmp, setCmp] = useState<ComparisonSet | null | undefined>(undefined);
  const [mode, setMode] = useState<CompareMode>("current_summary");
  const [diffOnly, setDiffOnly] = useState(false);
  const [snapIdx, setSnapIdx] = useState(0);
  const workspaceSearch = (useLocation().state as { workspaceSearch?: string } | null)?.workspaceSearch ?? "";
  const [evidenceTarget, setEvidenceTarget] = useState<{ member: Member; dimension: Dimension } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showExport, setShowExport] = useState(false);

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

  if (cmp === undefined) return <PageSkeleton />;
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
  // Back to the job's workspace with the filters it was opened from (#209 AC-3).
  const workspaceUrl = `/jobs/${job.id}/screening${workspaceSearch ? `?${workspaceSearch}` : ""}`;

  const handleRefresh = async () => {
    say(t("Refreshing comparison with latest inputs…"));
    const snapshot = await refreshComparison(cmp.id);
    say(t("Comparison refreshed — new snapshot created, prior snapshots kept"), { type: "success" });
    load();
    setSnapIdx(cmp.snapshots.findIndex((s) => s.id === snapshot.id));
  };

  return (
    <>
      <PageHeader
        title={t("Compare candidates")}
        subtitle={
          <>
            {job.title} · {purposeLabel(cmp.purpose, t)}
            <br />
            {t("Members:")} {members.map((m) => m.cand.displayName).join(", ")}
          </>
        }
        back={workspaceUrl}
        crumbs={[{ label: t("Jobs"), to: "/jobs" }, { label: job.title, to: workspaceUrl }, { label: t("Compare") }]}
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
                {t("Snapshot")} v{s.version} — {fmtDate(s.generatedAt, state.lang)}
              </option>
            ))}
          </select>
          <FreshnessBadge freshness={snap.freshness} />
        </div>
      </div>

      {/* Never show a stale snapshot silently (#27 AC-7). */}
      {snap.id === cmp.snapshots[cmp.snapshots.length - 1].id && (cmp.changedSinceSnapshot?.length ?? 0) > 0 && (
        <div className="error-inline" role="status" style={{ marginBottom: 16, borderColor: "var(--warning-border)", background: "var(--warning-bg)", color: "var(--warning-text)" }}>
          <Icon name="update" />
          <span>
            {t("Data updated since this snapshot: {names} changed (concerns, verification, decision or score). Refresh to compare the latest.").replace(
              "{names}",
              (cmp.changedSinceSnapshot ?? []).map((appId) => members.find((m) => m.app.id === appId)?.cand.displayName ?? appId).join(", "),
            )}
          </span>
          <Button size="sm" variant="secondary" icon="refresh" onClick={handleRefresh}>
            {t("Refresh comparison")}
          </Button>
        </div>
      )}

      {mode === "round_changes" ? <RoundChanges snap={snap} /> : <KeyDifferences job={job} members={members} />}

      <div className="card" style={{ overflowX: "auto", marginTop: 18 }}>
        <CompareMatrix job={job} members={members} diffOnly={diffOnly} onOpenEvidence={(member, dimension) => setEvidenceTarget({ member, dimension })} />
      </div>

      {evidenceTarget && <MatrixEvidenceDrawer member={evidenceTarget.member} dimension={evidenceTarget.dimension} onClose={() => setEvidenceTarget(null)} />}
      {showAdd && <AddCandidateModal cmp={cmp} job={job} onClose={() => setShowAdd(false)} onAdded={load} />}
      {showExport && <ExportModal cmp={cmp} members={members} onClose={() => setShowExport(false)} />}
    </>
  );
}
