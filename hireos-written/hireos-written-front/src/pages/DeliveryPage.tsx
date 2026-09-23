import { useState } from "react";
import { useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { PageHeader, Button, EmptyState } from "../components/ui/Primitives";
import { CASES, CORE_CANDIDATES, DELIVERIES, fmtDate, type DeliveryStep } from "../data/fixtures";

export function DeliveryPage() {
  const { id = "" } = useParams();
  const { t, say } = useStore();
  const seed = DELIVERIES[id];
  const [timeline, setTimeline] = useState<DeliveryStep[] | undefined>(seed?.timeline);
  const [status, setStatus] = useState(seed?.status);

  if (!seed) return <EmptyState title="Delivery not found." />;

  const cand = CORE_CANDIDATES[CASES[seed.caseId].candidateId];

  function advance() {
    if (!timeline) return;
    const nextIdx = timeline.findIndex((step) => step.state === "pending");
    if (nextIdx === -1) {
      say("Handoff complete.", { type: "success" });
      return;
    }
    const next = timeline.map((step, i) => (i === nextIdx ? { ...step, state: "done" as const, at: new Date().toISOString() } : step));
    setTimeline(next);
    if (next[nextIdx].label === "Intake received") setStatus("awaiting_ack");
    if (next[nextIdx].label === "Imported") setStatus("imported");
  }

  return (
    <div>
      <PageHeader title={`${t("Handoff to")} ${seed.target}`} crumbs={[{ label: "Assessments", href: "/assessments" }, { label: cand.name }, { label: "Handoff" }]} />
      <div className="muted" style={{ marginBottom: 16 }}>{t("Interview not enabled in this workspace — export still works; nothing here is a real cross-service call.")}</div>

      <div className="card card-pad timeline">
        {(timeline || []).map((step) => (
          <div key={step.label} className="tl-item">
            <div className={`tl-dot ${step.state}`} />
            <div className="tl-line" />
            <div>
              <b>{t(step.label)}</b>
              <div className="tiny">{step.at ? fmtDate(step.at) : step.state === "pending" ? t("Awaiting confirmation") : "—"}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button onClick={advance}>{t("Advance next step (demo)")}</Button>
        <Button onClick={() => say("Report-only package export simulated — no vendor call made.")}>{t("Export report-only package")}</Button>
      </div>
      {status && <div className="tiny" style={{ marginTop: 8 }}>status: {status}</div>}
    </div>
  );
}
