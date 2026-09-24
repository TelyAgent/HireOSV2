import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { downloadDelivery, getDelivery, retryDelivery, sendDelivery } from "../data/api/deliveries";
import { getApplication, getCandidate, getEvaluation, getJob } from "../data/db";
import type { Delivery } from "../data/fixtures/deliveries";
import { fmtDateTime, pct } from "../lib/format";
import { Button, EmptyState, PageHeader, scoreDisplay } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { DELIVERY_KIND_LABEL } from "./DeliveriesListPage";

const ELIG_LABEL: Record<string, string> = {
  eligible: "Eligible",
  likely_eligible: "Likely eligible",
  needs_verification: "Needs verification",
  not_eligible: "Not eligible",
};
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function DeliveryActions({ delivery, onChanged }: { delivery: Delivery; onChanged: () => void }) {
  const { t, say } = useStore();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    say(t("Preparing download…"));
    await downloadDelivery(delivery.id);
    say(t("File sent to your browser (demo — no real file transferred)"), { type: "success" });
  };
  const send = async () => {
    setBusy(true);
    say(t("Queued for delivery"));
    onChanged();
    await sendDelivery(delivery.id);
    setBusy(false);
    say(t("Delivered — awaiting confirmation"), { type: "success" });
    onChanged();
  };
  const retry = async () => {
    setBusy(true);
    onChanged();
    await retryDelivery(delivery.id);
    setBusy(false);
    say(t("Delivered"), { type: "success" });
    onChanged();
  };

  if (delivery.kind === "review_only") {
    return (
      <Button variant="secondary" className="w-full" icon="download" onClick={download}>
        {t("Download report")}
      </Button>
    );
  }
  if (delivery.status === "prepared") {
    return (
      <>
        <Button variant="primary" className="w-full" icon="send" onClick={send} disabled={busy}>
          {t("Send (demo)")}
        </Button>
        <Button variant="secondary" className="w-full" style={{ marginTop: 8 }} icon="download" onClick={download}>
          {t("Download instead")}
        </Button>
      </>
    );
  }
  if (delivery.status === "failed") {
    return (
      <>
        <div className="error-inline" style={{ marginBottom: 10 }}>
          <Icon name="error_outline" />
          {t("Delivery failed — mailbox not found.")}
        </div>
        <Button variant="primary" className="w-full" onClick={retry} disabled={busy}>
          {t("Retry delivery")}
        </Button>
      </>
    );
  }
  if (delivery.status === "awaiting_confirmation") {
    return (
      <>
        <p className="tiny" style={{ marginBottom: 10 }}>
          {t("Delivered — no receipt yet. This is shown as “awaiting confirmation,” not as received.")}
        </p>
        <Button variant="secondary" className="w-full" onClick={retry} disabled={busy}>
          {t("Resend")}
        </Button>
      </>
    );
  }
  if (delivery.status === "delivered" || delivery.status === "received") {
    return <p className="tiny">{t("This delivery has completed. Failed items can be retried without re-running the evaluation, link, or invitation.")}</p>;
  }
  return <p className="tiny">{t("In progress…")}</p>;
}

export function DeliveryDetailPage() {
  const { id = "" } = useParams();
  const { t } = useStore();
  const [delivery, setDelivery] = useState<Delivery | null | undefined>(undefined);

  const load = useCallback(() => {
    getDelivery(id)
      .then(setDelivery)
      .catch(() => setDelivery(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (delivery === undefined) return null;
  if (delivery === null) return <EmptyState icon="search_off" title={t("Delivery not found")} />;

  const app = delivery.historical ? null : getApplication(delivery.applicationId!);
  const cand = delivery.historical ? { displayName: delivery.candidateLabel || "—" } : getCandidate(app!.candidateId)!;
  const job = delivery.historical ? { title: delivery.jobLabel || "—" } : getJob(app!.jobId)!;
  const ev = app ? getEvaluation(app.id) : null;

  return (
    <>
      <PageHeader
        title={`${t("Package —")} ${cand.displayName}`}
        subtitle={job.title}
        crumbs={[{ label: t("Deliveries"), href: "/deliveries" }, { label: cand.displayName }]}
        actions={
          <>
            <Link className="btn btn-secondary" to="/deliveries">
              {t("All deliveries")}
            </Link>
            {app && (
              <Link className="btn btn-secondary" to={`/applications/${app.id}`}>
                {t("Open screening")}
              </Link>
            )}
          </>
        }
      />

      <div className="two-col" style={{ gridTemplateColumns: "1fr 320px" }}>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Package preview")}
          </div>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            <strong>{t("Requested action:")}</strong> {t(DELIVERY_KIND_LABEL[delivery.kind] || delivery.kind)}
          </p>
          <p style={{ fontSize: "var(--fs-sm)" }}>
            <strong>{t("Target:", "Target: (delivery)")}</strong> {delivery.targetLabel}
          </p>
          {ev && (
            <p style={{ fontSize: "var(--fs-sm)" }}>
              <strong>{t("Evaluation snapshot:")}</strong> {t("Overall")} {scoreDisplay(ev.overall) == null ? t("Insufficient evidence") : scoreDisplay(ev.overall)}, {t("coverage")} {pct(ev.coverage)},{" "}
              {t("eligibility")} {t(ELIG_LABEL[ev.eligibilityStatus])}
            </p>
          )}
          <p style={{ fontSize: "var(--fs-sm)" }}>
            <strong>{t("Access limitations:")}</strong>{" "}
            {t("Contact details and internal ranking are excluded from candidate-facing content; restricted evidence is redacted for recipients without HR/HM access.")}
          </p>
          {delivery.reviewStatus && (
            <p style={{ fontSize: "var(--fs-sm)" }}>
              <strong>{t("Review status:")}</strong> {t(cap(delivery.reviewStatus.replace(/_/g, " ")))}
            </p>
          )}
          <hr className="divider" />
          <div className="tiny" style={{ fontWeight: 600, marginBottom: 6 }}>
            {t("Manifest")}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
            <li>manifest.json</li>
            <li>payload.json</li>
            <li>report.md ({t("independently readable summary")})</li>
            {delivery.kind !== "review_only" && <li>verification_items.json</li>}
          </ul>
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Timeline")}
          </div>
          <div className="flex-col gap-10">
            {delivery.history.map((h, i) => (
              <div className="flex items-center gap-8" key={i}>
                <span className="dot-indicator" style={{ background: "var(--accent-500)" }} />
                <div>
                  <div style={{ fontSize: "var(--fs-sm)" }}>{t(h.state)}</div>
                  <div className="tiny">{fmtDateTime(h.at, "en")}</div>
                </div>
              </div>
            ))}
          </div>
          <hr className="divider" />
          <DeliveryActions delivery={delivery} onChanged={load} />
        </div>
      </div>
    </>
  );
}
