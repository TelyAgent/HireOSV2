import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useImportRuns } from "./UploadTab";
import { chunkForUpload, selectFolderFiles, skippedTotal, type FolderSelection } from "./folderFiles";

const FOLDER_INPUT_ID = "folder-import-input";

/**
 * One-off import of a local folder. The browser hands over the folder's files (subfolders
 * included) only when the user picks it, so nothing about the folder is remembered or
 * watched; the picked résumés then go through the same pipeline as "Upload resumes".
 */
export function FolderTab({ onChanged, jobId }: { onChanged?: () => void; jobId?: string }) {
  const { t } = useStore();
  const { startRun, runCards } = useImportRuns({ jobId, onChanged });
  const [selection, setSelection] = useState<{ folder: string; result: FolderSelection; batches: number } | null>(null);

  const handleFolder = (fileList: FileList) => {
    const files = Array.from(fileList);
    const folder = files[0]?.webkitRelativePath.split("/")[0] || "";
    const result = selectFolderFiles(files);
    // One request can carry only 20 files / ~20 MB, so a folder goes up as several batches.
    const batches = chunkForUpload(result.accepted);
    setSelection({ folder, result, batches: batches.length });
    for (const batch of batches) void startRun(batch);
  };

  const summary = selection && (
    <div className="tiny" style={{ marginTop: 12 }} data-testid="folder-summary">
      <strong>{selection.folder}</strong>
      {" · "}
      {selection.result.accepted.length
        ? `${t("Found")} ${selection.result.accepted.length} ${t("importable file(s)")}` +
          (selection.batches > 1 ? ` · ${t("Imported in")} ${selection.batches} ${t("batches")}` : "")
        : t("No importable files in this folder — nothing was imported.")}
      {skippedTotal(selection.result) > 0 && (
        <>
          {" · "}
          {t("Skipped")} {skippedTotal(selection.result)}
          {selection.result.skipped.tooLarge > 0 &&
            ` (${selection.result.skipped.tooLarge} ${t("over 20 MB")})`}
        </>
      )}
    </div>
  );

  return (
    <>
      <div className="card card-pad" style={{ textAlign: "center", padding: "40px 20px" }}>
        <input
          type="file"
          id={FOLDER_INPUT_ID}
          multiple
          // Not in React's input typings; supported by Chrome, Edge, Safari and Firefox.
          ref={(el) => el?.setAttribute("webkitdirectory", "")}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files?.length) handleFolder(e.target.files);
            e.target.value = "";
          }}
        />
        <Icon name="folder_open" size={36} style={{ color: "var(--text-tertiary)" }} />
        <h3 style={{ margin: "8px 0 4px", fontWeight: 500 }}>{t("Import every resume in a folder")}</h3>
        <p className="tiny">
          {jobId
            ? t("Supports PDF, DOCX, TXT · Up to 20 MB per file · Matched against this job only")
            : t("Supports PDF, DOCX, TXT · Up to 20 MB per file · No job selection required")}
        </p>
        <p className="tiny muted">{t("Subfolders are included. The folder itself is not saved or watched.")}</p>
        <Button variant="primary" style={{ marginTop: 10 }} onClick={() => document.getElementById(FOLDER_INPUT_ID)?.click()}>
          {t("Choose folder")}
        </Button>
        {summary}
      </div>
      {runCards}
    </>
  );
}
