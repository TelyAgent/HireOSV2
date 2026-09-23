import { useMemo, useState } from "react";
import { Modal, Input } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { useOpenTaskCount } from "../features/useOpenTaskCount";
import { StatusBadge, taskTypeSource } from "../utils/status";
import { Button, Card } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icon";
import { PROJECT, INVITATIONS, MAIL, RESULTS, TASKS, CASES, CORE_CANDIDATES, fmtDate, fmtDateShort, nowISO, type Task } from "../data/fixtures";
import { getUser } from "../data/users";

type TabKey = "assigned" | "team" | "claim" | "created" | "completed";

function candidateOf(caseId: string) {
  const c = CASES[caseId];
  return c ? CORE_CANDIDATES[c.candidateId] : null;
}

function isDueToday(iso: string, clockOffsetMin: number) {
  if (!iso) return false;
  const d = new Date(iso), n = new Date(nowISO(clockOffsetMin));
  return d.getUTCFullYear() === n.getUTCFullYear() && d.getUTCMonth() === n.getUTCMonth() && d.getUTCDate() === n.getUTCDate();
}

export function TasksPage() {
  const { state, t, user } = useStore();
  const openCount = useOpenTaskCount();
  const [tasks, setTasks] = useState<Record<string, Task & { performedBy?: string }>>(TASKS);
  const [tab, setTab] = useState<TabKey>("assigned");
  const [expanded, setExpanded] = useState(false);
  const [waitingTask, setWaitingTask] = useState<Task | null>(null);
  const [waitReason, setWaitReason] = useState("");
  const navigate = useNavigate();

  const uid = state.currentUser;
  const scoped = false; // no restricted-scope demo user selected by default

  const cards = useMemo(() => {
    const mine = Object.values(tasks).filter((tk) => tk.assignee === uid && tk.status !== "completed" && tk.status !== "cancelled");
    mine.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return mine.slice(0, 4);
  }, [tasks, uid]);

  const primaryMetrics = [
    { label: "My open tasks", value: scoped ? 0 : openCount, sub: "Unique task_id, open/in_progress/waiting", link: "/tasks" },
    { label: "Reviews awaiting me", value: scoped ? 0 : Object.values(tasks).filter((tk) => tk.assignee === uid && (tk.type === "evaluation_review" || tk.type === "result_release") && tk.status !== "completed").length, sub: "Same filter as list view", link: "/tasks" },
    { label: "Due today", value: scoped ? 0 : Object.values(tasks).filter((tk) => tk.assignee === uid && isDueToday(tk.dueAt, state.clockOffsetMin)).length, sub: "Same filter as list view", link: "/tasks" },
    { label: "Available to claim", value: Object.values(tasks).filter((tk) => !tk.assignee && tk.status === "open").length, sub: "Same filter as list view", link: "/tasks" },
  ];
  const moreMetrics = [
    { label: "Active projects", value: scoped ? 0 : (PROJECT.status === "active" ? 1 : 0), link: "/assessments" },
    { label: "Awaiting acceptance", value: scoped ? 0 : Object.values(INVITATIONS).filter((i) => ["sent", "opened"].includes(i.status)).length, link: "/assessments" },
    { label: "Awaiting submission", value: scoped ? 0 : Object.values(INVITATIONS).filter((i) => ["accepted", "started"].includes(i.status)).length, link: "/assessments" },
    { label: "Submission issues", value: scoped ? 0 : new Set(Object.values(MAIL).filter((m) => ["incomplete", "needs_confirmation", "quarantined"].includes(m.classification)).map((m) => m.caseId || m.id)).size, link: "/submissions" },
    { label: "Results to release", value: scoped ? 0 : Object.values(RESULTS).filter((r) => r.status === "final_not_released").length, link: "/assessments" },
    { label: "Delivery issues", value: scoped ? t("Unavailable") : 0, link: "/files" },
  ];

  const list = useMemo(() => {
    let rows = Object.values(tasks);
    if (tab === "assigned") rows = rows.filter((tk) => tk.assignee === uid && tk.status !== "completed");
    if (tab === "team") rows = rows.filter((tk) => tk.assignee && tk.assignee !== uid && !["completed", "cancelled"].includes(tk.status));
    if (tab === "claim") rows = rows.filter((tk) => !tk.assignee && tk.status === "open");
    if (tab === "created") rows = rows.filter((tk) => tk.assignee !== uid);
    if (tab === "completed") rows = rows.filter((tk) => tk.status === "completed");
    return rows;
  }, [tasks, tab, uid]);

  function updateTask(id: string, patch: Partial<Task & { performedBy?: string }>) {
    setTasks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function claim(tk: Task) {
    if (tk.assignee) return;
    updateTask(tk.id, { assignee: uid, status: "open" });
  }
  function start(tk: Task) {
    updateTask(tk.id, { status: "in_progress" });
  }
  function resume(tk: Task) {
    updateTask(tk.id, { status: "in_progress", waitingReason: undefined });
  }
  function assignToMe(tk: Task) {
    updateTask(tk.id, { assignee: uid, status: "open", performedBy: uid });
  }
  function confirmWait() {
    if (!waitingTask) return;
    updateTask(waitingTask.id, { status: "waiting", waitingReason: waitReason.trim() || undefined });
    setWaitingTask(null);
    setWaitReason("");
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "assigned", label: "Assigned to me" },
    { key: "team", label: "Team Tasks" },
    { key: "claim", label: "Available to claim" },
    { key: "created", label: "Created or followed" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <div>
      <h1 style={{ marginBottom: 4 }}>{t("My Work")}</h1>
      <div className="muted" style={{ marginBottom: 16 }}>
        {t("Signed in as")} {user.name} · {user.role} · Aurora Studio
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        {cards.length === 0 ? (
          <div className="card card-pad empty" style={{ gridColumn: "1/-1" }}>
            <div className="big material-icons-o">task_alt</div>
            {t("No action cards for you right now.")}
          </div>
        ) : (
          cards.map((tk) => {
            const cand = tk.sourceRef && CASES[tk.sourceRef] ? candidateOf(tk.sourceRef) : null;
            return (
              <Card key={tk.id} className="flex-col gap-2" style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <StatusBadge status={tk.status} />
                  <span className="tiny">{t("Due")} {fmtDateShort(tk.dueAt)}</span>
                </div>
                <div className="task-title">{tk.title}</div>
                <div className="task-sub">{cand ? `${cand.name} · ` : ""}{t(taskTypeSource(tk.type))}</div>
                <div className="tiny">{tk.status === "waiting" ? `${t("Waiting:")} ${tk.waitingReason || ""}` : `${t("Source:")} ${tk.sourceRef || "—"}`}</div>
              </Card>
            );
          })
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <h3>{t("Accessible workspace")}</h3>
        <span className="tiny">{t("As of")} {fmtDate(nowISO(state.clockOffsetMin))} · {t("scope:")} {t("workspace")}</span>
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

      <h3 style={{ marginBottom: 8 }}>{t("Tasks")}</h3>
      <div className="tabs">
        {tabs.map((tb) => (
          <button key={tb.key} className={`tab ${tab === tb.key ? "active" : ""}`} onClick={() => setTab(tb.key)}>
            {t(tb.label)}
          </button>
        ))}
      </div>
      <Card padded={false}>
        {tab === "team" && (
          <div className="banner info" style={{ margin: "12px 12px 0" }}>
            {t("Startup Team Access: any valid employee can open and directly work these tasks — no claiming or manager approval required. The original assignee stays on record and is notified when you act.")}
          </div>
        )}
        {list.length === 0 ? (
          <div className="empty">
            <div className="big material-icons-o">checklist</div>
            {t("Nothing here.")}
          </div>
        ) : (
          list.map((tk) => {
            const cand = tk.sourceRef && CASES[tk.sourceRef] ? candidateOf(tk.sourceRef) : null;
            const ownerName = tab === "team" && tk.assignee ? getUser(tk.assignee as Parameters<typeof getUser>[0])?.name : null;
            return (
              <div key={tk.id} className="task-row">
                <div className="task-main">
                  <div className="task-title">{tk.title}</div>
                  <div className="task-sub">
                    {cand ? `${cand.name} · ` : ""}{t(taskTypeSource(tk.type))}
                    {ownerName ? ` · ${t("Assigned to")} ${ownerName}` : ""} · {t("Due")} {fmtDateShort(tk.dueAt)}
                    {tk.status === "waiting" ? ` · ${tk.waitingReason || ""}` : ""}
                  </div>
                </div>
                <StatusBadge status={tk.status} />
                <div style={{ display: "flex", gap: 8 }}>
                  {tab === "claim" ? (
                    <Button size="sm" variant="primary" onClick={() => claim(tk)}>{t("Claim")}</Button>
                  ) : tk.status === "open" || tk.status === "in_progress" ? (
                    <>
                      {tk.status === "open" && <Button size="sm" onClick={() => start(tk)}>{t("Start")}</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setWaitingTask(tk)}>{t("Wait")}</Button>
                    </>
                  ) : tk.status === "waiting" ? (
                    <Button size="sm" onClick={() => resume(tk)}>{t("Resume")}</Button>
                  ) : null}
                  {tk.assignee && tk.assignee !== uid && <Button size="sm" variant="ghost" onClick={() => assignToMe(tk)}>Assign</Button>}
                  <Button size="sm" variant="ghost" onClick={() => navigate(tk.link)}>{t("Open →")}</Button>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <Modal open={!!waitingTask} onCancel={() => setWaitingTask(null)} onOk={confirmWait} title="Mark task as waiting" okText="Set waiting">
        <div className="field">
          <label>Reason (required)</label>
          <Input.TextArea rows={3} value={waitReason} onChange={(e) => setWaitReason(e.target.value)} placeholder="e.g. Waiting on candidate to resend missing file" />
        </div>
      </Modal>
    </div>
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
