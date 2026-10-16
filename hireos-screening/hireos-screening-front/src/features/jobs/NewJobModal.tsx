import { useRef, useState } from "react";
import { Modal } from "antd";
import { useStore } from "../../store/StoreContext";
import { Button } from "../../components/ui/Primitives";
import { Icon } from "../../components/ui/Icons";
import { ApiError } from "../../data/api/shared";
import { previewJobFromJd, quickStartJob, readJdFile, type JdPreview } from "../../data/api/jobs";
import type { Job } from "../../data/fixtures/jobs";

// Error codes from the backend / upload checks -> the sentence shown under the form.
const ERRORS: Record<string, [string, string]> = {
  JD_REQUIRED: ["Provide a job description.", "请提供职位描述。"],
  INVALID_SCHEMA: ["Please check the job description.", "请检查职位描述。"],
  FILE_TOO_LARGE: ["The file exceeds 10 MB.", "文件超过 10 MB。"],
  EMPTY_FILE: ["The file is empty.", "文件为空。"],
  UNSUPPORTED_FILE_TYPE: ["Choose a PDF, DOCX or TXT file.", "请选择 PDF、DOCX 或 TXT 文件。"],
  FILE_UNREADABLE: ["Cannot read this file. Replace it or paste the text.", "无法读取文件，请更换文件或粘贴文本。"],
  OCR_REQUIRED: ["This PDF needs OCR. Paste its text or upload a text-based version.", "此 PDF 需要 OCR，请粘贴文字或上传文本版文件。"],
  NO_EXTRACTABLE_TEXT: ["No readable text found.", "未提取到可读文字。"],
  JD_BACKEND_UNAVAILABLE: ["The JD service is unavailable, so the job could not be created. Please retry later.", "JD 服务暂不可用，职位未能创建，请稍后重试。"],
  CORE_RECORD_UNAVAILABLE: ["The shared records service is unavailable. Please retry later.", "主档服务暂不可用，请稍后重试。"],
  JD_NOT_RECOGNIZED: ["AI found no job title or job content in this text. Check the JD and try again.", "AI 没有从这段文字中识别到职位名称和岗位内容，请检查 JD 后重试。"],
  AI_NOT_CONFIGURED: ["AI is not configured, so the JD can't be read. Ask an admin to set it up.", "AI 尚未配置，无法读取 JD，请联系管理员配置。"],
  LLM_INVALID_OUTPUT: ["AI returned an unreadable result. Nothing was created — please retry.", "AI 返回结果无法解析，职位未创建，请重试。"],
  AI_REQUEST_FAILED: ["The AI request failed. Nothing was created — please retry.", "AI 请求失败，职位未创建，请重试。"],
  AI_TIMEOUT: ["The AI request timed out. Nothing was created — please retry.", "AI 请求超时，职位未创建，请重试。"],
  REQUEST_FAILED: ["Request failed. Please retry.", "请求失败，请重试。"],
};

