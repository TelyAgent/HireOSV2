import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { useTasks } from "../features/tasks/useTasks";
import { claimTask, deferTask } from "../data/api/tasks";
import { getCandidate, getJob, getPerson } from "../data/db";
import { PEOPLE } from "../data/fixtures/people";
import type { Task, TaskType } from "../data/fixtures/tasks";
import { fmtDate, fmtDateTime, relTime } from "../lib/format";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  EmptyState,
  PageHeader,
  PersonAvatar,
  PriorityBadge,
  TaskStatusBadge,
} from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";

const TASK_TYPE_LABEL: Record<TaskType, string> = {
  duplicate_review: "Duplicate / identity review",
  link_confirmation: "Job link confirmation",
  screening_review: "Screening review",
  next_step: "Next-step decision",
  comparison_review: "Comparison review",
  delivery_exception: "Delivery exception",
  ownership_assignment: "Needs owner",
};
const TASK_TYPE_ICON: Record<TaskType, string> = {
  duplicate_review: "content_copy",
  link_confirmation: "link",
  screening_review: "fact_check",
  next_step: "call_split",
  comparison_review: "compare_arrows",
  delivery_exception: "report_problem",
  ownership_assignment: "person_add",
};

function taskNextActionLabel(t: Task, tt: (s: string, k?: string) => string): string {
  switch (t.type) {
    case "duplicate_review":
      return tt(t.status === "completed" ? "View resolution" : "Review");
    case "link_confirmation":
      return tt(t.needsRefresh ? "Refresh & review" : "Review recommendation");
    case "screening_review":
      return tt("Open screening");
    case "next_step":
      return tt(t.status === "waiting" ? "View status" : "Choose next step");
    case "comparison_review":
      return tt("Open comparison");
    case "delivery_exception":
      return tt("Resolve");
    case "ownership_assignment":
      return tt("Assign owner");
    default:
      return tt("Open", "Open (action)");
  }
}

