import { useState } from "react";
import { useStore } from "../../store/StoreContext";
import { Modal } from "../../components/ui/Overlays";
import { Button } from "../../components/ui/Primitives";
import { ApiError } from "../../data/api/shared";
import { reopenConcern, resolveConcern, type ConcernResolution } from "../../data/api/screening";
import type { Concern } from "../../data/fixtures/concerns";

export const CONCERN_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
  accepted_risk: "Accepted risk",
};

/**
 * Handling or reopening a concern, checked before it is recorded (F08 FR-8, #193; Owner decision 2026-10-16):
 * the change (before → after) is shown first; a note is required; references to the candidate's material are
 * optional. Cancel writes nothing. Linked verification items stay as they are and are answered separately.
 */
export function ConcernResolveModal({
  applicationId,
  concern,
  mode,
  resolution,
  materials,
  openVerificationCount,
  onClose,
  onDone,
}: {
  applicationId: string;
  concern: Concern;
  mode: "resolve" | "reopen";
  resolution?: ConcernResolution;
  materials: Array<{ materialId: string; label: string }>;
  openVerificationCount: number;
  onClose: () => void;
  onDone: (concern: Concern) => void;
}) {
  const { t } = useStore();
  const [note, setNote] = useState("");
  const [refs, setRefs] = useState<string[]>([]);
  const [noteError, setNoteError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const to = mode === "reopen" ? "open" : resolution!;

  const submit = async () => {
    if (!note.trim()) {
      setNoteError(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated =
        mode === "reopen"
          ? await reopenConcern(applicationId, concern.id, note.trim())
          : await resolveConcern(applicationId, concern.id, {
              resolution: resolution!,
              note: note.trim(),
              evidenceRefs: refs.map((materialId) => ({ materialId, label: materials.find((m) => m.materialId === materialId)?.label })),
            });
      onDone(updated);
    } catch (e) {
      setSaving(false);
      setError(
        e instanceof ApiError && (e.code === "CONCERN_CHANGED" || e.code === "CONCERN_ALREADY_OPEN")
          ? t("This concern was changed in the meantime. Close this and reload to see its current state.")
          : t("Couldn't record this. Check the fields and try again."),
      );
    }
  };

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title={mode === "reopen" ? t("Reopen concern") : t("Record how this concern was handled")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" onClick={submit} loading={saving} data-testid="concern-submit">
            {mode === "reopen" ? t("Reopen") : t("Record")}
          </Button>
        </>
      }
    >
      <p style={{ fontSize: "var(--fs-sm)", marginTop: 0 }} data-testid="concern-change">
        <strong>{concern.title}</strong>
        <br />
        {t("Status")}: {t(CONCERN_STATUS_LABEL[concern.status] ?? concern.status)} → <strong>{t(CONCERN_STATUS_LABEL[to] ?? to)}</strong>
      </p>
      {resolution === "accepted_risk" && (
        <p className="tiny">{t("This blocker requires approval from both an HR and a Hiring Manager approver before it can be accepted. In this demo, confirming records both approvals.")}</p>
      )}
      <div className="field">
        <label htmlFor="concern-note">
          {mode === "reopen" ? t("Why reopen it") : t("How it was checked")} <span className="req">*</span>
        </label>
        <textarea
          id="concern-note"
          value={note}
          aria-invalid={noteError || undefined}
          onChange={(e) => {
            setNote(e.target.value);
            if (e.target.value.trim()) setNoteError(false);
          }}
          placeholder={mode === "reopen" ? t("e.g. Marked confirmed by mistake") : t("e.g. Candidate confirmed the dates by phone on 16 Oct")}
        />
        {noteError && <div className="field-error">{t("A note is required — it is kept with the concern.")}</div>}
      </div>
      {mode === "resolve" && materials.length > 0 && (
        <div className="field">
          <label>{t("Supporting material (optional)")}</label>
          {materials.map((m) => (
            <label key={m.materialId} className="tiny flex items-center gap-8" style={{ fontWeight: 400 }}>
              <input
                type="checkbox"
                checked={refs.includes(m.materialId)}
                onChange={(e) => setRefs((current) => (e.target.checked ? [...current, m.materialId] : current.filter((id) => id !== m.materialId)))}
              />
              {m.label}
            </label>
          ))}
        </div>
      )}
      {openVerificationCount > 0 && (
        <p className="tiny" style={{ color: "var(--warning-text)" }} data-testid="verification-still-open">
          {t("{n} linked verification item(s) stay open — answer them separately.").replace("{n}", String(openVerificationCount))}
        </p>
      )}
      <p className="tiny muted">{t("Recorded with your name and the time. The concern's original text is kept as it was.")}</p>
      {error && (
        <div className="error-inline" role="alert" data-testid="concern-error">
          {error}
        </div>
      )}
    </Modal>
  );
}
