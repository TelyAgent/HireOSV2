import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { listConnections, listActivity } from "../../data/api/files";
import type { Connection } from "../../data/fixtures/connections";
import type { ActivityEntry } from "../../data/fixtures/activity";
import { relTime } from "../../lib/format";
import { Icon } from "../../components/ui/Icons";
import { Badge } from "../../components/ui/Primitives";

export function ApiTab() {
  const { t, state } = useStore();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [events, setEvents] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    listConnections().then((rows) => setConnections(rows.filter((c) => c.kind === "api")));
    listActivity().then((rows) => setEvents(rows.filter((a) => a.op === "API import")));
  }, []);

  return (
    <div className="card card-pad">
      <div className="section-title">{t("Import from API")}</div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        {t("Demo ingestion log — no technical setup required for HR/HM to review what came in via API.")}
      </p>
      {connections.map((c) => (
        <div className="list-row" key={c.id} style={{ padding: "12px 4px" }}>
          <Icon name="api" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 500 }}>{c.name}</div>
            <div className="tiny">
              {c.account} · {c.scope}
            </div>
          </div>
          <Badge tone="success">{t("Connected")}</Badge>
        </div>
      ))}
      <div className="divider" />
      <div className="tiny muted">{t("Recent API ingestion events")}</div>
      {events.map((a) => (
        <div className="list-row" key={a.id} style={{ padding: "8px 4px" }}>
          <Icon name="receipt_long" size={16} />
          <div style={{ flex: 1, fontSize: "var(--fs-sm)" }}>{a.target}</div>
          <span className="tiny">{relTime(a.at, state.lang)}</span>
        </div>
      ))}
    </div>
  );
}
