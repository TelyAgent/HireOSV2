import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { StatusBadge, taskTypeSource } from "../utils/status";
import { Button, Card, EmptyState } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icon";
import { roundsForCase } from "../utils/cases";
import { isWrittenTestTask, taskCountsFor, writtenTaskJob, writtenTaskStatus, writtenTestTasks, type WrittenTaskStatus } from "../utils/writtenTasks";
import {
  PROJECT, INVITATIONS, MAIL, RESULTS, EVALUATIONS, TASKS, CASES, CORE_CANDIDATES, COMPARISONS,
  fmtDateShort, nowISO, type CoreCandidate, type CoreJob, type Task,
} from "../data/fixtures";

function candidateOf(caseId: string): CoreCandidate | null {
  const c = CASES[caseId];
  return c ? CORE_CANDIDATES[c.candidateId] : null;
}

function isDueToday(iso: string, clockOffsetMin: number) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date(nowISO(clockOffsetMin));
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}

function initials(name: string): string {
  return name.split(/\s+/).map((x) => x[0]).join("").slice(0, 2).toUpperCase();
}

/** Mirrors ComparisonDetailPage's unexported comparableCells() gate: only candidates that
 * already have a result or an AI/human evaluation can be pulled into a comparison. */
function hasScoreForCase(caseId: string): boolean {
  const result = Object.values(RESULTS).find((r) => r.caseId === caseId);
  const evaluation = (result ? EVALUATIONS[result.evaluationId] : undefined) || EVALUATIONS[`eval_${caseId}`] || undefined;
  return !!(result || evaluation);
}

type FilterKey = "all" | WrittenTaskStatus;
const FILTER_DEFS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All tasks" },
  { key: "written_completed", label: "Written completed" },
  { key: "pending_test", label: "Pending test" },
  { key: "pending_submission", label: "Pending submission" },
  { key: "pending_result_review", label: "Pending result review" },
];

