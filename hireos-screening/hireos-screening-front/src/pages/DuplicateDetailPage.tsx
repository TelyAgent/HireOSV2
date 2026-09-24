import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getDuplicateReview, resolveDuplicateReview, retryParse, RESOLUTION_LABEL } from "../data/api/imports";
import type { DuplicateReview, DuplicateResolutionOutcome } from "../data/fixtures/duplicateReviews";
import { getCandidate, getPerson } from "../data/db";
import { fmtDateTime } from "../lib/format";
import { Button, EmptyState, PageHeader } from "../components/ui/Primitives";

const KIND_COPY: Record<string, { title: string; desc: string }> = {
  exact_file: { title: "This file already exists", desc: "File content is byte-identical to a file already on record. It can be reused; this upload is still kept as a new source in history." },
  possible_same_person: { title: "Possible duplicate candidate", desc: "Name and some details match an existing candidate, but contact information differs. Identity is not merged automatically." },
  new_resume_version: { title: "A newer resume may be available", desc: "Contact details match an existing candidate and the content looks newer. Confirm before it becomes the current version." },
  parse_failed: { title: "Duplicate check incomplete", desc: "The file could not be parsed, so a text-similarity check could not run. This is shown as incomplete — not as “no duplicate found.”" },
};

export function DuplicateDetailPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [review, setReview] = useState<DuplicateReview | null | undefined>(undefined);
  const [retrying, setRetrying] = useState(false);

  const load = () => getDuplicateReview(id).then(setReview).catch(() => setReview(null));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resolve = async (outcome: DuplicateResolutionOutcome) => {
    const updated = await resolveDuplicateReview(id, outcome, { resolvedBy: state.currentUser });
    setReview(updated);
    if (outcome === "defer") {
      say(t("Deferred — task remains open"));
    } else {
      say(t("Duplicate review resolved"), { type: "success" });
    }
  };

  const handleRetryParse = async () => {
    setRetrying(true);
    say(t("Retrying parse…"));
    await retryParse(id);
    setRetrying(false);
    say(t("Still unreadable — try a higher-quality scan or a text-based PDF."), { type: "error" });
  };

  if (review === undefined) return null;

  if (review === null) {
    return (
      <EmptyState
        icon="search_off"
        title={t("Duplicate review not found")}
        body={t("This item may have already been resolved.")}
        actions={
          <Link className="btn btn-primary" to="/tasks">
            {t("Back to My Tasks")}
          </Link>
        }
      />
    );
  }

  if (review.status === "resolved") {
    const resolver = review.resolutionBy ? getPerson(review.resolutionBy) : null;
    return (
      <>
        <PageHeader title={t("Duplicate review — resolved")} crumbs={[{ label: t("My Tasks"), href: "/tasks" }, { label: t("Duplicate review") }]} />
        <div className="card card-pad">
          <div className="badge badge-success" style={{ marginBottom: 10 }}>
            {t("Resolved:")} {t(review.resolutionLabel || (review.resolutionOutcome ? RESOLUTION_LABEL[review.resolutionOutcome] : ""))}
          </div>
          <p style={{ fontSize: "var(--fs-sm)" }}>{t(review.resolutionNote || "")}</p>
          <p className="tiny">
            {t("Resolved by")} {resolver?.name} · {fmtDateTime(review.resolutionAt, state.lang)}
          </p>
        </div>
      </>
    );
  }

  const kindCopy = KIND_COPY[review.kind] ?? { title: t("Review needed"), desc: "" };
  const existingCand = getCandidate(review.existing.candidateId);

  return (
    <>
      <PageHeader title={t("Duplicate review")} subtitle={t(kindCopy.desc)} crumbs={[{ label: t("My Tasks"), href: "/tasks" }, { label: t("Duplicate review") }]} />
      <div className={`badge ${review.kind === "exact_file" ? "badge-neutral" : "badge-warning"}`} style={{ marginBottom: 16, fontSize: "var(--fs-sm)", padding: "6px 14px" }}>
        {t(kindCopy.title)}
      </div>
      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Uploaded now")}
          </div>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-lg)", marginBottom: 4 }}>{review.uploaded.fileName}</div>
          <table className="data-table" style={{ marginTop: 10 }}>
            <tbody>
              <tr>
                <td className="tiny">{t("Name")}</td>
                <td>{review.uploaded.name || "—"}</td>
              </tr>
              <tr>
                <td className="tiny">{t("Email")}</td>
                <td>{review.uploaded.email || "—"}</td>
              </tr>
              {review.uploaded.phone && (
                <tr>
                  <td className="tiny">{t("Phone")}</td>
                  <td>{review.uploaded.phone}</td>
                </tr>
              )}
              {review.uploaded.location && (
                <tr>
                  <td className="tiny">{t("Location")}</td>
                  <td>{review.uploaded.location}</td>
                </tr>
              )}
              <tr>
                <td className="tiny">{t("Uploaded")}</td>
                <td>{fmtDateTime(review.uploaded.uploadedAt, state.lang)}</td>
              </tr>
              <tr>
                <td className="tiny">{t("Source")}</td>
                <td>
                  {review.uploaded.source} {t("by")} {getPerson(review.uploaded.uploadedBy)?.name}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="card card-pad">
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            {t("Existing record")}
          </div>
          <div style={{ fontWeight: 500, fontSize: "var(--fs-lg)", marginBottom: 4 }}>
            {existingCand ? <Link to={`/candidates/${existingCand.id}`}>{existingCand.displayName}</Link> : "—"}
          </div>
          <table className="data-table" style={{ marginTop: 10 }}>
            <tbody>
              <tr>
                <td className="tiny">{t("File")}</td>
                <td>{review.existing.fileName}</td>
              </tr>
              <tr>
                <td className="tiny">{t("Email")}</td>
                <td>{review.existing.email || existingCand?.contact.email}</td>
              </tr>
              {(review.existing.phone || existingCand?.contact.phone) && (
                <tr>
                  <td className="tiny">{t("Phone")}</td>
                  <td>{review.existing.phone || existingCand?.contact.phone}</td>
                </tr>
              )}
              <tr>
                <td className="tiny">{t("Location")}</td>
                <td>{review.existing.location || existingCand?.contact.location.value}</td>
              </tr>
              <tr>
                <td className="tiny">{t("Uploaded")}</td>
                <td>{fmtDateTime(review.existing.uploadedAt, state.lang)}</td>
              </tr>
              <tr>
                <td className="tiny">{t("Source")}</td>
                <td>{review.existing.source}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card card-pad" style={{ marginTop: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          {t("Detection basis")}
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
          {review.basis.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
        {typeof review.confidence === "number" && (
          <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
            {t("Match confidence:")} {Math.round(review.confidence * 100)}%
          </p>
        )}
        {review.changeSummary && (
          <p style={{ fontSize: "var(--fs-sm)", marginTop: 10 }}>
            <strong>{t("What changed:")}</strong> {review.changeSummary}
          </p>
        )}
      </div>
      <div className="page-header" style={{ marginTop: 20 }}>
        <div />
        <div className="actions">
          {review.kind === "parse_failed" && (
            <Button variant="secondary" onClick={handleRetryParse} disabled={retrying}>
              {t("Retry parsing")}
            </Button>
          )}
          {review.kind === "exact_file" && (
            <Button variant="primary" onClick={() => resolve("reuse_file")}>
              {t("Use existing file")}
            </Button>
          )}
          {review.kind === "new_resume_version" && (
            <>
              <Button variant="secondary" onClick={() => resolve("different_person")}>
                {t("This is a different person")}
              </Button>
              <Button variant="secondary" onClick={() => resolve("defer")}>
                {t("Defer")}
              </Button>
              <Button variant="primary" onClick={() => resolve("same_person_new_version")}>
                {t("Save as new version")}
              </Button>
            </>
          )}
          {review.kind === "possible_same_person" && (
            <>
              <Button variant="secondary" onClick={() => resolve("defer")}>
                {t("Request more info")}
              </Button>
              <Button variant="secondary" onClick={() => resolve("reuse_file")}>
                {t("Same file content — reuse existing")}
              </Button>
              <Button variant="secondary" onClick={() => resolve("same_person_new_version")}>
                {t("Same person — merge as new version")}
              </Button>
              <Button variant="primary" onClick={() => resolve("different_person")}>
                {t("Different person — keep separate")}
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
