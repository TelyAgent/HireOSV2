import { useState } from "react";
import { useStore } from "../store/StoreContext";
import { Badge, Button, Card, PageHeader, Tabs } from "../components/ui/Primitives";
import { StatusBadge } from "../utils/status";
import { ATTEMPTS, CORE_FILES, FILES_LIST, FILE_CONNECTIONS, ACTIVITY, fmtDate, timeAgo, nowISO, type FileConnection } from "../data/fixtures";

type TabKey = "files" | "connections" | "activity";

function usedByFor(fileId: string): string {
  if (Object.values(ATTEMPTS).some((a) => a.fileRef === fileId)) return "Attempt";
  if (fileId.startsWith("core_file_q")) return "Question material";
  return "Unassigned";
}

export function FilesPage() {
  const { t } = useStore();
  const [tab, setTab] = useState<TabKey>("files");

  return (
    <div>
      <PageHeader title={t("Files & Integrations")} />
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "files", label: "Files" },
          { value: "connections", label: "Connections" },
          { value: "activity", label: "Activity" },
        ]}
      />
      {tab === "files" && <FilesTab />}
      {tab === "connections" && <ConnectionsTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

function FilesTab() {
  const { t } = useStore();
  return (
    <div>
      <div className="card card-pad" style={{ borderStyle: "dashed", textAlign: "center", marginBottom: 16, color: "var(--text-secondary)" }}>
        {t("Drag files here, or")} <a style={{ cursor: "pointer", color: "var(--accent)" }}>{t("browse")}</a> {t("— registers a FileVersion, not a per-module copy.")}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("File")}</th>
              <th>{t("Version")}</th>
              <th>{t("Size")}</th>
              <th>{t("Status")}</th>
              <th>{t("Used by")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {FILES_LIST.map((fid) => {
              const f = CORE_FILES[fid];
              const v = f.versions[0];
              return (
                <tr key={fid}>
                  <td>{f.name}</td>
                  <td>v{v.ver}</td>
                  <td>{v.size}</td>
                  <td><StatusBadge status={v.status} /></td>
                  <td>{t(usedByFor(fid))}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Button size="sm" variant="ghost">{t("Preview")}</Button>
                      <Button size="sm" variant="ghost">{t("Download")}</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConnectionsTab() {
  const { t, state, say } = useStore();
  const [connections, setConnections] = useState<FileConnection[]>(FILE_CONNECTIONS);

  function reauthorize(id: string) {
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, status: "connected", lastSync: nowISO(state.clockOffsetMin) } : c)));
    say("Reauthorized.", { type: "success" });
  }
  function readNow(id: string) {
    setConnections((prev) => prev.map((c) => (c.id === id ? { ...c, lastSync: nowISO(state.clockOffsetMin) } : c)));
    say("Checked for new items — 0 new.");
  }
  function pause() {
    say("Connection paused (demo).");
  }

  return (
    <div>
      {connections.map((c) => (
        <Card key={c.id} className="flex items-center justify-between" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div>
            <b>{c.name}</b>
            <div className="tiny">{c.kind} · {c.scope} · {t("last sync")} {timeAgo(c.lastSync, state.clockOffsetMin)}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {c.status === "auth_required" ? (
              <>
                <Button size="sm" variant="primary" onClick={() => reauthorize(c.id)}>{t("Reauthorize")}</Button>
                <Badge tone="warning">{t("Auth required")}</Badge>
              </>
            ) : (
              <>
                <Button size="sm" onClick={() => readNow(c.id)}>{t("Read now")}</Button>
                <Button size="sm" variant="ghost" onClick={pause}>{t("Pause")}</Button>
                <Badge tone="success">{t("Connected")}</Badge>
              </>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function ActivityTab() {
  return (
    <Card padded={false}>
      {ACTIVITY.map((a, i) => (
        <div key={i} className="task-row">
          <div className="task-main">
            <div className="task-sub">{fmtDate(a.at)}</div>
            <div>{a.text}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}
