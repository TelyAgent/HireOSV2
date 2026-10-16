import { Link } from "react-router-dom";
import { sourceLabel } from "../imports/sources";
import type { DuplicateReview } from "../../data/fixtures/duplicateReviews";
import { fmtDateTime } from "../../lib/format";

/** The existing candidate as the page knows it locally, for values the review didn't record. */
export type ExistingFallback = { displayName?: string; contact: { email?: string; phone?: string; location: { value?: string } } } | null | undefined;

/**
 * What a duplicate review shows of the two résumés (#151 AC-3): each side's file, contact, upload time, source and
 * version, the existing jobs and education, every scored signal with its points, the total and the scoring policy,
 * and the paragraphs only one side has. Pure: everything comes in through props, so it can be rendered in tests.
 */
export function DuplicateReviewDetails({
  review,
  t,
  lang,
  uploaderName,
  existingCand,
}: {
  review: DuplicateReview;
  t: (text: string, context?: string) => string;
  lang: "en" | "zh";
  uploaderName?: string;
  existingCand?: ExistingFallback;
}) {
  return (
    <>
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
                  <td>{fmtDateTime(review.uploaded.uploadedAt, lang)}</td>
                </tr>
                {review.uploaded.version != null && (
                  <tr>
                    <td className="tiny">{t("Version")}</td>
                    <td>{t("Would become v%s if confirmed").replace("%s", String(review.uploaded.version))}</td>
                  </tr>
                )}
                <tr>
                  <td className="tiny">{t("Source")}</td>
                  <td>
                    {t(sourceLabel(review.uploaded.source))} {t("by")} {uploaderName}
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
              {review.existing.candidateId ? (
                <Link to={`/candidates/${review.existing.candidateId}`}>{review.existing.name || existingCand?.displayName || t("Open candidate")}</Link>
              ) : (
                "—"
              )}
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
                  <td>{fmtDateTime(review.existing.uploadedAt, lang)}</td>
                </tr>
                <tr>
                  <td className="tiny">{t("Source")}</td>
                  <td>{t(sourceLabel(review.existing.source))}</td>
                </tr>
                {review.existing.version != null && (
                  <tr>
                    <td className="tiny">{t("Version")}</td>
                    <td>v{review.existing.version}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {(review.existing.employment?.length || review.existing.education?.length) ? (
              <div style={{ marginTop: 10 }} data-testid="existing-history">
                {review.existing.employment?.map((e, i) => (
                  <div className="tiny" key={`e${i}`}>
                    {[e.title, e.company].filter(Boolean).join(" · ")} {e.start || e.end ? `(${e.start || "?"} – ${e.end || "?"})` : ""}
                  </div>
                ))}
                {review.existing.education?.map((e, i) => (
                  <div className="tiny" key={`d${i}`}>
                    {[e.school, e.degree, e.major].filter(Boolean).join(" · ") || e.statement} {e.period ? `(${e.period})` : ""}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="card card-pad" style={{ marginTop: 16 }} data-testid="detection-basis">
          <div className="eyebrow" style={{ marginBottom: 8 }}>
            {t("Detection basis")}
          </div>
          {review.scoring ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("Signal")}</th>
                    <th style={{ width: 80, textAlign: "right" }}>{t("Points")}</th>
                  </tr>
                </thead>
                <tbody>
                  {review.scoring.signals.map((signal) => (
                    <tr key={signal.key} data-signal={signal.key}>
                      <td>{signal.detail}</td>
                      <td style={{ textAlign: "right", color: signal.points < 0 ? "var(--danger-text)" : undefined }}>
                        {signal.points > 0 ? `+${signal.points}` : signal.points}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>{t("Total")}</strong>{" "}
                      <span className="tiny muted">
                        {t("≥ 70 likely a new version · 40–69 needs review · under 40 no prompt. Nothing is merged without you.")}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }} data-testid="score-total">
                      <strong>{review.scoring.total}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
              <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
                {t("Scoring policy:")} {review.scoring.policyVersion}
              </p>
            </>
          ) : (
            <>
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
            </>
          )}
          {review.changeSummary && (
            <p style={{ fontSize: "var(--fs-sm)", marginTop: 10 }}>
              <strong>{t("What changed:")}</strong> {review.changeSummary}
            </p>
          )}
        </div>
        {review.differences && (
          <div className="card card-pad" style={{ marginTop: 16 }} data-testid="resume-differences">
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              {t("Résumé differences")}
            </div>
            <p className="tiny muted" style={{ marginTop: 0 }}>
              {t("%s paragraphs are the same in both.").replace("%s", String(review.differences.unchanged))}
            </p>
            <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <div className="tiny" style={{ marginBottom: 4 }}>{t("Only in this upload")}</div>
                {review.differences.added.length ? (
                  review.differences.added.map((text, i) => (
                    <div key={i} className="diff-added">{text}</div>
                  ))
                ) : (
                  <span className="tiny muted">{t("Nothing new")}</span>
                )}
              </div>
              <div>
                <div className="tiny" style={{ marginBottom: 4 }}>{t("Only in the existing résumé")}</div>
                {review.differences.removed.length ? (
                  review.differences.removed.map((text, i) => (
                    <div key={i} className="diff-removed">{text}</div>
                  ))
                ) : (
                  <span className="tiny muted">{t("Nothing removed")}</span>
                )}
              </div>
            </div>
          </div>
        )}
    </>
  );
}
