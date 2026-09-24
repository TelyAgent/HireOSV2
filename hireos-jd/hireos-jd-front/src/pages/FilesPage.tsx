import { useSearchParams } from "react-router-dom";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, EmptyState, PageHeader, StatusBadge } from "../components/ui/Primitives";
import { CancelButton, CloseButton, ConfirmDialog, ModalBody, ModalFooter, ModalHeader } from "../components/ui/Overlays";
import { useStore } from "../store/StoreContext";
import { getPerson } from "../data/fixtures/people";
import { daysFromNow, fmtDateTime, fmtRelative, nowISO, uid } from "../lib/format";
import { useStartCreate } from "./NewJobPage";
import type { FileItem } from "../data/types";

const FILE_ICONS: Record<string, string> = { pdf: "picture_as_pdf", docx: "description", image: "image" };
const fileIcon = (kind: string) => FILE_ICONS[kind] || "draft";

type TabKey = "files" | "connections" | "activity";

export function FilesPage() {
  const { t } = useStore();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabKey) || "files";
  const tabs: { key: TabKey; label: string }[] = [
    { key: "files", label: "Files" },
    { key: "connections", label: "Connections" },
    { key: "activity", label: "Activity" },
  ];

  return (
    <MainInner variant="wide">
      <PageHeader
        title={t("Files & Integrations")}
        subtitle={t(
          "Where material comes from, whether it was read successfully, and what happened to it — independent of any one job.",
        )}
        crumbs={[{ label: t("Files & Integrations") }]}
      />
      <div className="underline-tabs">
        {tabs.map((x) => (
          <div key={x.key} className={`u-tab${tab === x.key ? " active" : ""}`} onClick={() => setParams({ tab: x.key })}>
            {t(x.label)}
          </div>
        ))}
      </div>
      {tab === "files" ? <FilesSubtab /> : tab === "connections" ? <ConnectionsSubtab /> : <FileActivitySubtab />}
    </MainInner>
  );
}

/* ---------------------------------------------------------------
   Files
   --------------------------------------------------------------- */
function FilesSubtab() {
  const { state, t, openModal } = useStore();
  const startCreate = useStartCreate();
  const unassigned = state.files.filter((f) => !f.jobId);
  const assigned = state.files.filter((f) => f.jobId);

  const row = (f: FileItem, showAssign: boolean) => (
    <div key={f.id} className="file-row">
      <div className="fr-icon">
        <Icon name={fileIcon(f.kind)} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{f.name}</div>
        <div className="tiny">
          {f.jobId && state.jobs[f.jobId] ? state.jobs[f.jobId].title + " • " : ""}
          {f.size} • {t(f.source)}
          {showAssign && f.uploadedBy ? ` • ${getPerson(f.uploadedBy)?.name}` : ""} • {fmtRelative(f.uploadedAt)}
        </div>
      </div>
      <StatusBadge kind="file_consumption" value={f.consumption} />
      {showAssign && (
        <Button variant="text" size="sm" onClick={() => openModal(<AssignFileModal fileId={f.id} />, { wide: true })}>
          {t("Assign to job")}
        </Button>
      )}
      <Button variant="text" size="sm" onClick={() => openModal(<FilePreviewModal fileId={f.id} />, { wide: true })}>
        {t("Preview")}
      </Button>
    </div>
  );

  return (
    <>
      <div className="page-header">
        <div className="tiny">
          {state.files.length} {t("files")}
        </div>
        <Button size="sm" onClick={() => startCreate("upload")}>
          <Icon name="upload_file" />
          {t("Upload")}
        </Button>
      </div>
      {unassigned.length > 0 && (
        <div className="section-block">
          <div className="section-title" style={{ fontSize: "var(--fs-sm)" }}>
            {t("Unassigned")} ({unassigned.length})
          </div>
          <div className="card">{unassigned.map((f) => row(f, true))}</div>
        </div>
      )}
      <div className="section-block">
        <div className="section-title" style={{ fontSize: "var(--fs-sm)" }}>
          {t("Assigned")} ({assigned.length})
        </div>
        <div className="card">{assigned.map((f) => row(f, false))}</div>
      </div>
    </>
  );
}

export function FilePreviewModal({ fileId }: { fileId: string }) {
  const { state, t, say, closeModal } = useStore();
  const f = state.files.find((x) => x.id === fileId);
  if (!f) return null;
  return (
    <>
      <ModalHeader title={f.name} />
      <ModalBody>
        {f.error ? (
          <div className="error-inline">
            <Icon name="error" />
            {f.error}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 30 }}>
            <Icon name="description" />
            <p className="tiny">{t("Preview not available in this prototype — shows file metadata only.")}</p>
          </div>
        )}
        <div className="tiny" style={{ marginTop: 10 }}>
          {t("Source")}: {t(f.source)} • {t("Size")}: {f.size} • {t("Received")} {fmtRelative(f.uploadedAt)}
        </div>
      </ModalBody>
      <ModalFooter>
        <CloseButton />
        {!f.error && (
          <Button
            variant="primary"
            onClick={() => {
              say(t("Preparing download…"));
              closeModal();
            }}
          >
            {t("Download")}
          </Button>
        )}
      </ModalFooter>
    </>
  );
}

