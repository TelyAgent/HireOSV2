import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { Input } from "antd";
import { Icon } from "../components/ui/Icons";
import { Button } from "../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../components/ui/Overlays";
import { chatKey, GeminiPanel, jdFieldsToGeminiDraft, useOpenCreateJob } from "../features/copilot/GeminiPanel";
import { createCopilotConversation, uploadCopilotAttachment } from "../features/copilot/copilotApi";
import { useStore } from "../store/StoreContext";
import type { GeminiMsg } from "../store/types";

export type CreateMode = "upload" | "paste" | "template" | "clone";

/** Shared launcher so Attachments / Templates can reuse the same create flows. */
export function useStartCreate() {
  const { openModal } = useStore();
  return (mode: CreateMode) => openModal(<CreateModal mode={mode} />, { wide: mode === "clone" });
}

/**
 * "New job" no longer has its own page — it opens the Copilot drawer in place. This route only
 * keeps old `/jobs/new` links working: it lands on the Job Library with the drawer open.
 */
export function NewJobPage() {
  const openCreateJob = useOpenCreateJob();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    openCreateJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Navigate to="/jobs" replace />;
}

/* ---------------------------------------------------------------
   Create-flow modals — ported from the prototype's `A.startCreate`.
   Upload and paste both run the backend's AI bulk extraction and hand off
   to the Copilot panel; template and clone have no backend yet.
   --------------------------------------------------------------- */