export function TasksPage() {
  const { state, t, user, say } = useStore();
  const navigate = useNavigate();
  const uid = state.currentUser;
  const scoped = false; // no restricted-scope demo user selected by default

  const [filter, setFilter] = useState<FilterKey>("all");
  const [view, setView] = useState<"list" | "cluster">("list");
  const [resumeFor, setResumeFor] = useState<{ candidate: CoreCandidate; job: CoreJob } | null>(null);
  const [collapsedOverride, setCollapsedOverride] = useState<Record<string, boolean>>({});

  // Depends on realTasksVersion so this recomputes once App's real-task load merges new
  // entries into the TASKS/CASES fixture dicts after mount (see data/realTasksMerge.ts) --
  // eslint can't see that writtenTestTasks() reads those mutable module dicts.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const allWritten = useMemo(() => writtenTestTasks(), [state.realTasksVersion]);
  const counts = taskCountsFor(uid);

  const primaryMetrics = [
    { label: "My open tasks", value: scoped ? 0 : counts.open, sub: "Unique task_id, open/in_progress/waiting", link: "/tasks" },
    { label: "Reviews awaiting me", value: scoped ? 0 : allWritten.filter((tk) => tk.assignee === uid && ["evaluation_review", "result_release"].includes(tk.type) && tk.status !== "completed").length, sub: "Same filter as list view", link: "/tasks" },
    { label: "Due today", value: scoped ? 0 : Object.values(TASKS).filter((tk) => tk.assignee === uid && isDueToday(tk.dueAt, state.clockOffsetMin)).length, sub: "Same filter as list view", link: "/tasks" },
    { label: "In progress", value: allWritten.filter((tk) => tk.assignee === uid && tk.status === "in_progress").length, sub: "Same filter as list view", link: "/tasks" },
  ];
  const moreMetrics = [
    { label: "Active projects", value: scoped ? 0 : (PROJECT.status === "active" ? 1 : 0), link: "/assessments" },
    { label: "Awaiting acceptance", value: scoped ? 0 : Object.values(INVITATIONS).filter((i) => ["sent", "opened"].includes(i.status)).length, link: "/assessments" },
    { label: "Awaiting submission", value: scoped ? 0 : Object.values(INVITATIONS).filter((i) => ["accepted", "started"].includes(i.status)).length, link: "/assessments" },
    { label: "Submission issues", value: scoped ? 0 : new Set(Object.values(MAIL).filter((m) => ["incomplete", "needs_confirmation", "quarantined"].includes(m.classification)).map((m) => m.caseId || m.id)).size, link: "/submissions" },
    { label: "Results to release", value: scoped ? 0 : Object.values(RESULTS).filter((r) => r.status === "final_not_released").length, link: "/assessments" },
    { label: "Delivery issues", value: scoped ? t("Unavailable") : 0, link: "/files" },
  ];
  const [expanded, setExpanded] = useState(false);

  const filteredTasks = useMemo(() => {
    const rows = filter === "all" ? allWritten : allWritten.filter((tk) => writtenTaskStatus(tk) === filter);
    return [...rows].sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime());
  }, [allWritten, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, { job: CoreJob; tasks: Task[] }>();
    filteredTasks.forEach((tk) => {
      const job = writtenTaskJob(tk);
      if (!map.has(job.id)) map.set(job.id, { job, tasks: [] });
      map.get(job.id)!.tasks.push(tk);
    });
    return Array.from(map.values());
  }, [filteredTasks]);

  const handleViewResume = (candidate: CoreCandidate, job: CoreJob) => setResumeFor({ candidate, job });

  const handleCompare = (job: CoreJob, groupTasks: Task[]) => {
    const scoredCaseIds = groupTasks.map((tk) => tk.sourceRef).filter((cid): cid is string => !!cid && hasScoreForCase(cid));
    if (scoredCaseIds.length === 0) {
      say(t("No scored candidates to compare yet."), { type: "danger" });
      return;
    }
    const cmpId = `cmp_job_${job.id}`;
    COMPARISONS[cmpId] = { id: cmpId, caseIds: scoredCaseIds, mode: "current_summary", createdAt: nowISO(state.clockOffsetMin), note: "Comparison created from the written test role cluster." };
    navigate(`/comparisons/${cmpId}`);
  };

  const handleLinkCandidate = () => navigate("/assessments/prj_fin");

  const openTask = (tk: Task) => navigate(isWrittenTestTask(tk) ? `/cases/${tk.sourceRef}/plan` : tk.link);

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t("My Tasks")}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>
        {t("Signed in as")} {user.name} · {user.role} · Aurora Studio
      </div>

      <div className="grid-4" style={{ marginBottom: 8 }}>
        {primaryMetrics.map((m) => (
          <MetricCard key={m.label} {...m} />
        ))}
      </div>
      <div style={{ marginBottom: 24 }}>
        <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => setExpanded((v) => !v)}>
          <Icon name={expanded ? "expand_less" : "expand_more"} style={{ fontSize: 16 }} /> {t("More statistics")}
        </button>
        {expanded && (
          <div className="grid-4" style={{ marginTop: 8 }}>
            {moreMetrics.map((m) => (
              <MetricCard key={m.label} {...m} />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between wrap gap-3" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <div className="flex gap-2 wrap" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {FILTER_DEFS.map((def) => {
            const count = def.key === "all" ? allWritten.length : allWritten.filter((x) => writtenTaskStatus(x) === def.key).length;
            return (
              <button key={def.key} className={`btn sm ${filter === def.key ? "primary" : ""}`} onClick={() => setFilter(def.key)}>
                {t(def.label)} ({count})
              </button>
            );
          })}
        </div>
        <div className="segmented-control">
          <button className={`btn sm ${view === "list" ? "primary" : "ghost"}`} onClick={() => setView("list")}>{t("Task list")}</button>
          <button className={`btn sm ${view === "cluster" ? "primary" : "ghost"}`} onClick={() => setView("cluster")}>{t("Cluster by JD")}</button>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon="checklist" title="Nothing here." />
        </Card>
      ) : view === "list" ? (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,2.2fr) minmax(190px,1.4fr) 130px 130px minmax(130px,1fr)", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
            <span>{t("Candidate")}</span><span>{t("Status")}</span><span>{t("Created")}</span><span>{t("Deadline")}</span><span>{t("Resume")}</span>
          </div>
          {filteredTasks.map((tk) => (
            <WrittenTaskRow key={tk.id} task={tk} clusterMode={false} onOpen={openTask} onViewResume={handleViewResume} />
          ))}
        </Card>
      ) : (
        <Card padded={false} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16, padding: "12px 32px", color: "var(--muted)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
            <span>{t("Role & project")}</span>
          </div>
          {groups.map(({ job, tasks: groupTasks }, index) => {
            const defaultExpanded = index === 0;
            const isExpanded = collapsedOverride[job.id] !== undefined ? !collapsedOverride[job.id] : defaultExpanded;
            return (
              <div key={job.id}>
                <div
                  style={{ display: "grid", gridTemplateColumns: "36px 1fr 1fr auto", gap: 16, alignItems: "center", padding: "14px 32px", background: "var(--surface-2)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                  onClick={() => setCollapsedOverride((prev) => ({ ...prev, [job.id]: isExpanded }))}
                >
                  <button className="btn ghost sm" style={{ padding: 0, width: 24 }} onClick={(e) => { e.stopPropagation(); setCollapsedOverride((prev) => ({ ...prev, [job.id]: isExpanded })); }}>
                    <Icon name={isExpanded ? "expand_more" : "chevron_right"} />
                  </button>
                  <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="avatar" style={{ width: 40, height: 40 }}>{initials(job.title)}</div>
                    <div className="task-title">{job.title}</div>
                  </div>
                  <div style={{ fontSize: 15 }}>{groupTasks.length} {t("candidates")}</div>
                  <div className="flex gap-2" style={{ display: "flex", gap: 8, flex: "none", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => handleCompare(job, groupTasks)}>{t("Compare candidates")}</Button>
                    <Button size="sm" variant="ghost" onClick={handleLinkCandidate}>{t("Link candidate")}</Button>
                  </div>
                </div>
                {isExpanded && (
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,2.2fr) minmax(170px,1.2fr) 180px minmax(130px,1fr)", gap: 16, padding: "10px 48px", color: "var(--muted)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
                      <span>{t("Candidate")}</span><span>{t("Status")}</span><span>{t("Round")}</span><span>{t("Resume")}</span>
                    </div>
                    {groupTasks.map((tk) => (
                      <WrittenTaskRow key={tk.id} task={tk} clusterMode onOpen={openTask} onViewResume={handleViewResume} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      )}

      <CandidateResumeModal entry={resumeFor} onClose={() => setResumeFor(null)} />
    </div>
  );
}

function WrittenTaskRow({
  task, clusterMode, onOpen, onViewResume,
}: {
  task: Task;
  clusterMode: boolean;
  onOpen: (task: Task) => void;
  onViewResume: (candidate: CoreCandidate, job: CoreJob) => void;
}) {
  const { t } = useStore();
  const cand = task.sourceRef && CASES[task.sourceRef] ? candidateOf(task.sourceRef) : null;
  const status = writtenTaskStatus(task);
  const job = writtenTaskJob(task);
  const round = cand && task.sourceRef ? (roundsForCase(task.sourceRef).find((r) => r.status !== "completed") || roundsForCase(task.sourceRef)[0]) : null;
  const deadline = status === "pending_test" ? "" : task.dueAt ? fmtDateShort(task.dueAt) : "";
  const gridCols = clusterMode
    ? "minmax(260px,2.2fr) minmax(170px,1.2fr) 180px minmax(130px,1fr)"
    : "minmax(260px,2.2fr) minmax(190px,1.4fr) 130px 130px minmax(130px,1fr)";

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: gridCols, gap: 16, alignItems: "center", padding: clusterMode ? "16px 16px 16px 48px" : 16, borderBottom: "1px solid var(--border)", minHeight: 72, cursor: "pointer" }}
      onClick={() => onOpen(task)}
    >
      {cand ? (
        <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="avatar" style={{ width: 36, height: 36 }}>{initials(cand.name)}</div>
          <div>
            <div className="task-title">{cand.name}</div>
            <div className="task-sub">{job.title}</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="task-title">{task.title}</div>
          <div className="task-sub">{t(taskTypeSource(task.type))}</div>
        </div>
      )}
      <div><StatusBadge status={status} /></div>
      <div className="task-sub" style={{ fontSize: 14 }}>{clusterMode && round ? round.title : fmtDateShort(task.dueAt)}</div>
      {!clusterMode && <div className="task-sub" style={{ fontSize: 14 }}>{deadline}</div>}
      <div>
        {cand && (
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); onViewResume(cand, job); }}>{t("View resume")}</Button>
        )}
      </div>
    </div>
  );
}

/** Ported from the prototype's openCandidateResume(candidate, job) — the profile sections are
 * templated placeholders (this app has no real resume-parsing pipeline), same as the prototype;
 * what's real is the linkage: which case/result this candidate maps to, and the profileNote flag when
 * present, are both read live off the shared candidate/case/result records. */
function CandidateResumeModal({ entry, onClose }: { entry: { candidate: CoreCandidate; job: CoreJob } | null; onClose: () => void }) {
  const { t } = useStore();
  if (!entry) return null;
  const { candidate, job } = entry;
  const caseEntry = Object.values(CASES).find((c) => c.candidateId === candidate.id);
  const result = caseEntry && Object.values(RESULTS).find((r) => r.caseId === caseEntry.id);
  const sections = [
    { title: "Professional summary", body: `${candidate.name} is being assessed for the ${job.title} role. The structured profile is ready for recruiter and reviewer use.` },
    { title: "Experience", body: `Relevant experience aligned to ${job.title}; verify detailed employment dates and achievements against the source resume before making a decision.` },
    { title: "Core skills", body: "Written communication · Problem solving · Role-specific analysis · Stakeholder collaboration" },
    { title: "Education", body: "Education history is available in the candidate profile record." },
  ];

  return (
    <Modal open onCancel={onClose} footer={null} title={t("Candidate resume")} width={560}>
      <div className="flex-col gap-3" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="card card-pad">
          <div className="flex items-center gap-3" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="avatar" style={{ width: 48, height: 48 }}>{initials(candidate.name)}</div>
            <div>
              <div style={{ fontWeight: 600 }}>{candidate.name}</div>
              <div className="muted">{candidate.email}</div>
            </div>
          </div>
        </div>
        <div className="card card-pad">
          <div className="tiny">{t("Target role")}</div>
          <div style={{ fontWeight: 600 }}>{job.title}</div>
          <div className="tiny" style={{ marginTop: 8 }}>Profile {candidate.profileVersion || "v1"}</div>
        </div>
        {sections.map((s) => (
          <div key={s.title} className="card card-pad">
            <h4 style={{ marginBottom: 6 }}>{t(s.title)}</h4>
            {/* body text is dynamically interpolated with the candidate/job name, so — same as the
               prototype — it's shown as-is rather than run through the static i18n dictionary. */}
            <div className="muted" style={{ lineHeight: 1.55 }}>{s.body}</div>
          </div>
        ))}
        <div className="card card-pad">
          <div className="tiny">{t("Assessment result")}</div>
          <div style={{ fontSize: 28, fontWeight: 700, marginTop: 6 }}>
            {result?.overall != null ? `${result.overall} / 100` : t("Waiting for result")}
          </div>
          <div className="tiny" style={{ marginTop: 6 }}>{result ? <StatusBadge status={result.status} /> : t("No result has been returned yet.")}</div>
        </div>
        {candidate.profileNote && <div className="banner info">{candidate.profileNote}</div>}
        <div className="banner info">{t("Resume preview is linked to the shared candidate record.")}</div>
      </div>
    </Modal>
  );
}

function MetricCard({ label, value, sub, link }: { label: string; value: number | string; sub?: string; link: string }) {
  const { t } = useStore();
  return (
    <Link to={link} className="metric" style={{ textDecoration: "none", color: "inherit" }}>
      <div className="label">{t(label)}</div>
      <div className="value">{value}</div>
      <div className="sub">{sub ? t(sub) : t("Same filter as list view")}</div>
    </Link>
  );
}
