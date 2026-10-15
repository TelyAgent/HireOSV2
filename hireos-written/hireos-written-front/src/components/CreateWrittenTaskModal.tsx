import { useRef, useState } from "react";
import { Modal } from "antd";
import { useStore } from "../store/StoreContext";
import { Button } from "./ui/Primitives";
import { Icon } from "./ui/Icon";
import {
  ApiCodeError, quickStart, searchExternalJobs, uploadMaterial,
  type ExternalJob, type QuickStartResult, type UploadedMaterial,
} from "../data/writtenApi";

type JdMode = "new" | "existing";
type ResumeUpload = { name: string; file: File; material?: UploadedMaterial; uploading: boolean; error?: string };

// Error codes from the backend / upload checks -> the sentence shown under the form.
const ERRORS: Record<string, [string, string]> = {
  NETWORK_ERROR: ["Unable to reach the server. Your input is kept.", "无法连接服务器，输入已保留。"],
  REQUEST_FAILED: ["Request failed. Please retry.", "请求失败，请重试。"],
  JD_REQUIRED: ["Provide a job description.", "请提供职位描述。"],
  JOB_REQUIRED: ["Choose a job first.", "请先选择一个岗位。"],
  RESUME_REQUIRED: ["Upload the candidate's résumé.", "请上传候选人简历。"],
  FILE_TOO_LARGE: ["The file exceeds 10 MB.", "文件超过 10 MB。"],
  EMPTY_FILE: ["The file is empty.", "文件为空。"],
  UNSUPPORTED_FILE_TYPE: ["Choose a PDF, DOCX or TXT file.", "请选择 PDF、DOCX 或 TXT 文件。"],
  FILE_UNREADABLE: ["Cannot read this file. Replace it or paste the text.", "无法读取文件，请更换文件或粘贴文本。"],
  OCR_REQUIRED: ["This PDF needs OCR. Paste its text or upload a text-based version.", "此 PDF 需要 OCR，请粘贴文字或上传文本版文件。"],
  NO_EXTRACTABLE_TEXT: ["No readable text found.", "未提取到可读文字。"],
  DOCUMENT_TOO_LONG: ["The document exceeds the text limit. Please split it.", "文档超过文字长度限制，请拆分后上传。"],
  MATERIAL_NOT_AVAILABLE: ["The résumé could not be read. Replace it and try again.", "简历无法读取，请更换文件后重试。"],
  JD_NOT_RECOGNIZED: ["AI found no job title or job content in this text. Check the JD and try again.", "AI 没有从这段文字中识别到职位名称和岗位内容，请检查 JD 后重试。"],
  AI_NOT_CONFIGURED: ["AI is not configured, so the JD can't be read. Ask an admin to set it up.", "AI 尚未配置，无法读取 JD，请联系管理员配置。"],
  LLM_INVALID_OUTPUT: ["AI returned an unreadable result. Nothing was created — please retry.", "AI 返回结果无法解析，未创建任何内容，请重试。"],
  AI_REQUEST_FAILED: ["The AI request failed. Nothing was created — please retry.", "AI 请求失败，未创建任何内容，请重试。"],
  AI_TIMEOUT: ["The AI request timed out. Nothing was created — please retry.", "AI 请求超时，未创建任何内容，请重试。"],
  JD_BACKEND_UNAVAILABLE: ["The JD service is unavailable, so the job could not be created. Please retry later.", "JD 服务暂不可用，岗位未能创建，请稍后重试。"],
  CORE_RECORD_UNAVAILABLE: ["The shared records service is unavailable. Please retry later.", "主档服务暂不可用，请稍后重试。"],
  JOB_NOT_PUBLISHED: ["This job is not published yet. Publish it in JD Management or paste its JD.", "该岗位尚未发布，请先在职位管理中发布，或粘贴 JD 新建。"],
  JOB_NOT_OPEN: ["This job is closed or archived, so candidates can no longer be linked.", "该岗位已关闭或归档，不能再关联候选人。"],
  NOT_FOUND: ["The job or file was not found.", "岗位或文件不存在。"],
  INVALID_SCHEMA: ["Please check the form fields.", "请检查表单字段。"],
};

const codeOf = (e: unknown) => (e instanceof ApiCodeError ? e.code : "REQUEST_FAILED");
const newKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const jobMeta = (job: ExternalJob) => [job.team, job.location, job.seniority].filter(Boolean).join(" · ") || job.status;

/**
 * "New written test": a job — new JD text (pasted, or read from a JD file) or an existing job from
 * Core Record — plus one résumé. POST /quick-start creates the job in the JD subsystem (deduping an
 * identical JD) and lands the case in the same state a screening hand-off gives it. Same flow and
 * layout as hireos-interview's CreateProjectModal, except the résumé is required (a written-test case
 * is always a candidate + job pair).
 */
