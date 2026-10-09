import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Icon } from "../../components/ui/Icons";
import { Modal } from "../../components/ui/Overlays";
import { UploadTab } from "./UploadTab";
import { PasteTab } from "./PasteTab";
import { EmailTab } from "./EmailTab";
import { FolderTab } from "./FolderTab";
import { ApiTab } from "./ApiTab";

export type ImportTab = "upload" | "paste" | "email" | "folder" | "api";

export const IMPORT_TABS: { id: ImportTab; label: string; icon: string }[] = [
  { id: "upload", label: "Upload resumes", icon: "upload_file" },
  { id: "paste", label: "Paste profile", icon: "edit_note" },
  { id: "email", label: "Import from email", icon: "mail_outline" },
  { id: "folder", label: "Import from folder", icon: "folder_open" },
  { id: "api", label: "Import from API", icon: "api" },
];

/**
 * Shared resume intake (tabs + per-channel form). Used full-page by the Resume Library's
 * Import route and as a modal from a job's screening workspace. With `jobId`, everything
 * added here is still saved to the Resume Library but auto-matched against that job only.
 */
export function ResumeImportPanel({
  initialTab = "upload",
  tabs = IMPORT_TABS.map((x) => x.id),
  jobId,
  onChanged,
}: {
  initialTab?: ImportTab;
  tabs?: ImportTab[];
  jobId?: string;
  onChanged?: () => void;
}) {
  const { t } = useStore();
  const [tab, setTab] = useState<ImportTab>(tabs.includes(initialTab) ? initialTab : tabs[0]);
  const bump = () => onChanged?.();

  return (
    <>
      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        {IMPORT_TABS.filter((x) => tabs.includes(x.id)).map((tabDef) => (
          <button key={tabDef.id} className={`pill-tab${tab === tabDef.id ? " active" : ""}`} onClick={() => setTab(tabDef.id)}>
            <Icon name={tabDef.icon} size={15} style={{ verticalAlign: -3, marginRight: 4 }} />
            {t(tabDef.label)}
          </button>
        ))}
      </div>
      <div className="two-col" style={{ gridTemplateColumns: "1fr", maxWidth: 900 }}>
        <div>
          {tab === "upload" && <UploadTab onChanged={bump} jobId={jobId} />}
          {tab === "paste" && <PasteTab onChanged={bump} jobId={jobId} />}
          {tab === "email" && <EmailTab onChanged={bump} jobId={jobId} />}
          {tab === "folder" && <FolderTab />}
          {tab === "api" && <ApiTab />}
        </div>
      </div>
    </>
  );
}

/** Shared import dialog (no route change). With `jobId` — opened from a job's screening
 * workspace — imports are matched against that job only; without it they go to the
 * Resume Library and are matched against every open job. */
export function ResumeImportModal({
  jobId,
  jobTitle,
  initialTab,
  onClose,
  onChanged,
}: {
  jobId?: string;
  jobTitle?: string;
  initialTab?: ImportTab;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { t } = useStore();
  return (
    <Modal open onClose={onClose} title={t("Upload resumes")} width={860}>
      {jobId && (
        <p className="tiny" style={{ margin: "0 0 14px" }}>
          {t("Resumes added here are saved to the Resume Library and matched against this job only:")} <strong>{jobTitle}</strong>
        </p>
      )}
      <ResumeImportPanel jobId={jobId} initialTab={initialTab} tabs={jobId ? ["upload", "paste", "email", "folder"] : undefined} onChanged={onChanged} />
    </Modal>
  );
}
