import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import type { FieldEvidence, ProfileField } from "../../data/fixtures/candidates";
import { SourceMaterialModal } from "./SourceMaterialModal";

export const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  employment_history: "Work experience",
  education: "Education",
  skills: "Skills",
  languages: "Languages",
  certifications: "Certifications",
  projects: "Projects",
  compensation_expectation: "Salary expectation",
  availability: "Availability",
};

const INCOMPLETE_LABELS: Record<string, string> = {
  dates: "dates",
  company: "company",
  title: "title",
  description: "description",
  currency: "currency",
  period: "pay period",
  country: "country",
  city: "city",
  school: "school",
  degree: "degree",
  major: "major",
  to_confirm: "to be confirmed — taken from the file name",
};

const STATUS: Record<ProfileField["status"], { label: string; badge: string }> = {
  known: { label: "Known", badge: "badge-success" },
  missing: { label: "Not provided", badge: "badge-outline" },
  partial: { label: "Partly read", badge: "badge-warning" },
};

/** "Page 2 · paragraph 4", or "Paragraph 4" for files without pages. */
export function evidenceLabel(e: FieldEvidence, lang: string) {
  if (lang === "zh") return `v${e.resumeVersion} · ${e.page != null ? `第 ${e.page} 页 · ` : ""}第 ${e.paragraph} 段`;
  return `v${e.resumeVersion} · ${e.page != null ? `page ${e.page} · ` : ""}paragraph ${e.paragraph}`;
}

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
          {fields.map((f) => (
            <tr key={f.field} data-field={f.field} data-status={f.status}>
              <td>{t(PROFILE_FIELD_LABELS[f.field] ?? f.field)}</td>
              <td>
                {f.values.length ? (
                  <ul className="parsed-values">
                    {f.values.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <span className="muted">{t("Not provided")}</span>
                )}
              </td>
              <td>
                <span className={`badge ${STATUS[f.status].badge}`}>{t(STATUS[f.status].label)}</span>
                {f.status === "partial" && (
                  <div className="tiny">
                    {t("Missing:")} {f.incomplete.map((i) => t(INCOMPLETE_LABELS[i] ?? i)).join(", ")}
                  </div>
                )}
                {f.source === "correction" && <div className="tiny">{t("Corrected by a person")}</div>}
              </td>
              <td>
                {f.evidence.map((e) => (
                  <button key={e.segmentId} type="button" className="link-btn evidence-link" title={e.quote} onClick={() => setOpen(e)}>
                    {evidenceLabel(e, state.lang)}
                  </button>
                ))}
                {f.evidenceUnavailable === "source_unavailable" && <span className="tiny">{t("Source text unavailable")}</span>}
                {f.evidenceUnavailable === "not_located" && (
                  <span className="tiny">{f.source === "correction" ? t("Entered by a person — not in the source") : t("Not found in the source text")}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {open && <SourceMaterialModal materialId={open.materialId} segmentId={open.segmentId} onClose={() => setOpen(null)} />}
    </div>
  );
}