function sameDay(iso: string, d2: Date): boolean {
  const d1 = new Date(iso);
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function taskStatsFor(list: Task[]) {
  const open = list.filter((t) => t.status === "open" || t.status === "in_progress");
  const waiting = list.filter((t) => t.status === "waiting");
  const overdue = list.filter((t) => t.dueAt && new Date(t.dueAt).getTime() < Date.now() && (t.status === "open" || t.status === "in_progress"));
  const dueToday = list.filter((t) => t.dueAt && sameDay(t.dueAt, new Date()) && (t.status === "open" || t.status === "in_progress"));
  const completed = list.filter((t) => t.status === "completed");
  return { unfinished: open.length + waiting.length, open: open.length, waiting: waiting.length, overdue: overdue.length, dueToday: dueToday.length, completed: completed.length };
}

function TaskSubject({ task }: { task: Task }) {
  const cand = task.candidateId ? getCandidate(task.candidateId) : null;
  const job = task.jobId ? getJob(task.jobId) : null;
  if (!cand && !job) return <span className="muted">—</span>;
  return (
    <>
      {cand && <Link to={`/candidates/${cand.id}`}>{cand.displayName}</Link>}
      {cand && job && " · "}
      {job && <Link to={`/jobs/${job.id}/screening`}>{job.title}</Link>}
    </>
  );
}

function TaskRow({
  task,
  showClaim,
  onClaim,
  onDefer,
}: {
  task: Task;
  showClaim?: boolean;
  onClaim?: (id: string) => void;
  onDefer?: (task: Task) => void;
}) {
  const { t, state } = useStore();
  const assignee = task.assignee ? getPerson(task.assignee) : null;
  const resumesText = state.lang === "zh" ? `${relTime(task.resumeAt, state.lang)}恢复` : `Resumes ${relTime(task.resumeAt, state.lang)}`;
  return (
    <tr className="hoverable-row">
      <td>
        <div className="flex items-center gap-8">
          <Icon name={TASK_TYPE_ICON[task.type] || "task_alt"} style={{ color: "var(--text-tertiary)" }} />
          <div>
            <div style={{ fontWeight: 500 }}>{task.title}</div>
            <div className="tiny">
              {t(TASK_TYPE_LABEL[task.type] || task.type)} · {task.module}
            </div>
          </div>
        </div>
      </td>
      <td>
        <TaskSubject task={task} />
      </td>
      <td>
        <PriorityBadge priority={task.priority} />
      </td>
      <td>
        <TaskStatusBadge task={task} />
      </td>
      <td>
        {task.status === "waiting" ? (
          <span className="tiny">
            {task.waitingReason || ""}
            <br />
            {resumesText}
          </span>
        ) : task.dueAt ? (
          <span className="tiny">{fmtDate(task.dueAt, state.lang)}</span>
        ) : (
          <span className="tiny muted">{t("No due date")}</span>
        )}
      </td>
      <td>
        {assignee ? (
          <span className="flex items-center gap-8">
            <PersonAvatar person={assignee} size="sm" /> {assignee.name}
          </span>
        ) : task.queue ? (
          <span className="tag">
            <Icon name="groups" size={13} /> {t(task.queue)}
          </span>
        ) : (
          <span className="badge badge-warning">{t("Unassigned")}</span>
        )}
      </td>
      <td className="text-right">
        {showClaim ? (
          <Button variant="secondary" size="sm" onClick={() => onClaim?.(task.id)}>
            {t("Claim")}
          </Button>
        ) : (
          <span className="flex items-center gap-8" style={{ justifyContent: "flex-end" }}>
            <Link className="btn btn-sm btn-secondary" to={task.linkRoute || "#"}>
              {taskNextActionLabel(task, t)}
            </Link>
            {onDefer && (task.status === "open" || task.status === "in_progress") && (
              <button className="btn btn-sm btn-text" onClick={() => onDefer(task)}>
                {t("Defer")}
              </button>
            )}
          </span>
        )}
      </td>
    </tr>
  );
}

const COLS = ["Task", "Candidate / Job", "Priority", "Status", "Due / waiting", "Assignee"];

function TaskTable({
  rows,
  showClaim,
  onClaim,
  onDefer,
  empty,
}: {
  rows: Task[];
  showClaim?: boolean;
  onClaim?: (id: string) => void;
  onDefer?: (task: Task) => void;
  empty: React.ReactNode;
}) {
  const { t } = useStore();
  if (!rows.length) return <>{empty}</>;
  return (
    <table className="data-table">
      <thead>
        <tr>
          {COLS.map((c) => (
            <th key={c}>{t(c)}</th>
          ))}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {rows.map((task) => (
          <TaskRow key={task.id} task={task} showClaim={showClaim} onClaim={onClaim} onDefer={onDefer} />
        ))}
      </tbody>
    </table>
  );
}

function DeferModal({ task, onClose, onDeferred }: { task: Task; onClose: () => void; onDeferred: () => void }) {
  const { t, say } = useStore();
  const [reason, setReason] = useState(task.waitingReason || "");
  const [days, setDays] = useState(3);

  const submit = async () => {
    await deferTask(task.id, reason || t("Deferred by user"), days);
    onClose();
    say(t("Task deferred"), { type: "success" });
    onDeferred();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Defer task")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit}>
            {t("Defer task")}
          </Button>
        </>
      }
    >
      <p className="tiny" style={{ marginBottom: 10 }}>
        {t("Deferring requires a reason and a resume time. This does not count as completed.")}
      </p>
      <div className="field">
        <label>{t("Reason")}</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("e.g. Waiting on candidate response")} />
      </div>
      <div className="field">
        <label>{t("Resume in")}</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={1}>{t("1 day")}</option>
          <option value={3}>{t("3 days")}</option>
          <option value={7}>{t("7 days")}</option>
        </select>
      </div>
    </Modal>
  );
}

