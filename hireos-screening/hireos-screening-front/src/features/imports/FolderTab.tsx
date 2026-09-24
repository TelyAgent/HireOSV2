import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { listConnections, readNowConnection, pauseConnection } from "../../data/api/files";
import type { Connection } from "../../data/fixtures/connections";
import { relTime } from "../../lib/format";
import { Icon } from "../../components/ui/Icons";
import { Badge, Button } from "../../components/ui/Primitives";

export function FolderTab() {
  const { t, say, state } = useStore();
  const [connections, setConnections] = useState<Connection[]>([]);

  const load = () => listConnections().then((rows) => setConnections(rows.filter((c) => c.kind === "folder")));
  useEffect(() => {
    load();
  }, []);

  const readNow = async (id: string) => {
    const c = await readNowConnection(id);
    say(`${c.name}: ${t("read now — 1 new item found")}`, { type: "success" });
    load();
  };
  const togglePause = async (c: Connection) => {
    await pauseConnection(c.id);
    say(c.status === "watching" ? t("Paused monitoring — previously received materials are kept") : t("Resumed monitoring"));
    load();
  };

  return (
    <div className="card card-pad">
      <div className="section-title">{t("Import from folder")}</div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Folder connections can watch continuously or be read on demand. A file that’s still being written waits until it’s stable before it’s read.")}
      </p>
      {connections.map((c) => (
        <div className="list-row" key={c.id} style={{ padding: "12px 4px" }}>
          <Icon name="folder" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div className="tiny">
              {c.account} · {c.scope} · {t("Last read")} {relTime(c.lastRead, state.lang)}
            </div>
          </div>
          <Badge tone={c.status === "watching" ? "success" : "neutral"}>{c.status === "watching" ? t("Watching") : t("Pause")}</Badge>
          <Button variant="secondary" size="sm" onClick={() => readNow(c.id)}>
            {t("Read now")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => togglePause(c)}>
            {t("Pause")}
          </Button>
        </div>
      ))}
    </div>
  );
}
