import { useEffect, useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Modal } from "../../components/ui/Overlays";
import { Button } from "../../components/ui/Primitives";
import { CORRECTION_REASON_LABEL, getProfileHistory, type ProfileVersion } from "../../data/api/candidates";
import { SourceMaterialModal } from "./SourceMaterialModal";
import { fmtDate } from "../../lib/format";

const FIELD_LABELS: Record<string, string> = {
  display_name: "Name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  compensation_expectation: "Salary expectation",
  projects: "Project descriptions",
};

/** Readable form of a stored field value: plain text, a salary range, or a list of project descriptions. */
export function describeValue(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => describeValue((item as { description?: unknown } | null)?.description ?? item)).join("; ");
  }
  if (typeof value === "object") {
    const v = value as Record<string, unknown>;
    if (v.min != null || v.max != null) {
      return `${v.min ?? "?"}–${v.max ?? "?"} ${v.currency ?? ""}${v.period === "month" ? " / month" : ""}`.trim();
    }
  }
  return JSON.stringify(value);
}

/**
 * Profile history (#159): every version, newest first, how it came about, and for corrections each field's old
 * and new value with who, when and why. Older versions open read-only; the source material is shown as
 * stored — corrections never rewrite it. Restricted fields (work authorization) are not listed here.
 */
export function ProfileHistoryModal({
  candidateId,
  materialByResumeVersion,
  onClose,
}: {
  candidateId: string;
  materialByResumeVersion: Record<string, { materialId: string; fileName: string }>;
  onClose: () => void;
}) {
  const { t, state } = useStore();
  const [versions, setVersions] = useState<ProfileVersion[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    getProfileHistory(candidateId)
      .then((history) => setVersions(history.versions))
      .catch(() => setFailed(true));
  }, [candidateId]);

  return (
    <Modal
      open
      onClose={onClose}
      title={t("Profile history")}
      wide
      footer={
        <Button variant="secondary" onClick={onClose}>
          {t("Close")}
        </Button>
      }
    >
      {failed && <p className="tiny">{t("Couldn't load the profile history. Try again.")}</p>}
      {!versions && !failed && <p className="tiny">{t("Loading…")}</p>}
      {versions?.map((version, index) => {
        const material = version.resumeVersionId ? materialByResumeVersion[version.resumeVersionId] : undefined;
        return (
          <div key={version.version} className="card card-pad" style={{ marginBottom: 12 }} data-testid={`profile-version-${version.version}`}>
            <div className="flex items-center justify-between gap-8 flex-wrap">
              <div className="flex items-center gap-8">
                <strong>v{version.version}</strong>
                {index === 0 && <span className="badge badge-success">{t("Current")}</span>}
                <span className="badge badge-outline">{version.kind === "corrected" ? t("Corrected") : t("Parsed from resume")}</span>
                <span className="tiny">{fmtDate(version.createdAt, state.lang)}</span>
              </div>
              <div className="flex gap-8">
                {material && (
                  <Button variant="text" size="sm" icon="description" onClick={() => setSource(material.materialId)}>
                    {t("View source")}
                  </Button>
                )}
                {index > 0 && (
                  <Button variant="text" size="sm" onClick={() => setOpen(open === version.version ? null : version.version)}>
                    {open === version.version ? t("Hide this version") : t("View this version")}
                  </Button>
                )}
              </div>
            </div>
            {version.corrections.length > 0 && (
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>{t("Field")}</th>
                    <th>{t("Before")}</th>
                    <th>{t("After")}</th>
                    <th>{t("Reason")}</th>
                    <th>{t("By")}</th>
                  </tr>
                </thead>
                <tbody>
                  {version.corrections.map((entry, i) => (
                    <tr key={i}>
                      <td>{t(FIELD_LABELS[entry.fieldPath] ?? entry.fieldPath)}</td>
                      <td>{describeValue(entry.oldValue)}</td>
                      <td>{describeValue(entry.newValue)}</td>
                      <td>
                        {entry.reasonType ? t(CORRECTION_REASON_LABEL[entry.reasonType]) : t("No reason given")}
                        {entry.reason ? ` · ${entry.reason}` : ""}
                      </td>
                      <td className="tiny">
                        {entry.correctedBy} · {fmtDate(entry.correctedAt, state.lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {open === version.version && (
              <div className="tiny" style={{ marginTop: 8 }} data-testid="profile-version-snapshot">
                <div>
                  <strong>{t("Name")}:</strong> {version.displayName || "—"}
                </div>
                <div>
                  <strong>{t("Location")}:</strong> {version.location || "—"}
                </div>
                <div>
                  <strong>{t("Salary expectation")}:</strong> {describeValue(version.compensationExpectation)}
                </div>
                {version.projects.map((project, i) => (
                  <div key={i}>
                    <strong>{project.name || t("Project %s").replace("%s", String(i + 1))}:</strong> {project.description || "—"}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {source && <SourceMaterialModal materialId={source} onClose={() => setSource(null)} />}
    </Modal>
  );
}
