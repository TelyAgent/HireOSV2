import { useState } from "react";
import { useStore } from "../store/StoreContext";
import { Icon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/Primitives";
import { UploadTab } from "../features/imports/UploadTab";
import { PasteTab } from "../features/imports/PasteTab";
import { EmailTab } from "../features/imports/EmailTab";
import { FolderTab } from "../features/imports/FolderTab";
import { ApiTab } from "../features/imports/ApiTab";
import { UnifiedIntake } from "../features/imports/UnifiedIntake";

type ImportTab = "upload" | "paste" | "email" | "folder" | "api";
const TABS: { id: ImportTab; label: string; icon: string }[] = [
  { id: "upload", label: "Upload resumes", icon: "upload_file" },
  { id: "paste", label: "Paste profile", icon: "edit_note" },
  { id: "email", label: "Import from email", icon: "mail_outline" },
  { id: "folder", label: "Import from folder", icon: "folder_open" },
  { id: "api", label: "Import from API", icon: "api" },
];

export function ImportPage() {
  const { t } = useStore();
  const [tab, setTab] = useState<ImportTab>("upload");
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = () => setRefreshKey((k) => k + 1);

  return (
    <>
      <PageHeader title={t("Import")} subtitle={t("All channels land in the same unified intake — you can always see where material came from and what happened to it.")} crumbs={[{ label: t("Resume Library"), href: "/library" }, { label: t("Import") }]} />
      <div className="pill-tabs" style={{ marginBottom: 20 }}>
        {TABS.map((tabDef) => (
          <button key={tabDef.id} className={`pill-tab${tab === tabDef.id ? " active" : ""}`} onClick={() => setTab(tabDef.id)}>
            <Icon name={tabDef.icon} size={15} style={{ verticalAlign: -3, marginRight: 4 }} />
            {t(tabDef.label)}
          </button>
        ))}
      </div>
      <div className="two-col" style={{ gridTemplateColumns: "1fr", maxWidth: 900 }}>
        <div>
          {tab === "upload" && <UploadTab onChanged={bump} />}
          {tab === "paste" && <PasteTab />}
          {tab === "email" && <EmailTab onChanged={bump} />}
          {tab === "folder" && <FolderTab />}
          {tab === "api" && <ApiTab />}
        </div>
      </div>
      <UnifiedIntake refreshKey={refreshKey} />
    </>
  );
}