function CreateModal({ mode }: { mode: CreateMode }) {
  const { t, say, state, mutate, closeModal, openDrawer } = useStore();
  const [extractStatus, setExtractStatus] = useState<"idle" | "extracting" | "error">("idle");
  const [uploadFileName, setUploadFileName] = useState("");
  const [extractError, setExtractError] = useState("");
  const [pastedNotes, setPastedNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notAvailable = () => {
    closeModal();
    say(t("This feature isn't available yet."));
  };

  const createCtx = { mode: "create" as const, jobId: null, audience: "internal" as const, selText: null };

  /** Runs AI field extraction over `file` in the create-mode Copilot conversation, then opens the panel. */
  async function extractIntoCopilot(file: File, chatLabel: string) {
    setExtractStatus("extracting");
    setExtractError("");
    try {
      const key = chatKey(createCtx);
      let conversationId = state.geminiConversationIds[key];
      if (!conversationId) {
        const conversation = await createCopilotConversation();
        conversationId = conversation.id;
        mutate((draft) => {
          draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversationId! };
        });
      }
      const result = await uploadCopilotAttachment(conversationId, file);
      const lastReply = result.messages[result.messages.length - 1];
      const newMessages: GeminiMsg[] = [
        { role: "user", text: chatLabel },
        result.phase === "ready_to_confirm"
          ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields) }
          : { role: "ai", text: lastReply?.text || "" },
      ];
      mutate((draft) => {
        const list = draft.geminiChats[key] ?? [];
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, ...newMessages] };
      });
      closeModal();
      openDrawer(<GeminiPanel ctx={createCtx} />, { drawerClass: "gemini-drawer-shell", overlayClass: "gemini-overlay" });
    } catch (error) {
      setExtractStatus("error");
      setExtractError(error instanceof Error ? error.message : t("Couldn't process this file. Please try again."));
    }
  }

  function handleFileSelected(file: File) {
    if (extractStatus === "extracting") return;
    setUploadFileName(file.name);
    // The input's `accept` filter doesn't apply to drag-and-drop, so check the extension here too.
    if (!/\.(pdf|docx|txt)$/i.test(file.name)) {
      setExtractStatus("error");
      setExtractError(t("Only PDF, DOCX or TXT files are supported."));
      return;
    }
    void extractIntoCopilot(file, `[${t("Uploaded file")}] ${file.name}`);
  }

  // Pasted notes go through the same bulk-extraction endpoint as an uploaded TXT, so they get the
  // one-shot "extract every field" treatment rather than the one-question-at-a-time chat intake.
  function handlePastedNotes() {
    const text = pastedNotes.trim();
    if (!text) return;
    const file = new File([text], "pasted-notes.txt", { type: "text/plain" });
    void extractIntoCopilot(file, `[${t("Pasted notes")}] ${text.length > 60 ? `${text.slice(0, 60)}…` : text}`);
  }

  if (mode === "upload") {
    return (
      <>
        <ModalHeader title={t("Upload source material")} />
        <ModalBody>
          <div
            className="empty-state"
            style={{
              padding: 32,
              border: `1px dashed ${dragOver ? "var(--info-border)" : "var(--border-strong)"}`,
              background: dragOver ? "var(--info-bg)" : undefined,
              borderRadius: 8,
              cursor: "pointer",
            }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFileSelected(file);
            }}
          >
            <Icon name="upload_file" />
            <h3>{t("Drop PDF, DOCX or TXT")}</h3>
            <p>{t("Or click to browse. Files are checked and read before extraction.")}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFileSelected(file);
            }}
          />
          {extractStatus !== "idle" && (
            <div style={{ marginTop: 14 }}>
              <div className="tiny" style={{ marginBottom: 6 }}>
                {uploadFileName}
              </div>
              {extractStatus === "extracting" && (
                <>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: "100%" }} />
                  </div>
                  <div className="tiny" style={{ marginTop: 4, color: "var(--success-text)" }}>
                    {t("Uploading and extracting…")}
                  </div>
                </>
              )}
              {extractStatus === "error" && (
                <div className="tiny" role="alert" style={{ marginTop: 4, color: "var(--danger-text)" }}>
                  {extractError}
                </div>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <CancelButton />
        </ModalFooter>
      </>
    );
  }

  if (mode === "clone") {
    return (
      <>
        <ModalHeader title={t("Clone an existing job")} />
        <ModalBody>
          <div className="field">
            <label>{t("Source job")}</label>
            <select defaultValue="job-demo-102">
              <option value="job-demo-102">Senior Backend Engineer (job-demo-102)</option>
              <option value="job-demo-104">Product Designer (job-demo-104)</option>
            </select>
          </div>
          <div className="two-col">
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                {t("Will copy")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)" }}>
                <li>{t("Responsibilities")}</li>
                <li>{t("Skills / requirements wording")}</li>
                <li>{t("Evaluation dimensions")}</li>
              </ul>
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>
                {t("Needs re-confirmation")}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
                <li>{t("Headcount, location, dates")}</li>
                <li>{t("Owner / HM / recruiter")}</li>
                <li>{t("Approval & publication state")}</li>
                <li>{t("Restricted content (not copied)")}</li>
              </ul>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <CancelButton />
          <Button variant="primary" onClick={notAvailable}>
            {t("Create draft")}
          </Button>
        </ModalFooter>
      </>
    );
  }

  if (mode === "paste") {
    const extracting = extractStatus === "extracting";
    return (
      <>
        <ModalHeader title={t("Paste notes")} />
        <ModalBody>
          <Input.TextArea
            className="paste-notes"
            placeholder={t("Paste rough notes here...")}
            autoSize={{ minRows: 8, maxRows: 16 }}
            autoFocus
            value={pastedNotes}
            disabled={extracting}
            onChange={(e) => setPastedNotes(e.target.value)}
          />
          {extracting && (
            <div className="tiny" style={{ marginTop: 8, color: "var(--success-text)" }}>
              {t("Generating the job from your notes…")}
            </div>
          )}
          {extractStatus === "error" && (
            <div className="tiny" role="alert" style={{ marginTop: 8, color: "var(--danger-text)" }}>
              {extractError}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <CancelButton />
          <Button variant="primary" disabled={extracting || !pastedNotes.trim()} onClick={handlePastedNotes}>
            {extracting ? t("Generating…") : t("Continue")}
          </Button>
        </ModalFooter>
      </>
    );
  }

  return (
    <>
      <ModalHeader title={t("Use a template")} />
      <ModalBody>
        <div className="field">
          <label>{t("Template")}</label>
          <select defaultValue="eng">
            <option value="eng">Engineering — Backend</option>
            <option value="people">People Operations — HR Lead</option>
          </select>
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={notAvailable}>
          {t("Continue")}
        </Button>
      </ModalFooter>
    </>
  );
}
