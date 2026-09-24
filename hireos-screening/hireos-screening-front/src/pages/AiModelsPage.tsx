import { useEffect, useState } from "react";
import { useStore } from "../store/StoreContext";
import { getAiModels } from "../data/api/aiModels";
import type { AiModelsData } from "../data/fixtures/aiModels";
import { relTime } from "../lib/format";
import { Badge, PageHeader, UnderlineTabs } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function AiCatalog({ M }: { M: AiModelsData }) {
  const { t } = useStore();
  return (
    <>
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Provider")}</th>
              <th>{t("Model")}</th>
              <th>{t("Status")}</th>
              <th>{t("Region")}</th>
              <th>{t("Data class")}</th>
            </tr>
          </thead>
          <tbody>
            {M.catalog.map((m) => (
              <tr key={m.id}>
                <td className="tiny">{m.provider}</td>
                <td>{m.model}</td>
                <td>{m.status === "active" ? <Badge tone="success">{t("Active")}</Badge> : <Badge tone="outline">{t("Not evaluated")}</Badge>}</td>
                <td className="tiny">{m.region.toUpperCase()}</td>
                <td className="tiny">{t(cap(m.dataClass))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny" style={{ marginTop: 10 }}>
        {t("All pricing, latency and quality figures in this section are sample data for the prototype.")}
      </p>
    </>
  );
}

function AiPolicies({ M }: { M: AiModelsData }) {
  const { t } = useStore();
  const modelName = (id: string | null) => (id ? M.catalog.find((m) => m.id === id)?.model || "—" : "—");
  return (
    <div className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("Task type")}</th>
            <th>{t("Primary model")}</th>
            <th>{t("Fallback")}</th>
            <th>{t("Monthly budget")}</th>
            <th>{t("Quality gate")}</th>
          </tr>
        </thead>
        <tbody>
          {M.taskPolicies.map((p) => (
            <tr key={p.taskType}>
              <td>{p.taskType}</td>
              <td className="tiny">{modelName(p.primary)}</td>
              <td className="tiny">{modelName(p.fallback)}</td>
              <td>${p.budgetMonthly}</td>
              <td>{p.qualityGate === "passed" ? <Badge tone="success">{t("Passed")}</Badge> : <Badge tone="warning">{t("Needs review")}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AiUsage({ M }: { M: AiModelsData }) {
  const { t } = useStore();
  return (
    <div className="card">
      <table className="data-table">
        <thead>
          <tr>
            <th>{t("Task type")}</th>
            <th>{t("Calls (30d, sample)")}</th>
            <th>{t("P95 latency")}</th>
            <th>{t("Cost (sample)")}</th>
          </tr>
        </thead>
        <tbody>
          {M.usage.map((u) => (
            <tr key={u.taskType}>
              <td>{u.taskType}</td>
              <td>{u.calls30d}</td>
              <td>{u.p95LatencyMs} ms</td>
              <td>${u.costUsd.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const EVENT_ICON: Record<string, string> = { fallback: "swap_horiz", budget: "account_balance_wallet", region_blocked: "block", quality: "fact_check" };
function AiActivity({ M }: { M: AiModelsData }) {
  return (
    <div className="card">
      {M.events.map((e) => (
        <div className="list-row" style={{ padding: "12px 16px" }} key={e.id}>
          <Icon name={EVENT_ICON[e.type] || "info"} />
          <div style={{ flex: 1, fontSize: "var(--fs-sm)" }}>{e.detail}</div>
          <span className="tiny">{relTime(e.at, "en")}</span>
        </div>
      ))}
    </div>
  );
}

type AiTab = "catalog" | "policies" | "usage" | "activity";

export function AiModelsPage() {
  const { t } = useStore();
  const [tab, setTab] = useState<AiTab>("catalog");
  const [models, setModels] = useState<AiModelsData | null>(null);

  useEffect(() => {
    getAiModels().then(setModels);
  }, []);

  if (!models) return null;

  return (
    <>
      <PageHeader
        title={t("AI Models")}
        subtitle={t("Model routing, budgets and quality gates for every AI-assisted task in Screening.")}
        crumbs={[{ label: t("Settings"), href: "/settings/preferences" }, { label: t("AI Models") }]}
      />
      <UnderlineTabs
        tabs={[
          { key: "catalog", label: t("Catalog") },
          { key: "policies", label: t("Task policies") },
          { key: "usage", label: t("Usage") },
          { key: "activity", label: t("Activity") },
        ]}
        active={tab}
        onChange={setTab}
      />
      {tab === "catalog" && <AiCatalog M={models} />}
      {tab === "policies" && <AiPolicies M={models} />}
      {tab === "usage" && <AiUsage M={models} />}
      {tab === "activity" && <AiActivity M={models} />}
    </>
  );
}
