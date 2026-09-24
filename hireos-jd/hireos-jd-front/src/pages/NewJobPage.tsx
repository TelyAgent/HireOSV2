import { useRef, useState } from "react";
import { Input } from "antd";
import { MainInner } from "../components/AppShell";
import { Icon } from "../components/ui/Icons";
import { Button, PageHeader } from "../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../components/ui/Overlays";
import { chatKey, GeminiPanel, jdFieldsToGeminiDraft } from "../features/copilot/GeminiPanel";
import { createCopilotConversation, uploadCopilotAttachment } from "../features/copilot/copilotApi";
import { useStore } from "../store/StoreContext";
import type { GeminiMsg } from "../store/types";

export type CreateMode = "upload" | "paste" | "template" | "clone";

/** Shared launcher so Attachments / Templates can reuse the same create flows. */
export function useStartCreate() {
  const { openModal } = useStore();
  return (mode: CreateMode) => openModal(<CreateModal mode={mode} />, { wide: mode === "clone" });
}

export function NewJobPage() {
  const { t, openDrawer } = useStore();
  const startCreate = useStartCreate();

  const cards: { mode: CreateMode; icon: string; title: string; meta: string }[] = [
    {
      mode: "upload",
      icon: "upload_file",
      title: "Upload PDF / DOCX / TXT",
      meta: "We’ll extract structured fields for you to review.",
    },
    { mode: "paste", icon: "content_paste", title: "Paste notes", meta: "Drop in rough notes from a meeting or email." },
    { mode: "template", icon: "dashboard_customize", title: "Use a template", meta: "Start from a saved job template." },
    {
      mode: "clone",
      icon: "content_copy",
      title: "Clone an existing job",
      meta: "Copies role content; HC, dates, approvals and restricted content are never inherited.",
    },
  ];

  return (
    <MainInner>
      <PageHeader
        title={t("New job")}
        subtitle={t("Start from a chat, an upload, pasted notes, a template, or by cloning an existing job.")}
        crumbs={[{ label: t("Job Library"), to: "/jobs" }, { label: t("New job") }]}
      />
      <div className="job-card-grid">
        <div
          className="job-card gemini-launch-card"
          onClick={() =>
            openDrawer(<GeminiPanel ctx={{ mode: "create", jobId: null, audience: "internal", selText: null }} />, {
              drawerClass: "gemini-drawer-shell",
              overlayClass: "gemini-overlay",
            })
          }
        >
          <span className="gemini-launch-icon material-icons-o">auto_awesome</span>
          <div>
            <div className="jc-title">{t("Ask Copilot — speak or type")}</div>
            <div className="jc-meta">
              {t("Describe the role out loud or in writing; Copilot drafts a structured job for you to review and create.")}
            </div>
          </div>
        </div>
        {cards.map((c) => (
          <div key={c.mode} className="job-card" onClick={() => startCreate(c.mode)}>
            <Icon name={c.icon} size={28} style={{ color: "var(--accent-600)" }} />
            <div className="jc-title">{t(c.title)}</div>
            <div className="jc-meta">{t(c.meta)}</div>
          </div>
        ))}
      </div>
    </MainInner>
  );
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
    setUploadFileName(file.name);
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
            style={{ padding: 32, border: "1px dashed var(--border-strong)", borderRadius: 8, cursor: "pointer" }}
            onClick={() => fileInputRef.current?.click()}
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