export function CreateWrittenTaskModal({ open, onClose, onCreated }: {
  open: boolean;
  onClose: () => void;
  onCreated: (result: QuickStartResult) => void;
}) {
  const { t, state } = useStore();
  const zh = state.lang === "zh";
  const [mode, setMode] = useState<JdMode>("new");
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<{ name: string; materialId?: string }>();
  const [jdFileBusy, setJdFileBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalJob[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickedJob, setPickedJob] = useState<ExternalJob>();
  const [resume, setResume] = useState<ResumeUpload>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef({ jd: 0, search: 0, resume: 0 });

  const errorText = (code: string) => (ERRORS[code] || ERRORS.REQUEST_FAILED)[zh ? 1 : 0];
  const busy = creating || jdFileBusy || Boolean(resume?.uploading);

  function reset() {
    generation.current = { jd: generation.current.jd + 1, search: generation.current.search + 1, resume: generation.current.resume + 1 };
    setMode("new"); setJdText(""); setJdFile(undefined); setJdFileBusy(false);
    setQuery(""); setResults([]); setSearching(false); setPickedJob(undefined);
    setResume(undefined); setError("");
  }

  function close() {
    if (creating) return;
    reset();
    onClose();
  }

  async function pickJdFile(file: File) {
    const g = ++generation.current.jd;
    setJdFile({ name: file.name }); setJdFileBusy(true); setError("");
    try {
      const material = await uploadMaterial(file);
      if (g !== generation.current.jd) return;
      if (material.errorCode || !material.text.trim()) { setError(material.errorCode || "NO_EXTRACTABLE_TEXT"); return; }
      setJdText(material.text); setJdFile({ name: file.name, materialId: material.id });
    } catch (e) { if (g === generation.current.jd) setError(codeOf(e)); }
    finally { if (g === generation.current.jd) setJdFileBusy(false); }
  }

  // Editing the text by hand means it no longer is the file's text.
  function editJdText(text: string) {
    setJdText(text);
    if (jdFile?.materialId) setJdFile(undefined);
  }

  async function search(q: string) {
    setQuery(q);
    const g = ++generation.current.search;
    setSearching(true); setError("");
    try {
      const rows = await searchExternalJobs(q);
      if (g === generation.current.search) setResults(rows);
    } catch (e) { if (g === generation.current.search) setError(codeOf(e)); }
    finally { if (g === generation.current.search) setSearching(false); }
  }

  function switchMode(next: JdMode) {
    setMode(next); setError("");
    if (next === "existing" && !results.length && !searching) void search(query);
  }

  async function pickResume(file: File) {
    const g = ++generation.current.resume;
    setResume({ name: file.name, file, uploading: true }); setError("");
    try {
      const material = await uploadMaterial(file);
      if (g === generation.current.resume) setResume({ name: file.name, file, material, uploading: false, error: material.errorCode || undefined });
    } catch (e) { if (g === generation.current.resume) setResume({ name: file.name, file, uploading: false, error: codeOf(e) }); }
  }

  async function create() {
    if (mode === "new" && !jdText.trim()) { setError("JD_REQUIRED"); return; }
    if (mode === "existing" && !pickedJob) { setError("JOB_REQUIRED"); return; }
    if (!resume) { setError("RESUME_REQUIRED"); return; }
    if (!resume.material || resume.error) { setError(resume.error || "MATERIAL_NOT_AVAILABLE"); return; }
    setCreating(true); setError("");
    try {
      const jd = mode === "new" ? { text: jdText, ...(jdFile?.materialId ? { materialId: jdFile.materialId } : {}) } : { coreJobId: pickedJob!.id };
      const result = await quickStart({ jd, resumeMaterialId: resume.material.id }, newKey());
      reset();
      onCreated(result);
    } catch (e) { setError(codeOf(e)); }
    finally { setCreating(false); }
  }

  const label = { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } as const;
  const sub = { fontSize: 11.5, color: "var(--text-tertiary)" } as const;

  return (
    <Modal open={open} footer={null} closable={false} width={640} centered destroyOnHidden onCancel={close}
      styles={{ body: { padding: 0 }, content: { padding: "26px 28px 22px", borderRadius: 18 } }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: ".08em", color: "var(--text-tertiary)", textTransform: "uppercase" }}>{t("New written test")}</div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{t("Start with a job description")}</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>{t("A JD and the candidate's résumé are all you need.")}</div>
        </div>
        <button aria-label={t("Close")} onClick={close} style={{ flex: "none", width: 28, height: 28, border: 0, background: "transparent", color: "var(--text-tertiary)", cursor: "pointer" }}>
          <Icon name="close" />
        </button>
      </div>

      <div role="tablist" style={{ marginTop: 20, display: "inline-flex", padding: 3, gap: 2, borderRadius: 10, background: "var(--surface-alt)" }}>
        {(["new", "existing"] as const).map((m) => {
          const active = mode === m;
          return (
            <button key={m} role="tab" aria-selected={active} onClick={() => switchMode(m)}
              style={{
                height: 30, padding: "0 14px", border: 0, borderRadius: 8, cursor: "pointer", fontSize: 12.5,
                fontWeight: active ? 700 : 600, background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)", boxShadow: active ? "var(--shadow-1)" : "none",
              }}>
              {m === "new" ? t("Paste a new JD") : t("Choose an existing job")}
            </button>
          );
        })}
      </div>

      {mode === "new" && (
        <div style={{ marginTop: 16 }}>
          <label htmlFor="writtenJdText" style={label}>{t("Job description")}</label>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>{t("Required")}</div>
          <textarea id="writtenJdText" value={jdText} onChange={(e) => editJdText(e.target.value)} placeholder={t("Paste the job description here…")}
            style={{ marginTop: 8, width: "100%", height: 150, border: "1px solid var(--border-strong)", borderRadius: 11, padding: "12px 14px", fontSize: 13, color: "var(--text-secondary)", background: "var(--surface)", lineHeight: 1.55, resize: "none", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
          <label htmlFor="writtenJdFile"
            style={{ marginTop: 14, width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", border: "1px dashed var(--border-strong)", borderRadius: 12, background: "var(--surface-alt)", cursor: jdFileBusy ? "progress" : "pointer", boxSizing: "border-box" }}>
            <input id="writtenJdFile" type="file" accept=".pdf,.docx,.txt" disabled={jdFileBusy} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickJdFile(f); e.target.value = ""; }} />
            <Icon name="description" style={{ color: "var(--accent)" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{jdFile?.name || t("Choose JD file")}</div>
              <div style={sub}>{jdFileBusy ? t("Uploading and reading…") : t("PDF, DOCX, or TXT · up to 10 MB")}</div>
            </div>
          </label>
        </div>
      )}

      {mode === "existing" && !pickedJob && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid var(--border-strong)", borderRadius: 11, background: "var(--surface)" }}>
            <Icon name="search" style={{ color: "var(--text-tertiary)" }} />
            <input autoFocus aria-label={t("Search by job title…")} value={query} onChange={(e) => void search(e.target.value)} placeholder={t("Search by job title…")}
              style={{ flex: 1, border: 0, outline: "none", fontSize: 13.5, background: "transparent", color: "var(--text-primary)" }} />
          </div>
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {searching && <div style={{ ...sub, padding: "10px 2px" }}>{t("Loading…")}</div>}
            {!searching && results.length === 0 && <div style={{ ...sub, padding: "10px 2px" }}>{t("No matching jobs.")}</div>}
            {results.map((job) => (
              <button key={job.id} onClick={() => setPickedJob(job)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: "1px solid var(--border)", borderRadius: 11, background: "var(--surface)", cursor: "pointer", textAlign: "left" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{job.title}</div>
                  <div style={{ ...sub, marginTop: 2 }}>{jobMeta(job)}</div>
                </div>
                <Icon name="arrow_forward" style={{ color: "var(--text-tertiary)" }} />
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === "existing" && pickedJob && (
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", border: "1px solid var(--border-strong)", borderRadius: 11, background: "var(--surface-alt)" }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-primary)" }}>{pickedJob.title}</div>
            <div style={{ ...sub, marginTop: 2 }}>{jobMeta(pickedJob)}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setPickedJob(undefined)}>{t("Change job")}</Button>
        </div>
      )}

      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={label}>{t("Candidate résumé")}</div>
          <div style={{ marginTop: 3, fontSize: 11, fontWeight: 700, color: "var(--danger)" }}>{t("Required")}</div>
        </div>
        <label htmlFor="writtenResumeFile" style={{ flex: "none", display: "flex", alignItems: "center", gap: 5, color: "var(--accent)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          <input id="writtenResumeFile" type="file" accept=".pdf,.docx,.txt" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void pickResume(f); e.target.value = ""; }} />
          {!resume && <Icon name="add" style={{ fontSize: 16 }} />}
          {resume ? t("Replace") : t("Upload résumé")}
        </label>
      </div>

      {resume && (
        <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 9, background: "var(--surface-alt)", fontSize: 12 }}>
          <Icon name="description" style={{ fontSize: 16, color: "var(--text-tertiary)" }} />
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
            {resume.name}
            <small style={{ display: "block", whiteSpace: "normal", color: resume.error ? "var(--danger)" : "var(--text-tertiary)" }}>
              {resume.uploading ? t("Uploading and reading…") : resume.error ? errorText(resume.error) : t("Readable")}
            </small>
          </span>
          {resume.error && !resume.material && <Button variant="ghost" size="sm" onClick={() => void pickResume(resume.file)}>{t("Retry")}</Button>}
          <button aria-label={t("Remove")} onClick={() => { generation.current.resume++; setResume(undefined); }}
            style={{ border: 0, background: "transparent", color: "var(--text-tertiary)", cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>
      )}

      {error && <div role="alert" style={{ marginTop: 12, fontSize: 12.5, color: "var(--danger)" }}>{errorText(error)}</div>}
      <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
        <Button variant="ghost" onClick={close}>{t("Cancel")}</Button>
        <Button variant="primary" onClick={() => void create()} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
          {creating ? (mode === "new" ? t("AI is reading the JD…") : t("Creating…")) : t("Create task")}
          <Icon name="arrow_forward" style={{ fontSize: 16 }} />
        </Button>
      </div>
    </Modal>
  );
}