const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * "New job", in two steps (#178; Owner decision 2026-10-16): paste a JD (or read it from a file) and let AI
 * read it, then check the title and team it found — both required, each with its own message — before
 * anything is created. The job is then a draft in HireOS JD + Core Record that Screening uses right away;
 * the recruiter lands on its criteria draft and confirms the rubric before any matching. One idempotency key
 * per modal, so a double click creates one job.
 */
export function NewJobModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (job: Job, duplicate: boolean) => void }) {
  const { t, state } = useStore();
  const zh = state.lang === "zh";
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<JdPreview | null>(null);
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ title?: boolean; team?: boolean }>({});
  const fileGeneration = useRef(0);
  // Bumped by every read and every reset: a preview that comes back after the modal was closed or cleared is dropped.
  const readGeneration = useRef(0);
  const key = useRef(newKey());
  const errorText = (code: string) => (ERRORS[code] || ERRORS.REQUEST_FAILED)[zh ? 1 : 0];
  const busy = creating || fileBusy || reading;

  function reset() {
    fileGeneration.current++; readGeneration.current++; setText(""); setFileName(""); setFileBusy(false); setReading(false); setError("");
    setPreview(null); setTitle(""); setTeam(""); setFieldErrors({}); key.current = newKey();
  }
  function close() { if (creating) return; reset(); onClose(); }

  async function pickFile(file: File) {
    const g = ++fileGeneration.current;
    setFileName(file.name); setFileBusy(true); setError("");
    try {
      const result = await readJdFile(file);
      if (g !== fileGeneration.current) return;
      if (result.errorCode || !result.text.trim()) setError(result.errorCode || "NO_EXTRACTABLE_TEXT");
      else {
        // A different JD: what was read and confirmed for the previous one no longer applies (#178 review).
        setText(result.text); setPreview(null); setTitle(""); setTeam(""); setFieldErrors({});
      }
    } catch (e) { if (g === fileGeneration.current) setError(e instanceof ApiError ? e.code : "REQUEST_FAILED"); }
    finally { if (g === fileGeneration.current) setFileBusy(false); }
  }

  async function read() {
    if (!text.trim()) { setError("JD_REQUIRED"); return; }
    const g = ++readGeneration.current;
    setReading(true); setError("");
    try {
      const found = await previewJobFromJd(text);
      if (g !== readGeneration.current) return;
      setPreview(found);
      setTitle(found.title ?? "");
      setTeam(found.team ?? "");
      setFieldErrors({});
    } catch (e) { if (g === readGeneration.current) setError(e instanceof ApiError ? e.code : "REQUEST_FAILED"); }
    finally { if (g === readGeneration.current) setReading(false); }
  }

  async function create() {
    const missing = { title: !title.trim(), team: !team.trim() };
    if (!preview?.duplicateOf && (missing.title || missing.team)) { setFieldErrors(missing); return; }
    if (creating) return;
    setCreating(true); setError("");
    try {
      const { job, duplicate } = await quickStartJob({ text, title: title.trim() || preview?.duplicateOf?.title || "", team: team.trim() || "—" }, key.current);
      reset();
      onCreated(job, duplicate);
    } catch (e) { setError(e instanceof ApiError ? e.code : "REQUEST_FAILED"); }
    finally { setCreating(false); }
  }

  return (
    <Modal open={open} footer={null} closable={false} width={640} centered destroyOnHidden onCancel={close}
      styles={{ body: { padding: 0 }, content: { padding: "26px 28px 22px", borderRadius: 18 } }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{t("New job")}</div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: "var(--text)" }}>{t("Start with a job description")}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>{t("Paste the JD — AI reads it for the title, location and requirements; you confirm the rubric before screening starts.")}</div>
        </div>
        <button aria-label={t("Close")} onClick={close} style={{ flex: "none", width: 28, height: 28, border: 0, background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
          <Icon name="close" />
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        <label htmlFor="screeningJdText" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{t("Job description")}</label>
        <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: "var(--danger-text)" }}>{t("Required")}</div>
        <textarea id="screeningJdText" value={text} readOnly={!!preview || reading} onChange={(e) => setText(e.target.value)} placeholder={t("Paste the job description here…")}
          style={{ marginTop: 8, width: "100%", height: 170, border: "1px solid var(--border-strong)", borderRadius: 11, padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)", background: "var(--surface)", lineHeight: 1.55, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
        <label htmlFor="screeningJdFile"
          style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px dashed var(--border-strong)", borderRadius: 12, background: "var(--surface-alt)", cursor: fileBusy ? "progress" : busy || preview ? "not-allowed" : "pointer", opacity: preview ? 0.6 : 1, boxSizing: "border-box" }}>
          {/* The JD is fixed once AI reads it, so the job is created from the text that was previewed (#178 review): go
              "Back to JD" to change it. */}
          <input id="screeningJdFile" type="file" accept=".pdf,.docx,.txt" disabled={busy || !!preview} style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickFile(f); e.target.value = ""; }} />
          <Icon name="description" style={{ color: "var(--accent-600)" }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent-600)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName || t("Choose JD file")}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-tertiary)" }}>{fileBusy ? t("Reading file…") : t("PDF, DOCX, or TXT · up to 10 MB")}</div>
          </div>
        </label>
      </div>

      {preview && (
        <div style={{ marginTop: 18 }} data-testid="jd-preview">
          {preview.duplicateOf ? (
            <p className="tiny">{t("This JD already created the job “%s”. Creating opens that job instead of adding another.").replace("%s", preview.duplicateOf.title)}</p>
          ) : (
            <>
              <p className="tiny" style={{ marginTop: 0 }}>{t("AI read the JD. Check the title and team before the job is created.")}</p>
              <div className={`field${fieldErrors.title ? " field-invalid" : ""}`}>
                <label htmlFor="newJobTitle">{t("Job title")} <span className="req">*</span></label>
                <input id="newJobTitle" type="text" value={title} aria-invalid={fieldErrors.title || undefined}
                  onChange={(e) => { setTitle(e.target.value); if (e.target.value.trim()) setFieldErrors((f) => ({ ...f, title: false })); }} />
                {fieldErrors.title && <div className="field-error">{t("Enter the job title.")}</div>}
              </div>
              <div className={`field${fieldErrors.team ? " field-invalid" : ""}`}>
                <label htmlFor="newJobTeam">{t("Team / function")} <span className="req">*</span></label>
                <input id="newJobTeam" type="text" value={team} aria-invalid={fieldErrors.team || undefined}
                  onChange={(e) => { setTeam(e.target.value); if (e.target.value.trim()) setFieldErrors((f) => ({ ...f, team: false })); }} />
                {fieldErrors.team && <div className="field-error">{t("Enter the team or function.")}</div>}
              </div>
              {preview.location && <p className="tiny muted">{t("Location")}: {preview.location}</p>}
            </>
          )}
        </div>
      )}
      {error && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "var(--danger-text)" }}>{errorText(error)}</div>}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        <Button variant="text" onClick={close}>{t("Cancel")}</Button>
        {preview ? (
          <>
            <Button variant="secondary" onClick={() => { setPreview(null); setFieldErrors({}); }} disabled={creating}>{t("Back to JD")}</Button>
            <Button variant="primary" onClick={() => void create()} disabled={creating} data-testid="create-job">
              {creating ? t("Creating…") : preview.duplicateOf ? t("Open existing job") : t("Create job")}
            </Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => void read()} disabled={busy} data-testid="read-jd">
            {reading ? t("AI is reading the JD…") : t("Read JD")}
          </Button>
        )}
      </div>
    </Modal>
  );
}
