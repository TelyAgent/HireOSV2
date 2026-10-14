import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { downloadDelivery, getDelivery, retryDelivery, sendDelivery } from "../data/api/deliveries";
import { getApplication, getCandidate, getJob } from "../data/db";
import type { Delivery, DeliveryHistoryKey } from "../data/fixtures/deliveries";
import { fmtDateTime, pct } from "../lib/format";
import { Button, EmptyState, PageHeader, scoreDisplay } from "../components/ui/Primitives";
import { Icon } from "../components/ui/Icons";
import { DELIVERY_KIND_LABEL } from "./DeliveriesListPage";
import { PageSkeleton } from "../components/ui/PageSkeleton";

const ELIG_LABEL: Record<string, string> = {
  eligible: "Eligible",
  likely_eligible: "Likely eligible",
  needs_verification: "Needs verification",
  not_eligible: "Not eligible",
};
const DELIVERY_HISTORY_LABEL: Record<DeliveryHistoryKey, string> = {
  package_ready: "Package ready",
  queued: "Queued",
  submitted: "Submitted",
  delivered_awaiting_confirmation: "Delivered (no receipt yet — awaiting confirmation)",
  received: "Received",
  received_imported: "Received / Imported",
};

const ACCESS_LIMITATION_LABEL: Record<string, string> = {
  contact_details_excluded: "Candidate contact details are excluded",
  internal_ranking_excluded: "Internal ranking and comparison notes are excluded",
  restricted_evidence_redacted: "Restricted evidence is redacted",
};
const REVIEW_STATUS_LABEL: Record<string, string> = {
  human_reviewed: "Reviewed — sent on a decision recorded by a person",
  not_reviewed: "Not reviewed",
};

function NotAvailable() {
  const { t } = useStore();
  return <span className="muted">{t("Not available")}</span>;
}

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
  const { t, state } = useStore();
  const [delivery, setDelivery] = useState<Delivery | null | undefined>(undefined);

  const load = useCallback(() => {
    getDelivery(id)
      .then(setDelivery)
      .catch(() => setDelivery(null));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (delivery === undefined) return <PageSkeleton />;
  if (delivery === null) return <EmptyState icon="search_off" title={t("Delivery not found")} />;

  const app = delivery.historical ? null : getApplication(delivery.applicationId!);
  // The delivery carries its own labels; the candidate / job caches may not be filled when arriving from the list.
  const cand = (app && getCandidate(app.candidateId)) || { displayName: delivery.candidateLabel || "—" };
  const job = (app && getJob(app.jobId)) || { title: delivery.jobLabel || "—" };
  const snapshot = delivery.evaluationSnapshot ?? null;

  return (
    <>
      <PageHeader
        title={`${t("Package —")} ${cand.displayName}`}
        subtitle={job.title}
        back="/deliveries"
        actions={
          <>
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
          {/* The five promised items (#22): each one always shows, with an explicit placeholder when empty. */}
          <dl className="package-preview">
            <dt>{t("Requested action:")}</dt>
            <dd>{delivery.requestedAction ? t(DELIVERY_KIND_LABEL[delivery.requestedAction] || delivery.requestedAction) : <NotAvailable />}</dd>
            <dt>{t("Evaluation snapshot:")}</dt>
            <dd>
              {snapshot ? (
                <>
                  <div>
                    {t("Overall")} {scoreDisplay(snapshot.overall) == null ? t("Insufficient evidence") : scoreDisplay(snapshot.overall)} · {t("coverage")} {pct(snapshot.coverage)} · {t("eligibility")}{" "}
                    {snapshot.eligibilityStatus ? t(ELIG_LABEL[snapshot.eligibilityStatus] || snapshot.eligibilityStatus) : "—"}
                  </div>
                  <div className="tiny">
                    {snapshot.version != null ? `v${snapshot.version} · ` : ""}
                    {t("generated")} {fmtDateTime(snapshot.generatedAt, state.lang)} · {t("frozen when this package was created")}
                  </div>
                  {snapshot.dimensionScores.length > 0 && (
                    <ul className="tiny package-dims">
                      {snapshot.dimensionScores.map((d) => (
                        <li key={d.dimensionId || d.name}>
                          {d.name}: {d.status === "evaluated" && d.score != null ? Math.round(d.score) : t("Not evaluated")}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <NotAvailable />
              )}
            </dd>
            <dt>{t("Target:", "Target: (delivery)")}</dt>
            <dd>{delivery.targetLabel || <NotAvailable />}</dd>
            <dt>{t("Access limitations:")}</dt>
            <dd>
              {delivery.accessLimitations?.length ? (
                <ul className="package-dims">
                  {delivery.accessLimitations.map((key) => (
                    <li key={key}>{t(ACCESS_LIMITATION_LABEL[key])}</li>
                  ))}
                </ul>
              ) : (
                <NotAvailable />
              )}
            </dd>
            <dt>{t("Review status:")}</dt>
            <dd>{delivery.reviewStatus ? t(REVIEW_STATUS_LABEL[delivery.reviewStatus] || cap(delivery.reviewStatus.replace(/_/g, " "))) : <NotAvailable />}</dd>
          </dl>
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
                  <div style={{ fontSize: "var(--fs-sm)" }}>{h.key ? t(DELIVERY_HISTORY_LABEL[h.key]) : t(h.state)}</div>
                  <div className="tiny">{fmtDateTime(h.at, state.lang)}</div>
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
