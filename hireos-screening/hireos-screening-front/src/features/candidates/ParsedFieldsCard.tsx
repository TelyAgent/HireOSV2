import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import type { FieldEvidence, ProfileField } from "../../data/fixtures/candidates";
import { parsedFieldRows } from "./parsedFieldRows";
import { SourceMaterialModal } from "./SourceMaterialModal";

/**
 * Every profile field from the résumé (F02, #155): its value, whether it is known, not provided or only partly
 * read, and where it was found — clicking a location opens the source at that paragraph. Without a usable
 * location it says why instead of linking.
 */
export function ParsedFieldsCard({ fields }: { fields: ProfileField[] }) {
  const { t, state } = useStore();
  const [open, setOpen] = useState<FieldEvidence | null>(null);

  return (
    <div className="card card-pad" data-testid="parsed-fields">
      <div className="section-title">{t("Parsed fields")}</div>
      <ParsedFieldsTable fields={fields} t={t} lang={state.lang} onOpen={setOpen} />
      {open && <SourceMaterialModal materialId={open.materialId} segmentId={open.segmentId} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** The table itself, from the candidate API's `profileFields` alone: what the card renders, and what tests render. */
export function ParsedFieldsTable({
  fields,
  t,
  lang,
  onOpen,
}: {
  fields: ProfileField[];
  t: (text: string, context?: string) => string;
  lang: "en" | "zh";
  onOpen: (evidence: FieldEvidence) => void;
}) {
  return (
    <table className="data-table parsed-fields">
      <thead>
        <tr>
          <th>{t("Field")}</th>
          <th>{t("Value")}</th>
          <th>{t("Status")}</th>
          <th>{t("Found in")}</th>
        </tr>
      </thead>
      <tbody>
        {parsedFieldRows(fields, lang).map((row) => (
          <tr key={row.field} data-field={row.field} data-status={fields.find((f) => f.field === row.field)?.status}>
            <td>{t(row.label)}</td>
            <td>
              {row.values.length ? (
                <ul className="parsed-values">
                  {row.values.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              ) : (
                <span className="muted">{t("Not provided")}</span>
              )}
            </td>
            <td>
              <span className={`badge ${row.status.badge}`}>{t(row.status.label)}</span>
              {row.missing.length > 0 && (
                <div className="tiny">
                  {t("Missing:")} {row.missing.map((m) => t(m)).join(", ")}
                </div>
              )}
              {row.correctedByPerson && <div className="tiny">{t("Corrected by a person")}</div>}
              {row.fromRecord && <div className="tiny">{t("From the candidate record — this version didn't record it")}</div>}
            </td>
            <td>
              {row.links.map((link) => (
                <button
                  key={link.evidence.segmentId}
                  type="button"
                  className="link-btn evidence-link"
                  title={link.evidence.quote}
                  data-segment-id={link.evidence.segmentId}
                  onClick={() => onOpen(link.evidence)}
                >
                  {link.label}
                </button>
              ))}
              {row.notes.map((note, i) => (
                <span key={i} className="tiny" style={{ display: "block" }} data-testid="evidence-note">
                  {t(note.text)}
                  {note.values ? ` ${note.values.join(", ")}` : ""}
                </span>
              ))}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
