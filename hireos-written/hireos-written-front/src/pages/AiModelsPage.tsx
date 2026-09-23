import { useStore } from "../store/StoreContext";
import { Badge, PageHeader } from "../components/ui/Primitives";
import { AI_MODEL_TASKS } from "../data/fixtures";

export function AiModelsPage() {
  const { t } = useStore();

  return (
    <div>
      <PageHeader
        title={t("AI Models")}
        crumbs={[{ label: "Settings", href: "/settings" }, { label: "AI Models" }]}
      />
      <div className="banner info" style={{ marginBottom: 16 }}>
        {t("All prices, latency and quality figures are sample data. Order: hard constraints → quality → cost/latency → published preference.")}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t("Task")}</th>
              <th>{t("Primary")}</th>
              <th>{t("Fallback")}</th>
              <th>{t("Budget")}</th>
              <th>{t("Status")}</th>
            </tr>
          </thead>
          <tbody>
            {AI_MODEL_TASKS.map((mt) => (
              <tr key={mt.task}>
                <td className="mono">{mt.task}</td>
                <td>{mt.primary}</td>
                <td>{mt.fallback}</td>
                <td>{mt.budget}</td>
                <td>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <Badge tone={mt.status === "ok" ? "success" : "warning"}>
                      {mt.status === "ok" ? t("Nominal") : t("Fallback active")}
                    </Badge>
                    {mt.note && <span className="tiny">{mt.note}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="tiny" style={{ marginTop: 16 }}>
        {t("Sample data — no real vendor is called by this prototype.")}
      </div>
    </div>
  );
}
