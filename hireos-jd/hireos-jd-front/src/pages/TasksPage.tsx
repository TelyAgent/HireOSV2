import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import {
  Button,
  EmptyState,
  PageHeader,
  PersonChip,
  PriorityBadge,
  StatusBadge,
} from "../components/ui/Primitives";
import { CancelButton, CloseButton, ModalBody, ModalFooter, ModalHeader } from "../components/ui/Overlays";
import { useStore } from "../store/StoreContext";
import { PEOPLE, getPerson } from "../data/fixtures/people";
import { fmtDate, fmtDateTime, fmtRelative, isOverdue } from "../lib/format";
import type { HumanTask } from "../data/types";

const TASK_ICONS: Record<string, string> = {
  "Complete requirements": "edit_note",
  "Resolve conflict": "gavel",
  "Review imported material": "file_present",
  "Review / approve JD": "fact_check",
  "Review public JD": "public",
  "Review downstream impact": "insights",
  "Recover failed operation": "restart_alt",
};
const taskIcon = (type: string) => TASK_ICONS[type] || "task_alt";

type TabKey = "assigned" | "available" | "created" | "completed";

export function TasksPage() {
  const { state, t, openModal } = useStore();
  const [params, setParams] = useSearchParams();
  const activeKey = (params.get("tab") as TabKey) || "assigned";
  const u = state.currentUserId;

  const tabs: { key: TabKey; label: string; list: HumanTask[] }[] = [
    {
      key: "assigned",
      label: "Assigned to me",
      list: state.tasks.filter((x) => x.assignee === u && x.status !== "completed" && x.status !== "cancelled"),
    },
    { key: "available", label: "Available to claim", list: state.tasks.filter((x) => !x.assignee && x.status === "open") },
    {
      key: "created",
      label: "Created or followed",
      list: state.tasks.filter((x) => x.jobId && state.jobs[x.jobId]?.owner === u),
    },
    { key: "completed", label: "Completed", list: state.tasks.filter((x) => x.status === "completed" || x.status === "cancelled") },
  ];
  const active = tabs.find((x) => x.key === activeKey) ?? tabs[0];

  return (
    <MainInner>
      <PageHeader
        title={t("My Tasks")}
        subtitle={t("Completion gaps, conflicts, approvals, impact reviews and recovery — all in one queue.")}
      />
      <div className="underline-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.key}
            className={`u-tab${tab.key === active.key ? " active" : ""}`}
            onClick={() => setParams({ tab: tab.key })}
          >
            {t(tab.label)} <span className="cnt">{tab.list.length}</span>
          </div>
        ))}
      </div>
      <div className="card">
        {active.list.length === 0 ? (
          <EmptyState
            icon="task_alt"
            title={t("Nothing here")}
            body={
              active.key === "available"
                ? t("No unassigned tasks are waiting to be claimed right now.")
                : t("No tasks in this view.")
            }
          />
        ) : (
          active.list.map((task) => {
            const job = task.jobId ? state.jobs[task.jobId] : null;
            const overdue = isOverdue(task.dueAt) && task.status !== "completed";
            return (
              <div key={task.id} className="task-row" onClick={() => openModal(<TaskModal taskId={task.id} />, { wide: true })}>
                <div className="tr-icon">
                  <Icon name={taskIcon(task.type)} />
                </div>
                <div className="tr-body">
                  <div className="tr-title">{t(task.title, `task.${task.id}`)}</div>
                  <div className="tr-meta">
                    {job ? job.title + " • " : ""}
                    {t(task.type)}
                    {task.status === "waiting" ? ` • ${t("Waiting")}: ${task.waitingReason || ""}` : ""}
                  </div>
                </div>
                <div className="flex gap-6 items-center">
                  <PriorityBadge value={task.priority} />
                  <StatusBadge kind="task_status" value={task.status} />
                  <span className="tiny" style={{ minWidth: 90, textAlign: "right" }}>
                    {task.dueAt ? (
                      overdue ? (
                        <span style={{ color: "var(--danger-text)" }}>{t("Overdue")}</span>
                      ) : (
                        `${t("Due")} ${fmtDate(task.dueAt)}`
                      )
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </MainInner>
  );
}

/* ---------------------------------------------------------------
   Task detail modal + actions
   --------------------------------------------------------------- */
function TaskModal({ taskId }: { taskId: string }) {
  const { state, t, mutate, say, openModal, closeModal } = useStore();
  const navigate = useNavigate();
  const task = state.tasks.find((x) => x.id === taskId);
  if (!task) return null;
  const job = task.jobId ? state.jobs[task.jobId] : null;
  const canClaim = !task.assignee && task.status === "open";
  const isMine = task.assignee === state.currentUserId;

  const update = (fn: (task: HumanTask) => void, toastMsg: string) => {
    mutate((draft) => {
      const target = draft.tasks.find((x) => x.id === taskId);
      if (target) fn(target);
    });
    closeModal();
    say(t(toastMsg));
  };

  return (
    <>
      <ModalHeader title={t(task.title, `task.${task.id}`)} />
      <ModalBody>
        <div className="flex gap-8" style={{ marginBottom: 12 }}>
          <StatusBadge kind="task_status" value={task.status} />
          <PriorityBadge value={task.priority} />
          {job && <span className="tag">{job.title}</span>}
        </div>
        <div className="field">
          <label>{t("Required action")}</label>
          <div style={{ fontSize: "var(--fs-sm)" }}>
            {t(task.type)}
            {job ? ` — ${job.title}` : ""}.
          </div>
        </div>
        <div className="field">
          <label>{t("Assignee")}</label>
          <div>
            {task.assignee ? (
              <PersonChip id={task.assignee} />
            ) : task.queue ? (
              <span className="tiny">
                {t("Queue")}: {t(task.queue)}
              </span>
            ) : (
              <span className="tiny">{t("Unassigned")}</span>
            )}
          </div>
        </div>
        {task.status === "waiting" && (
          <div className="warning-inline" style={{ marginBottom: 12 }}>
            <Icon name="hourglass_top" />
            {task.waitingReason || t("Waiting")}
          </div>
        )}
        <div className="field">
          <label>{t("Due")}</label>
          <div className="tiny">{task.dueAt ? fmtDateTime(task.dueAt) : t("No due date")}</div>
        </div>
        {job && (
          <div className="field">
            <label>{t("Timeline")}</label>
            <div className="tiny">
              {t("Created")} {fmtRelative(task.createdAt)}
              {task.completedAt ? ` • ${t("Completed")} ${fmtRelative(task.completedAt)}` : ""}
            </div>
          </div>
        )}
      </ModalBody>
      <ModalFooter spread>
        <div className="flex gap-8">
          {canClaim && (
            <Button
              onClick={() =>
                update((x) => {
                  x.assignee = state.currentUserId;
                  x.status = "in_progress";
                }, "Task claimed")
              }
            >
              {t("Claim")}
            </Button>
          )}
          {isMine && task.status === "open" && (
            <Button onClick={() => update((x) => void (x.status = "in_progress"), "Task started")}>{t("Start")}</Button>
          )}
          {isMine && ["open", "in_progress"].includes(task.status) && (
            <Button
              variant="text"
              onClick={() => {
                closeModal();
                openModal(<DeferTaskModal taskId={taskId} />);
              }}
            >
              {t("Defer")}
            </Button>
          )}
          {isMine && task.status === "waiting" && (
            <Button
              onClick={() =>
                update((x) => {
                  x.status = "in_progress";
                  x.waitingReason = null;
                }, "Task resumed")
              }
            >
              {t("Resume")}
            </Button>
          )}
          {isMine && task.status !== "completed" && (
            <Button
              variant="text"
              onClick={() => {
                closeModal();
                openModal(<ReassignTaskModal taskId={taskId} />);
              }}
            >
              {t("Reassign")}
            </Button>
          )}
        </div>
        <div className="flex gap-8">
          <CloseButton />
          {job && (
            <Button
              variant="primary"
              onClick={() => {
                closeModal();
                navigate(`/jobs/${job.id}`);
              }}
            >
              {t("Open job")}
            </Button>
          )}
        </div>
      </ModalFooter>
    </>
  );
}

function DeferTaskModal({ taskId }: { taskId: string }) {
  const { t, mutate, say, closeModal } = useStore();
  const [reason, setReason] = useState("");
  const confirm = () => {
    mutate((draft) => {
      const target = draft.tasks.find((x) => x.id === taskId);
      if (target) {
        target.status = "waiting";
        target.waitingReason = reason || t("Waiting on additional input.");
      }
    });
    closeModal();
    say(t("Task deferred"));
  };
  return (
    <>
      <ModalHeader title={t("Defer task")} />
      <ModalBody>
        <div className="field">
          <label>{t("Reason")}</label>
          <textarea
            placeholder={t("Why is this waiting, and on what?")}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={confirm}>
          {t("Defer")}
        </Button>
      </ModalFooter>
    </>
  );
}

function ReassignTaskModal({ taskId }: { taskId: string }) {
  const { t, mutate, say, closeModal } = useStore();
  const confirm = (personId: string) => {
    mutate((draft) => {
      const target = draft.tasks.find((x) => x.id === taskId);
      if (target) {
        target.assignee = personId;
        target.status = "open";
      }
    });
    closeModal();
    say(`${t("Reassigned to")} ${getPerson(personId)?.name}. ${t("Reassigning does not grant new data access.")}`);
  };
  return (
    <>
      <ModalHeader title={t("Reassign task")} />
      <ModalBody>
        {Object.values(PEOPLE).map((p) => (
          <div key={p.id} className="list-row" style={{ cursor: "pointer", borderRadius: 8 }} onClick={() => confirm(p.id)}>
            <PersonChip id={p.id} />
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <CancelButton />
      </ModalFooter>
    </>
  );
}