function AssignFileModal({ fileId }: { fileId: string }) {
  const { state, t, mutate, say, closeModal } = useStore();
  const file = state.files.find((x) => x.id === fileId);

  const confirm = (jobId: string) => {
    mutate((draft) => {
      const f = draft.files.find((x) => x.id === fileId);
      if (!f) return;
      f.jobId = jobId;
      f.consumption = "pending";
      draft.tasks = [
        ...draft.tasks,
        {
          id: uid("task"),
          jobId,
          type: "Review imported material",
          title: `Review imported material: ${f.name}`,
          assignee: draft.currentUserId,
          status: "open",
          priority: "normal",
          dueAt: daysFromNow(3, 17),
          createdAt: nowISO(),
        },
      ];
    });
    closeModal();
    say(t("Assigned — a task was created to confirm requirements from this material."));
  };

  return (
    <>
      <ModalHeader title={`${t("Assign to job")}${file ? ` — ${file.name}` : ""}`} />
      <ModalBody>
        {Object.values(state.jobs).map((j) => (
          <div key={j.id} className="list-row" style={{ cursor: "pointer", borderRadius: 8 }} onClick={() => confirm(j.id)}>
            <span style={{ flex: 1 }}>{j.title}</span>
            <StatusBadge kind="hiring_status" value={j.hiringStatus} />
          </div>
        ))}
      </ModalBody>
      <ModalFooter>
        <CancelButton />
      </ModalFooter>
    </>
  );
}

/* ---------------------------------------------------------------
   Connections
   --------------------------------------------------------------- */
function ConnectionsSubtab() {
  const { state, t, mutate, say, openModal } = useStore();

  const setStatus = (id: string, status: "connected" | "paused" | "disconnected", msg: string, type?: "success") => {
    mutate((draft) => {
      const c = draft.connections.find((x) => x.id === id);
      if (c) c.status = status;
    });
    say(t(msg), type ? { type } : undefined);
  };

  const readNow = (id: string) => {
    say(t("Reading now…"));
    setTimeout(() => {
      mutate((draft) => {
        const c = draft.connections.find((x) => x.id === id);
        if (c) c.lastReadAt = nowISO();
        draft.opActivity = [
          {
            id: uid("op"),
            type: "read_run",
            connection: id,
            status: "succeeded",
            at: nowISO(),
            counts: { discovered: 2, matched: 2, succeeded: 2, skipped: 0, failed: 0 },
            actor: "system",
          },
          ...draft.opActivity,
        ];
      });
      say(t("Read complete — 2 new items"), { type: "success" });
    }, 800);
  };

  return (
    <>
      <div className="page-header">
        <div className="tiny">
          {state.connections.length} {t("connections")}
        </div>
        <Button size="sm" onClick={() => openModal(<NewConnectionModal />)}>
          <Icon name="add_link" />
          {t("New connection")}
        </Button>
      </div>
      {state.connections.map((c) => (
        <div key={c.id} className="conn-card">
          <div className="cc-top">
            <div className="cc-icon">
              <Icon name={c.kind === "email" ? "mail" : "folder"} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500 }}>{c.name}</div>
              <div className="tiny">{c.scope}</div>
            </div>
            <StatusBadge kind="connection_status" value={c.status} />
          </div>
          <div className="tiny" style={{ marginBottom: 10 }}>
            {t("Owner")}: {getPerson(c.owner)?.name} • {t("Mode")}: {t(c.mode)} • {t("Last read")}:{" "}
            {c.lastReadAt ? fmtRelative(c.lastReadAt) : t("Never")}{" "}
            {c.nextReadAt ? `• ${t("Next")}: ${fmtDateTime(c.nextReadAt)}` : ""}
          </div>
          <div className="flex gap-8 flex-wrap">
            <Button size="sm" onClick={() => readNow(c.id)}>
              {t("Read now")}
            </Button>
            {c.status === "connected" && (
              <Button variant="text" size="sm" onClick={() => setStatus(c.id, "paused", "Monitoring paused")}>
                {t("Pause")}
              </Button>
            )}
            {c.status === "paused" && (
              <Button
                variant="text"
                size="sm"
                onClick={() => setStatus(c.id, "connected", "Monitoring resumed — resuming from last checkpoint")}
              >
                {t("Resume")}
              </Button>
            )}
            {c.status === "authorization_required" && (
              <Button variant="primary" size="sm" onClick={() => setStatus(c.id, "connected", "Reauthorized", "success")}>
                {t("Reauthorize")}
              </Button>
            )}
            <Button variant="text" size="sm" onClick={() => say(`${t("Preview rule (demo)")}: ${c.scope}`)}>
              {t("Preview rule")}
            </Button>
            <Button
              variant="text"
              size="sm"
              onClick={() =>
                openModal(
                  <ConfirmDialog
                    title={t("Disconnect")}
                    body={t("This stops future reads. Historical activity is kept.")}
                    confirmLabel={t("Disconnect")}
                    danger
                    onConfirm={() => setStatus(c.id, "disconnected", "Disconnected")}
                  />,
                )
              }
            >
              {t("Disconnect")}
            </Button>
          </div>
        </div>
      ))}
    </>
  );
}

