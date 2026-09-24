import { Icon } from "../../components/ui/Icons";
import { Button, EmptyState, StatusBadge } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtRelative } from "../../lib/format";
import { useStartCreate } from "../../pages/NewJobPage";
import { FilePreviewModal } from "../../pages/FilesPage";
import { useNavigate } from "react-router-dom";

const FILE_ICONS: Record<string, string> = { pdf: "picture_as_pdf", docx: "description", image: "image" };

export function AttachmentsTab({ jobId }: { jobId: string }) {
  const { state, t, openModal } = useStore();
  const startCreate = useStartCreate();
  const navigate = useNavigate();
  const files = state.files.filter((f) => f.jobId === jobId);

  return (
    <div className="main-inner" style={{ padding: "24px 28px 64px" }}>
      <div className="page-header">
        <div>
          <h2 className="section-title">{t("Attachments")}</h2>
          <p className="tiny">{t("Source material for this job — upload, preview and check origin.")}</p>
        </div>
        <Button variant="primary" onClick={() => startCreate("upload")}>
          <Icon name="upload_file" />
          {t("Upload")}
        </Button>
      </div>
      <div className="card">
        {files.length === 0 ? (
          <EmptyState
            icon="folder_open"
            title={t("No attachments")}
            body={t("Upload source material or link an unassigned file from Files & Integrations.")}
            actions={<Button onClick={() => navigate("/files")}>{t("Go to Files & Integrations")}</Button>}
          />
        ) : (
          files.map((f) => (
            <div key={f.id} className="file-row">
              <div className="fr-icon">
                <Icon name={FILE_ICONS[f.kind] || "draft"} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>{f.name}</div>
                <div className="tiny">
                  {f.size} • {t(f.source)} • {f.uploadedBy ? getPerson(f.uploadedBy)?.name : t("System")} •{" "}
                  {fmtRelative(f.uploadedAt)}
                </div>
              </div>
              <StatusBadge kind="file_consumption" value={f.consumption} />
              <Button variant="text" size="sm" onClick={() => openModal(<FilePreviewModal fileId={f.id} />, { wide: true })}>
                {t("Preview")}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
