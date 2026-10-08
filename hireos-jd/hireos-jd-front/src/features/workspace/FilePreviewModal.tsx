import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { CloseButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { fmtRelative } from "../../lib/format";

export function FilePreviewModal({ fileId }: { fileId: string }) {
  const { state, t, say, closeModal } = useStore();
  const f = state.files.find((x) => x.id === fileId);
  if (!f) return null;
  return (
    <>
      <ModalHeader title={f.name} />
      <ModalBody>
        {f.error ? (
          <div className="error-inline">
            <Icon name="error" />
            {f.error}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 30 }}>
            <Icon name="description" />
            <p className="tiny">{t("Preview not available in this prototype — shows file metadata only.")}</p>
          </div>
        )}
        <div className="tiny" style={{ marginTop: 10 }}>
          {t("Source")}: {t(f.source)} • {t("Size")}: {f.size} • {t("Received")} {fmtRelative(f.uploadedAt)}
        </div>
      </ModalBody>
      <ModalFooter>
        <CloseButton />
        {!f.error && (
          <Button
            variant="primary"
            onClick={() => {
              say(t("Preparing download…"));
              closeModal();
            }}
          >
            {t("Download")}
          </Button>
        )}
      </ModalFooter>
    </>
  );
}
