import { useEffect, useState } from "react";
import { compareContacts, contactFacts } from "../features/imports/importOutcome";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../store/StoreContext";
import { getDuplicateReview, resolveDuplicateReview, RESOLUTION_LABEL } from "../data/api/imports";
import type { DuplicateReview, DuplicateResolutionOutcome } from "../data/fixtures/duplicateReviews";
import { getCandidate, getPerson } from "../data/db";
import { fmtDateTime } from "../lib/format";
import { Button, EmptyState, PageHeader } from "../components/ui/Primitives";
import { Modal } from "../components/ui/Overlays";
import { PageSkeleton } from "../components/ui/PageSkeleton";
import { DuplicateReviewDetails } from "../features/duplicates/DuplicateReviewDetails";

const KIND_COPY: Record<string, { title: string; desc: string }> = {
  exact_file: { title: "This file already exists", desc: "File content is byte-identical to a file already on record. It can be reused; this upload is still kept as a new source in history." },
  same_content: { title: "Same résumé content in another format", desc: "The text matches an existing candidate's résumé almost word for word, in a different file format. Identity is not merged automatically." },
  possible_same_person: { title: "Possible duplicate candidate", desc: "Some identity signals match an existing candidate, not enough to be sure. Identity is not merged automatically." },
  new_resume_version: { title: "A newer resume may be available", desc: "The identity signals strongly match an existing candidate. Confirm before this becomes their current version." },
  parse_failed: { title: "Duplicate check incomplete", desc: "The file could not be parsed, so a text-similarity check could not run. This is shown as incomplete — not as “no duplicate found.”" },
};