export function TasksPage() {
  const { t, state, say } = useStore();
  const { tasks, reload } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statsExpanded, setStatsExpanded] = useState(true);
  const [deferring, setDeferring] = useState<Task | null>(null);
  const tab = searchParams.get("tab") || "mine";

  const mine = useMemo(() => tasks.filter((t2) => t2.assignee === state.currentUser), [tasks, state.currentUser]);
  const claimable = useMemo(() => tasks.filter((t2) => !t2.assignee && t2.status === "open"), [tasks]);
  const followed = useMemo(
    () => tasks.filter((t2) => t2.createdOrFollowed || (t2.assignee !== state.currentUser && t2.assignee)),
    [tasks, state.currentUser],
  );
  const completed = useMemo(() => tasks.filter((t2) => t2.status === "completed"), [tasks]);
  const stats = useMemo(() => taskStatsFor(mine), [mine]);

  const setTab = (id: string) => setSearchParams(id === "mine" ? {} : { tab: id });

  const handleClaim = async (id: string) => {
    const task = tasks.find((t2) => t2.id === id);
    await claimTask(id, state.currentUser);
    say(`${t("Claimed:")} ${task?.title ?? ""}`, { type: "success" });
    reload();
  };

  const tabsDef = [
    { id: "mine", label: "Assigned to me", count: mine.filter((t2) => t2.status !== "completed").length },
    { id: "claim", label: "Available to claim", count: claimable.length },
    { id: "followed", label: "Created or followed", count: followed.length },
    { id: "completed", label: "Completed", count: completed.length },
  ];

  const person = getPerson(state.currentUser)!;
  const subtitle =
    state.lang === "zh" ? (
      <>
        已为 <strong>{person.name}</strong> 显示 <strong>{stats.unfinished} 个未完成</strong>任务 · 截至 {fmtDateTime(new Date().toISOString(), state.lang)} ·{" "}
        <span className="tiny">时区：America/Chicago（演示）</span>
      </>
    ) : (
      <>
        Showing <strong>{stats.unfinished} unfinished</strong> task{stats.unfinished === 1 ? "" : "s"} for <strong>{person.name}</strong> · as of{" "}
        {fmtDateTime(new Date().toISOString(), state.lang)} · <span className="tiny">Timezone: America/Chicago (demo)</span>
      </>
    );

  let listHtml: React.ReactNode;
  if (tab === "mine") {
    listHtml = (
      <TaskTable
        rows={mine.filter((t2) => t2.status !== "completed")}
        onDefer={setDeferring}
        empty={<EmptyState icon="task_alt" title={t("Nothing assigned to you right now")} body={t("Check Available to claim, or come back after new material is imported.")} />}
      />
    );
  } else if (tab === "claim") {
    listHtml = (
      <TaskTable
        rows={claimable}
        showClaim
        onClaim={handleClaim}
        empty={<EmptyState icon="inbox" title={t("No unclaimed tasks")} body={t("Everything routed so far has an owner.")} />}
      />
    );
  } else if (tab === "followed") {
    listHtml = (
      <TaskTable rows={followed} empty={<EmptyState icon="visibility" title={t("Nothing created or followed")} body={t("Tasks you create or collaborate on will show up here.")} />} />
    );
  } else {
    listHtml = <TaskTable rows={completed} empty={<EmptyState icon="done_all" title={t("Nothing completed yet")} />} />;
  }

  return (
    <>
      <PageHeader
        title={t("My Tasks")}
        subtitle={subtitle}
        actions={
          <>
            <Link className="btn btn-secondary" to="/library">
              <Icon name="folder_shared" />
              {t("Resume Library")}
            </Link>
            <Link className="btn btn-primary" to="/imports/new">
              <Icon name="upload" />
              {t("Upload resumes")}
            </Link>
          </>
        }
      />

      <section className="task-metric-section" aria-labelledby="my-work-heading">
        <div className="task-metric-head">
          <div className="task-metric-kicker" id="my-work-heading">
            {t("My work")} · {person.name}
          </div>
        </div>
        <div className="task-metric-grid">
          <button className="task-metric-card" onClick={() => setTab("mine")}>
            <span className="task-metric-icon">
              <Icon name="warning" />
            </span>
            <span className={`task-metric-number${stats.overdue > 0 ? " danger" : ""}`}>{stats.overdue}</span>
            <span className="task-metric-label">{t("Overdue")}</span>
            <span className="task-metric-meta">{t("action required")}</span>
          </button>
          <button className="task-metric-card" onClick={() => setTab("mine")}>
            <span className="task-metric-icon">
              <Icon name="today" />
            </span>
            <span className="task-metric-number">{stats.dueToday}</span>
            <span className="task-metric-label">{t("Due today")}</span>
            <span className="task-metric-meta">{t("deadline today")}</span>
          </button>
          <button className="task-metric-card" onClick={() => setTab("mine")}>
            <span className="task-metric-icon">
              <Icon name="pending_actions" />
            </span>
            <span className="task-metric-number">{stats.open}</span>
            <span className="task-metric-label">{t("Open / in progress")}</span>
            <span className="task-metric-meta">{t("assigned workload")}</span>
          </button>
          <button className="task-metric-card" onClick={() => setTab("claim")}>
            <span className="task-metric-icon">
              <Icon name="group_add" />
            </span>
            <span className="task-metric-number">{claimable.length}</span>
            <span className="task-metric-label">{t("Available to claim")}</span>
            <span className="task-metric-meta">{t("unassigned queue")}</span>
          </button>
        </div>
      </section>

      <section className="task-metric-section" aria-labelledby="workspace-overview-heading">
        <div className="task-metric-head">
          <div className="task-metric-kicker" id="workspace-overview-heading">
            {t("Workspace overview")}
          </div>
          <button className="task-overview-toggle" onClick={() => setStatsExpanded((v) => !v)} aria-expanded={statsExpanded}>
            {statsExpanded ? t("Show less") : t("Show more")} <Icon name={statsExpanded ? "keyboard_arrow_up" : "keyboard_arrow_down"} />
          </button>
        </div>
        {statsExpanded && (
          <div className="task-metric-grid overview">
            <button className="task-metric-card" onClick={() => setTab("mine")}>
              <span className="task-metric-icon">
                <Icon name="schedule" />
              </span>
              <span className="task-metric-number">{stats.waiting}</span>
              <span className="task-metric-label">{t("Waiting on others")}</span>
              <span className="task-metric-meta">{t("pending external response")}</span>
            </button>
            <button className="task-metric-card" onClick={() => setTab("completed")}>
              <span className="task-metric-icon">
                <Icon name="task_alt" />
              </span>
              <span className="task-metric-number">{stats.completed}</span>
              <span className="task-metric-label">{t("Completed tasks")}</span>
              <span className="task-metric-meta">{t("all time, demo")}</span>
            </button>
          </div>
        )}
      </section>

      <div className="task-filter-tabs" role="tablist" aria-label="Task filters">
        {tabsDef.map((td) => (
          <button key={td.id} className={`task-filter-tab${tab === td.id ? " active" : ""}`} role="tab" aria-selected={tab === td.id} onClick={() => setTab(td.id)}>
            {t(td.label)} <span className="cnt">({td.count})</span>
          </button>
        ))}
      </div>
      <div className="card">{listHtml}</div>

      <div className="section-block" style={{ marginTop: 28 }}>
        <div className="section-title">
          {t("Team workload")} <span className="tiny" style={{ fontWeight: 400 }}>{t("(scope: people you can see, as of now)")}</span>
        </div>
        <div className="card card-pad">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Person")}</th>
                <th>{t("Role")}</th>
                <th>{t("Open")}</th>
                <th>{t("Waiting")}</th>
                <th>{t("Overdue")}</th>
                <th>{t("Completed (30d, demo)")}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(PEOPLE).map((p) => {
                const personTasks = tasks.filter((x) => x.assignee === p.id);
                const s = taskStatsFor(personTasks);
                return (
                  <tr key={p.id}>
                    <td className="flex items-center gap-8">
                      <PersonAvatar person={p} /> {p.name}
                    </td>
                    <td>{p.role}</td>
                    <td>{s.open}</td>
                    <td>{s.waiting}</td>
                    <td style={s.overdue > 0 ? { color: "var(--danger-text)", fontWeight: 600 } : undefined}>{s.overdue}</td>
                    <td>{Math.max(3, s.completed)}</td>
                  </tr>
                );
              })}
              <tr>
                <td>
                  <span className="tag">
                    <Icon name="groups" size={13} /> {t("Resume Library queue")}
                  </span>
                </td>
                <td>{t("Unassigned")}</td>
                <td>{tasks.filter((t2) => t2.queue === "Resume Library queue" && t2.status === "open").length}</td>
                <td>0</td>
                <td>0</td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
          <p className="tiny" style={{ marginTop: 10 }}>
            {t(
              "Task counts are deduplicated by task ID; parent/child and machine batch runs are shown separately and are not added into these totals. Task counts are not candidate counts, pass rates, or a performance ranking.",
            )}
          </p>
        </div>
      </div>

      {deferring && <DeferModal task={deferring} onClose={() => setDeferring(null)} onDeferred={reload} />}
    </>
  );
}
