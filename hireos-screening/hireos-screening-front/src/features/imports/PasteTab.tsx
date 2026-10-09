import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Button } from "../../components/ui/Primitives";
import { useImportRuns } from "./UploadTab";

const MIN_RESUME_CHARS = 20;

/** First non-empty line (usually the candidate's name), made safe for a file name. */
function fileNameFor(text: string) {
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || "pasted-resume";
  const safe = firstLine.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40);
  return `${safe || "pasted-resume"}.txt`;
}

/**
 * Paste a whole resume as text. It's submitted as a .txt file through the same import
 * pipeline as an upload, so it gets the same parsing, duplicate check and (with `jobId`)
 * job-scoped matching and progress.
 */
export function PasteTab({ jobId, onChanged }: { jobId?: string; onChanged?: () => void }) {
  const { t, say } = useStore();
  const [text, setText] = useState("");
  const { startRun, runCards } = useImportRuns({ jobId, onChanged });

  const submit = () => {
    const content = text.trim();
    if (content.length < MIN_RESUME_CHARS) {
      say(t("Paste the full resume text"), { type: "error" });
      return;
    }
    const file = new File([content], fileNameFor(content), { type: "text/plain" });
    setText("");
    void startRun([file]).catch(() => say(t("Could not add this candidate."), { type: "error" }));
  };

  return (
    <>
      <div className="card card-pad">
        <p className="tiny" style={{ marginBottom: 12 }}>
          {jobId
            ? t("Paste the full resume text. It is saved to the Resume Library and matched against this job only.")
            : t("Paste the full resume text. It is parsed like an uploaded file and saved to the Resume Library.")}
        </p>
        <div className="field">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("Paste resume text here — name, contact, experience, education, skills…")}
            style={{ minHeight: 280 }}
          />
        </div>
        <Button variant="primary" icon="add" onClick={submit} disabled={!text.trim()}>
          {t("Add to library")}
        </Button>
      </div>
      {runCards}
    </>
  );
}
