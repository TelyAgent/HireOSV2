import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { listDeliveries } from "../data/api/deliveries";
import { getApplication, getCandidate, getJob } from "../data/db";
import type { Delivery } from "../data/fixtures/deliveries";
import { fmtDate } from "../lib/format";
import { Badge, PageHeader } from "../components/ui/Primitives";

export const DELIVERY_KIND_LABEL: Record<string, string> = {
  create_assessment: "Send Assessment",
  create_interview: "Move to Interview",
  review_only: "Review-only report",
};
export const DELIVERY_STATUS_LABEL: Record<string, string> = {
  prepared: "Package ready",
  queued: "Queued",
  submitted: "Submitted",
  delivered: "Delivered",
  awaiting_confirmation: "Delivered — awaiting confirmation",
  failed: "Failed",
  received: "Received / Imported",
};
export const DELIVERY_STATUS_TONE: Record<string, "outline" | "info" | "success" | "warning" | "danger"> = {
  prepared: "outline",
  queued: "info",
  submitted: "info",
  delivered: "success",
  awaiting_confirmation: "warning",
  failed: "danger",
  received: "success",
};

function deliverySubjects(d: Delivery) {
  if (d.historical) return { candidateName: d.candidateLabel || "—", jobTitle: d.jobLabel || "—" };
  const app = getApplication(d.applicationId!);
  if (!app) return { candidateName: "—", jobTitle: "—" };
  return { candidateName: getCandidate(app.candidateId)?.displayName || "—", jobTitle: getJob(app.jobId)?.title || "—" };
}

export function DeliveriesListPage() {
  const { t } = useStore();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Delivery[]>([]);

  useEffect(() => {
    listDeliveries().then(setRows);
  }, []);

  return (
    <>
      <PageHeader
        title={t("Packages & Delivery")}
        subtitle={t("Every prepared, sent, delivered and received package — including reports that were never routed anywhere.")}
        crumbs={[{ label: t("Jobs"), href: "/jobs" }, { label: t("Deliveries") }]}
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("Candidate")}</th>
              <th>{t("Job")}</th>
              <th>{t("Kind")}</th>
              <th>{t("Transport")}</th>
              <th>{t("Status")}</th>
              <th>{t("Created")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => {
              const { candidateName, jobTitle } = deliverySubjects(d);
              return (
                <tr className="clickable" key={d.id} onClick={() => navigate(`/deliveries/${d.id}`)}>
                  <td>{candidateName}</td>
                  <td className="tiny">{jobTitle}</td>
                  <td>{t(DELIVERY_KIND_LABEL[d.kind] || d.kind)}</td>
                  <td className="tiny">{d.transport || "—"}</td>
                  <td>
                    <Badge tone={DELIVERY_STATUS_TONE[d.status]}>{t(DELIVERY_STATUS_LABEL[d.status] || d.status)}</Badge>
                  </td>
                  <td className="tiny">{fmtDate(d.createdAt, "en")}</td>
                  <td className="text-right">
                    <a
                      className="btn btn-sm btn-secondary"
                      href={`/deliveries/${d.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/deliveries/${d.id}`);
                      }}
                    >
                      {t("Open", "Open (action)")}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
