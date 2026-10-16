import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Button } from "../../components/ui/Primitives";
import { previewPaste, runPasteImport } from "../../data/api/imports";
import { useImportRuns } from "./UploadTab";

const MIN_RESUME_CHARS = 20;

type Confirm = { displayName: string; email: string; location: string };

/**
 * Paste a whole resume as text, in two steps (#160 #161 #167): the name, email and location read from the text
 * are shown in an editable form first, and only what the user confirms is saved. A name the text doesn't
 * give stays empty and required — it is never taken from the email address. The import is recorded as a
 * paste, and goes through the same parsing, duplicate check and (with `jobId`) job matching as an upload.
 */
export function PasteTab({ jobId, onChanged }: { jobId?: string; onChanged?: () => void }) {
  const { t, say } = useStore();
  const [text, setText] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameMissing, setNameMissing] = useState(false);
  const { startBatch, runCards } = useImportRuns({ jobId, onChanged });

  const recognize = async () => {
    const content = text.trim();
    if (content.length < MIN_RESUME_CHARS) {
      say(t("Paste the full resume text"), { type: "error" });
      return;
    }
    setBusy(true);
    try {
      const found = await previewPaste(content);
      setConfirm({ displayName: found.displayName ?? "", email: found.email ?? "", location: found.location ?? "" });
      setNameMissing(!found.displayName);
    } catch {
      say(t("Could not read this text. Try again."), { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!confirm) return;
    const displayName = confirm.displayName.trim();
    if (!displayName) {
      setNameMissing(true);
      say(t("Enter the candidate's name before adding them."), { type: "error" });
      return;
    }
    const input = {
      text: text.trim(),
      displayName,
      ...(confirm.email.trim() ? { email: confirm.email.trim() } : {}),
      ...(confirm.location.trim() ? { location: confirm.location.trim() } : {}),
    };
    setText("");
    setConfirm(null);
    void startBatch(() => runPasteImport(input, { jobId }), 1).catch(() => say(t("Could not add this candidate."), { type: "error" }));
  };

  const set = (field: keyof Confirm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirm((current) => (current ? { ...current, [field]: e.target.value } : current));
    if (field === "displayName") setNameMissing(!e.target.value.trim());
  };

  return (
    <>
      <div className="card card-pad">
        <p className="tiny" style={{ marginBottom: 12 }}>
          {jobId
            ? t("Paste the full resume text. It is saved to the Resume Library and matched against this job only.")
            : t("Paste the full resume text. It is parsed like an uploaded file and saved to the Resume Library.")}
        </p>
        {!confirm ? (
          <>
            <div className="field">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("Paste resume text here — name, contact, experience, education, skills…")}
                style={{ minHeight: 280 }}
              />
            </div>
            <Button variant="primary" icon="fact_check" onClick={() => void recognize()} disabled={!text.trim() || busy}>
              {busy ? t("Reading…") : t("Check details")}
            </Button>
          </>
        ) : (
          <div className="paste-confirm">
            <div className="section-title" style={{ marginTop: 0 }}>{t("Check what was read before saving")}</div>
            <p className="tiny" style={{ marginBottom: 12 }}>{t("Correct anything that was read wrong. Only these values are saved.")}</p>
            <div className={`field${nameMissing ? " field-invalid" : ""}`}>
              <label htmlFor="paste-name">
                {t("Name")} <span className="req">*</span>
              </label>
              <input id="paste-name" type="text" value={confirm.displayName} onChange={set("displayName")} aria-invalid={nameMissing} autoFocus={nameMissing} />
              {nameMissing && <div className="field-error">{t("No name was found in the text. Enter it — it is required.")}</div>}
            </div>
            <div className="field">
              <label htmlFor="paste-email">{t("Email")}</label>
              <input id="paste-email" type="email" value={confirm.email} onChange={set("email")} />
            </div>
            <div className="field">
              <label htmlFor="paste-location">{t("Location")}</label>
              <input id="paste-location" type="text" value={confirm.location} onChange={set("location")} />
            </div>
            <div className="flex" style={{ gap: 8 }}>
              <Button variant="primary" icon="add" onClick={submit} disabled={!confirm.displayName.trim()}>
                {t("Add to library")}
              </Button>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                {t("Back to text")}
              </Button>
            </div>
          </div>
        )}
      </div>
      {runCards}
    </>
  );
}