function NewConnectionModal() {
  const { t, say, closeModal } = useStore();
  return (
    <>
      <ModalHeader title={t("New connection")} />
      <ModalBody>
        <div className="field">
          <label>{t("Type")}</label>
          <select defaultValue="email">
            <option value="email">{t("Email inbox")}</option>
            <option value="folder">{t("Shared folder")}</option>
          </select>
        </div>
        <div className="field">
          <label>{t("Address / path")}</label>
          <input type="text" placeholder="e.g. hiring@sendinglabs.com" />
        </div>
        <div className="field">
          <label>{t("Start mode")}</label>
          <select defaultValue="new">
            <option value="new">{t("New mail only")}</option>
            <option value="existing">{t("Existing + changes")}</option>
            <option value="full">{t("Full history range")}</option>
          </select>
        </div>
        <div className="info-inline">
          <Icon name="info" />
          {t("Background reading requires a real authorized connector in production. This demo simulates the flow.")}
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button
          variant="primary"
          onClick={() => {
            closeModal();
            say(t("Connection created (demo)"), { type: "success" });
          }}
        >
          {t("Create")}
        </Button>
      </ModalFooter>
    </>
  );
}

/* ---------------------------------------------------------------
   Operation activity
   --------------------------------------------------------------- */
function FileActivitySubtab() {
  const { state, t, mutate, say } = useStore();

  const opTitle = (op: (typeof state.opActivity)[number]) => {
    const conn = state.connections.find((c) => c.id === op.connection)?.name ?? "";
    const file = state.files.find((f) => f.id === op.file)?.name ?? "";
    if (op.type === "read_run") return `${t("Read run on")} ${conn}`;
    if (op.type === "upload") return `${t("Uploaded")} ${file}`;
    if (op.type === "download") return `${t("Download ready")}: ${file}`;
    if (op.type === "consumption_failed") return `${t("Consumption failed")}: ${file}`;
    return op.type;
  };

  const retry = (id: string) => {
    say(t("Retrying failed items…"));
    setTimeout(() => {
      mutate((draft) => {
        const op = draft.opActivity.find((x) => x.id === id);
        if (!op) return;
        if (op.counts) op.counts.failed = 0;
        op.status = "succeeded";
      });
      say(t("Retry succeeded"), { type: "success" });
    }, 700);
  };

  const opIcon = (type: string) =>
    type === "read_run" ? "sync" : type === "upload" ? "upload" : type === "download" ? "download" : "error";

  return (
    <div className="card">
      {state.opActivity.length === 0 ? (
        <EmptyState icon="history" title={t("No activity yet")} />
      ) : (
        state.opActivity.map((op) => (
          <div key={op.id} className="timeline-item" style={{ padding: "14px 16px" }}>
            <div className="ti-icon">
              <Icon name={opIcon(op.type)} />
            </div>
            <div className="ti-body">
              <div className="ti-title">
                {opTitle(op)}{" "}
                <StatusBadge
                  kind="file_consumption"
                  value={
                    op.status === "succeeded"
                      ? "accepted"
                      : op.status === "failed"
                        ? "failed"
                        : op.status === "partially_succeeded"
                          ? "needs_review"
                          : op.status
                  }
                />
              </div>
              <div className="ti-meta">
                {fmtDateTime(op.at)}
                {op.counts
                  ? ` • ${t("discovered")} ${op.counts.discovered}, ${t("matched")} ${op.counts.matched}, ${t("succeeded")} ${op.counts.succeeded}, ${t("skipped")} ${op.counts.skipped}, ${t("failed")} ${op.counts.failed}`
                  : ""}
              </div>
              {op.error && (
                <div className="tiny" style={{ color: "var(--danger-text)", marginTop: 4 }}>
                  {op.error}
                </div>
              )}
              {(op.status === "partially_succeeded" || op.status === "failed") && (
                <Button variant="text" size="sm" style={{ paddingLeft: 0, marginTop: 4 }} onClick={() => retry(op.id)}>
                  {t("Retry failed items")}
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