export function DuplicateDetailPage() {
  const { id = "" } = useParams();
  const { t, state, say } = useStore();
  const [review, setReview] = useState<DuplicateReview | null | undefined>(undefined);
  // The identity decision waiting for its final confirmation (#152); nothing is written until then.
  const [pending, setPending] = useState<ConfirmedOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => getDuplicateReview(id).then(setReview).catch(() => setReview(null));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const resolve = async (outcome: DuplicateResolutionOutcome) => {
    if (submitting) return;
    setSubmitting(true);
    let updated: DuplicateReview;
    try {
      updated = await resolveDuplicateReview(id, outcome, { resolvedBy: state.currentUser });
    } catch {
      say(t("Couldn't save the decision. Try again."), { type: "error" });
      setSubmitting(false);
      return;
    }
    setPending(null);
    setSubmitting(false);
    setReview(updated);
    if (updated.alreadyResolved) {
      say(t("This review had already been handled — showing the decision that stands."));
    } else if (outcome === "defer") {
      say(t("Deferred — you can come back to it later"));
    } else {
      say(t("Duplicate review resolved"), { type: "success" });
    }
  };

  if (review === undefined) return <PageSkeleton />;

  if (review === null) {
    return (
      <EmptyState
        icon="search_off"
        title={t("Duplicate review not found")}
        body={t("This item may have already been resolved.")}
        actions={
          <Link className="btn btn-primary" to="/library">
            {t("Back to Resume Library")}
          </Link>
        }
      />
    );
  }

  if (review.status === "resolved") {
    const resolver = review.resolutionBy ? getPerson(review.resolutionBy) : null;
    return (
      <>
        <PageHeader title={t("Duplicate review — resolved")} back="/library" />
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
  // The same comparison the upload result shows (#154); worked out here for checks stored without one.
  const facts = contactFacts(review.scoring?.contact ?? compareContacts(review.uploaded, review.existing));

  return (
    <>
      <PageHeader title={t("Duplicate review")} subtitle={t(kindCopy.desc)} back="/library" />
      <div className={`badge ${review.kind === "exact_file" ? "badge-neutral" : "badge-warning"}`} style={{ marginBottom: 16, fontSize: "var(--fs-sm)", padding: "6px 14px" }}>
        {t(kindCopy.title)}
      </div>
      {facts.length > 0 && (
        <p className="tiny" style={{ marginTop: -8, marginBottom: 16 }} data-testid="contact-facts">
          {facts.map((fact) => t(fact)).join(state.lang === "zh" ? "；" : "; ")}
        </p>
      )}
      <DuplicateReviewDetails
        review={review}
        t={t}
        lang={state.lang}
        uploaderName={getPerson(review.uploaded.uploadedBy)?.name}
        existingCand={getCandidate(review.existing.candidateId)}
      />
      <div className="page-header" style={{ marginTop: 20 }}>
        <div />
        <div className="actions">
          {review.kind === "exact_file" && (
            <Button variant="primary" onClick={() => resolve("reuse_file")}>
              {t("Use existing file")}
            </Button>
          )}
          {review.kind === "new_resume_version" && (
            <>
              <Button variant="secondary" onClick={() => setPending("different_person")}>
                {t("This is a different person")}
              </Button>
              <Button variant="secondary" onClick={() => resolve("defer")}>
                {t("Defer")}
              </Button>
              <Button variant="primary" onClick={() => setPending("same_person_new_version")}>
                {t("Save as new version")}
              </Button>
            </>
          )}
          {(review.kind === "possible_same_person" || review.kind === "same_content") && (
            <>
              <Button variant="secondary" onClick={() => resolve("defer")}>
                {t("Request more info")}
              </Button>
              <Button variant="secondary" onClick={() => resolve("reuse_file")}>
                {t("Same file content — reuse existing")}
              </Button>
              <Button variant="secondary" onClick={() => setPending("same_person_new_version")}>
                {t("Same person — merge as new version")}
              </Button>
              <Button variant="primary" onClick={() => setPending("different_person")}>
                {t("Different person — keep separate")}
              </Button>
            </>
          )}
        </div>
      </div>
      {pending && (
        <ConfirmIdentityModal
          review={review}
          outcome={pending}
          facts={facts}
          submitting={submitting}
          onCancel={() => setPending(null)}
          onConfirm={() => void resolve(pending)}
        />
      )}
    </>
  );
}

type ConfirmedOutcome = Extract<DuplicateResolutionOutcome, "same_person_new_version" | "different_person">;

/**
 * The last check before an identity decision takes effect (F03 FR-6, #152): which two records, which file and
 * version, and what will happen. Cancel or close leaves the review untouched; Confirm is sent once.
 */
function ConfirmIdentityModal({
  review,
  outcome,
  facts,
  submitting,
  onCancel,
  onConfirm,
}: {
  review: DuplicateReview;
  outcome: ConfirmedOutcome;
  facts: string[];
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t, state } = useStore();
  const existingName = review.existing.name || t("the existing candidate");
  const uploadedName = review.uploaded.name || review.uploaded.fileName;
  const same = outcome === "same_person_new_version";
  const effect = same
    ? t("“%file” is saved as v%next of %name. v%current and earlier versions stay as they are; the profile is read again from the new version.")
        .replace("%file", review.uploaded.fileName)
        .replace("%next", String(review.uploaded.version ?? (review.existing.version ?? 0) + 1))
        .replace("%name", existingName)
        .replace("%current", String(review.existing.version ?? 1))
    : t("A new candidate “%uploaded” is created from “%file”. %name is not changed.")
        .replace("%uploaded", uploadedName)
        .replace("%file", review.uploaded.fileName)
        .replace("%name", existingName);
  return (
    <Modal
      open
      onClose={onCancel}
      title={same ? t("Confirm: same person") : t("Confirm: different person")}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={onConfirm} disabled={submitting} data-testid="confirm-identity">
            {submitting ? t("Saving…") : same ? t("Confirm — save as new version") : t("Confirm — keep separate")}
          </Button>
        </>
      }
    >
      <table className="data-table" data-testid="confirm-sides">
        <thead>
          <tr>
            <th />
            <th>{t("Uploaded now")}</th>
            <th>{t("Existing record")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="tiny">{t("Name")}</td>
            <td>{uploadedName}</td>
            <td>{existingName}</td>
          </tr>
          <tr>
            <td className="tiny">{t("File")}</td>
            <td>{review.uploaded.fileName}</td>
            <td>{review.existing.fileName}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Version")}</td>
            <td>{same && review.uploaded.version != null ? `v${review.uploaded.version}` : t("New")}</td>
            <td>{review.existing.version != null ? `v${review.existing.version}` : "—"}</td>
          </tr>
          <tr>
            <td className="tiny">{t("Uploaded")}</td>
            <td>{fmtDateTime(review.uploaded.uploadedAt, state.lang)}</td>
            <td>{fmtDateTime(review.existing.uploadedAt, state.lang)}</td>
          </tr>
        </tbody>
      </table>
      {facts.length > 0 && (
        <p className="tiny" style={{ marginTop: 8 }}>
          {facts.map((fact) => t(fact)).join(state.lang === "zh" ? "；" : "; ")}
          {review.scoring ? ` · ${t("Total")} ${review.scoring.total}` : ""}
        </p>
      )}
      <p style={{ fontSize: "var(--fs-sm)", marginTop: 12 }} data-testid="confirm-effect">
        <strong>{t("What happens:")}</strong> {effect}
      </p>
    </Modal>
  );
}
