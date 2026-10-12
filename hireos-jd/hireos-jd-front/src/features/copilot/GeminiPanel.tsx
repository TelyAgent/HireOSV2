import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "antd";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { mkBlock } from "../../data/fixtures/documents";
import { docKey, normalizeBlocks } from "../workspace/docHelpers";
import { nowISO, uid } from "../../lib/format";
import {
  autoCompleteCopilotConversation,
  confirmCopilotDraft,
  createCopilotConversation,
  generateCopilotTitleVariants,
  getCopilotConversation,
  importCopilotSource,
  listCopilotConversations,
  setCopilotFields,
  streamCopilotMessage,
  uploadCopilotAttachment,
  type CopilotConversationDto,
  type CopilotJdFields,
} from "./copilotApi";
import { updateJobFields } from "../jobs/jobsApi";
import { VoiceInputButton, type VoiceInputStatus } from "./VoiceInputButton";
import { mergeVoiceTranscript } from "../../lib/voice-stream";
import { fmtRelative } from "../../lib/format";
import type { Audience, Requirement } from "../../data/types";
import type { ConversationActionOption, GeminiCreatePath, GeminiDraft, GeminiMsg } from "../../store/types";

/** Converts a fetched conversation's raw messages back into the panel's bubble shapes. There's no
 * per-message phase snapshot server-side, so a conversation that's currently ready to confirm gets its
 * trailing assistant reply swapped for the draft card — matching what a live turn would have shown. */
function conversationToGeminiMsgs(dto: CopilotConversationDto): GeminiMsg[] {
  const msgs: GeminiMsg[] = dto.messages.map((m): GeminiMsg =>
    m.role === "user" ? { role: "user", text: m.text || "" } : { role: "ai", text: m.text || "" },
  );
  if (dto.phase === "ready_to_confirm") {
    if (msgs.length && msgs[msgs.length - 1].role === "ai") msgs.pop();
    msgs.push({ role: "ai", draft: jdFieldsToGeminiDraft(dto.fields) });
  }
  return msgs;
}

export function jdFieldsToGeminiDraft(fields: CopilotJdFields): GeminiDraft {
  return {
    title: fields.title || "New Role",
    department: fields.department || "General",
    location: fields.location,
    headcount: fields.headcount,
    employmentType: fields.employmentType,
    summary: fields.roleSummary,
    responsibilities: fields.responsibilities && fields.responsibilities.length > 0 ? fields.responsibilities : [],
    must: fields.mustHave && fields.mustHave.length > 0 ? fields.mustHave : [],
    pref: fields.niceToHave,
  };
}

export interface GeminiCtx {
  mode: "create";
  jobId: string | null;
  audience: Audience;
  selText: string | null;
}

export function chatKey(ctx: GeminiCtx) {
  return ctx.mode === "create" ? "new" : `${ctx.jobId}:${ctx.audience}`;
}

/** "New job" entry point — opens the create-mode Copilot drawer in place (prototype's `A.openGeminiPanel('create', null)`). */
export function useOpenCreateJob() {
  const { openDrawer } = useStore();
  return () =>
    openDrawer(<GeminiPanel ctx={{ mode: "create", jobId: null, audience: "internal", selText: null }} />, {
      drawerClass: "gemini-drawer-shell",
      overlayClass: "gemini-overlay",
    });
}

// Matches the backend's `jd-autotake` skill exactly: this literal string is both the button's tooltip
// and the synthetic user-turn text sent to `/auto-complete`, so the chat bubble reads the same as the
// action the user just took (same pattern as the old project's autotake trigger copy).
const AUTO_COMPLETE_LABEL = "自动补全并优化内容";

/* ---- Create-a-job home: five parallel ways in (prototype's GM_PATHS) ---- */
const CREATE_PATHS: { key: Exclude<GeminiCreatePath, "home">; icon: string; title: string; short: string; what: string; benefit: string; todo: string }[] = [
  {
    key: "questions",
    icon: "quiz",
    title: "Quick Start",
    short: "Answer 3 questions to create your JD.",
    what: "Copilot asks about the difficulty you face, the problem the hire should solve and the must-have hard skills, then writes the JD.",
    benefit: "You don’t need to know how a JD should look.",
    todo: "Answer 3 short questions by typing or voice.",
  },
  {
    key: "title",
    icon: "badge",
    title: "Start with a Job Title",
    short: "Enter a title and get 3 JD options.",
    what: "Give a job title and get 3 JD versions in different styles to choose from.",
    benefit: "Fastest way to compare options side by side.",
    todo: "Type a job title.",
  },
  {
    key: "upload",
    icon: "upload_file",
    title: "Upload a JD",
    short: "Upload an existing JD to refine and structure it.",
    what: "Copilot reads your file and turns it into a structured JD.",
    benefit: "Reuses what you already have — no rewriting.",
    todo: "Choose a PDF, DOCX or TXT file.",
  },
  {
    key: "link",
    icon: "link",
    title: "Paste a Link or Text",
    short: "Paste a job posting link or the full JD text.",
    what: "Copilot reads a job posting page, or the JD text you paste, and rewrites it for your company.",
    benefit: "Reuse any posting or copied JD without retyping.",
    todo: "Paste a job posting link or the full text of a JD.",
  },
  {
    key: "form",
    icon: "edit_note",
    title: "Create Manually",
    short: "Fill in the details to build your own JD.",
    what: "Enter the job details yourself and save — no AI drafting.",
    benefit: "Full control over every field.",
    todo: "Fill in the basics, responsibilities and requirements, then save.",
  },
];

const QUICK_START_QUESTIONS = [
  "What difficulty are you running into that makes you want to hire?",
  "What problem do you want the candidate to solve?",
  "What hard skills must the candidate have?",
];

const COMPOSER_PLACEHOLDERS: Record<GeminiCreatePath, string> = {
  home: "Or describe the role in your own words…",
  questions: "Type or speak your answer…",
  title: "Job title, e.g. Growth Operations Manager",
  upload: "Or describe the role in your own words…",
  link: "Paste a link or the JD text…",
  form: "Fill in the form above…",
};

const JD_FILE_ACCEPT =
  ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

function resultToMsg(result: CopilotConversationDto): GeminiMsg {
  const lastReply = result.messages[result.messages.length - 1];
  return result.phase === "ready_to_confirm"
    ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields) }
    : { role: "ai", text: lastReply?.text || "" };
}

/** Splits a textarea into list items, dropping bullets/numbering the user typed. */
function toLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)、])\s*/, "").trim())
    .filter(Boolean);
}

/**
 * "Ask Copilot" — the Gemini-in-Docs-style voice/chat drawer. A parallel
 * entry point to the in-document selection Copilot: it drafts content here
 * first and nothing changes in the document until the user inserts it.
 */
export function GeminiPanel({ ctx }: { ctx: GeminiCtx }) {
  const { state, t, mutate, say, closeModal } = useStore();
  const navigate = useNavigate();
  const key = chatKey(ctx);
  const msgs = state.geminiChats[key] ?? [];
  const path: GeminiCreatePath = state.geminiCreatePaths[key] ?? "home";

  const [input, setInput] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyItems, setHistoryItems] = useState<CopilotConversationDto[]>([]);
  const [attaching, setAttaching] = useState(false);
  const voiceBaseInputRef = useRef<string | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const working = busy || attaching;
  const errorText = (error: unknown) =>
    error instanceof Error && error.message ? error.message : t("Sorry, Copilot couldn’t process that just now. Please try again.");

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const push = (msg: GeminiMsg) =>
    mutate((draft) => {
      draft.geminiChats = { ...draft.geminiChats, [key]: [...(draft.geminiChats[key] ?? []), msg] };
    });

  /** Swaps the trailing "thinking" dots for the real reply. */
  const resolveThinking = (msg: GeminiMsg) =>
    mutate((draft) => {
      const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
      draft.geminiChats = { ...draft.geminiChats, [key]: [...list, msg] };
    });

  const updateMsg = (index: number, patch: Partial<Extract<GeminiMsg, { kind: "upload" | "form" | "variants" }>>) =>
    mutate((draft) => {
      const list = [...(draft.geminiChats[key] ?? [])];
      const current = list[index];
      if (current && current.role === "ai" && current.kind) list[index] = { ...current, ...patch } as GeminiMsg;
      draft.geminiChats = { ...draft.geminiChats, [key]: list };
    });

  const setPath = (next: GeminiCreatePath) =>
    mutate((draft) => {
      draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: next };
    });

  const ensureConversation = async () => {
    const existing = state.geminiConversationIds[key];
    if (existing) return existing;
    const conversation = await createCopilotConversation();
    mutate((draft) => {
      draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
    });
    return conversation.id;
  };

  /** Runs one backend step behind the "thinking" dots; `autoFill` finishes an incomplete extraction in a second auto-complete turn. */
  const runStep = async (step: (conversationId: string) => Promise<CopilotConversationDto>, autoFill = false) => {
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      let result = await step(conversationId);
      // Only when the source actually described a role — otherwise keep Copilot's reply instead of inventing a JD.
      if (autoFill && result.phase !== "ready_to_confirm" && result.fields.title) {
        result = await autoCompleteCopilotConversation(conversationId);
      }
      resolveThinking(resultToMsg(result));
      return true;
    } catch (error) {
      resolveThinking({ role: "ai", text: errorText(error) });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const sendCreate = async (text: string) => {
    setBusy(true);
    let streaming = false;
    let accumulatedText = "";
    try {
      const conversationId = await ensureConversation();
      const result = await streamCopilotMessage(conversationId, text, (delta) => {
        accumulatedText += delta;
        mutate((draft) => {
          const list = draft.geminiChats[key] ?? [];
          // First delta: swap the "thinking" dots for a live bubble that grows as more text arrives.
          const base = streaming ? list.slice(0, -1) : list.filter((m) => m.role !== "thinking");
          draft.geminiChats = { ...draft.geminiChats, [key]: [...base, { role: "ai", text: accumulatedText }] };
        });
        streaming = true;
      });
      // Streamed text is cosmetic — swap in the authoritative committed result (draft card or final text).
      const finalReply = resultToMsg(result);
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        draft.geminiChats = { ...draft.geminiChats, [key]: [...(streaming ? list.slice(0, -1) : list), finalReply] };
      });
    } catch {
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        const errorReply: GeminiMsg = { role: "ai", text: t("Sorry, Copilot couldn’t process that just now. Please try again.") };
        draft.geminiChats = { ...draft.geminiChats, [key]: [...(streaming ? list.slice(0, -1) : list), errorReply] };
      });
    } finally {
      setBusy(false);
    }
  };

  /** Quick Start: the three answers go to auto-complete in one turn, which writes the whole JD. */
  const runQuickStart = async (answers: string) => {
    const brief = [
      "我选择了「快速开始」。以下是我对这 3 个问题的回答，请据此直接生成一份完整 JD：",
      ...QUICK_START_QUESTIONS.map((q, i) => `${i + 1}. ${t(q)}`),
      "",
      "我的回答：",
      answers,
    ].join("\n");
    if (await runStep((conversationId) => autoCompleteCopilotConversation(conversationId, brief))) setPath("home");
  };

  const runTitleVariants = async (title: string) => {
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      const result = await generateCopilotTitleVariants(conversationId, title);
      resolveThinking({ role: "ai", kind: "variants", title: result.title, variants: result.variants });
      setPath("home");
    } catch (error) {
      resolveThinking({ role: "ai", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (text: string) => {
    if (/^https?:\/\/\S+$/i.test(text)) {
      if (await runStep((conversationId) => importCopilotSource(conversationId, { url: text }), true)) setPath("home");
      return;
    }
    if (text.length < 20) {
      push({ role: "ai", text: t("That doesn’t look like a link or a JD. Paste a job posting URL (starting with http:// or https://) or the full JD text.") });
      return;
    }
    if (await runStep((conversationId) => importCopilotSource(conversationId, { text }), true)) setPath("home");
  };

  const send = (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || working) return;
    setInput("");
    push({ role: "user", text });
    if (path === "questions") return void runQuickStart(text);
    if (path === "title") return void runTitleVariants(text);
    if (path === "link") return void runImport(text);
    if (path === "form") {
      push({ role: "ai", text: t("Please fill in the form above, then press Save.") });
      return;
    }
    if (path !== "home") setPath("home");
    push({ role: "thinking" });
    void sendCreate(text);
  };

  const startPath = (p: (typeof CREATE_PATHS)[number]) => {
    if (working) return;
    // The file dialog has to open inside the click gesture, before any state update.
    if (p.key === "upload") attachFileInputRef.current?.click();
    setPath(p.key);
    push({ role: "user", text: t(p.title) });
    if (p.key === "questions") {
      push({
        role: "ai",
        text: [
          t("Happy to help. Answer these 3 short questions in one message (one line each), by typing or tapping the microphone, and I’ll write the JD."),
          ...QUICK_START_QUESTIONS.map((q, i) => `${i + 1}. ${t(q)}`),
        ].join("\n"),
      });
    } else if (p.key === "title") {
      push({ role: "ai", text: t("Sure — what’s the job title? Type it below and I’ll draft 3 versions in different styles for you to choose from.") });
    } else if (p.key === "upload") {
      push({ role: "ai", kind: "upload", text: t("Sure — choose the file you’d like to use (PDF, DOCX or TXT) and I’ll turn it into a structured JD.") });
    } else if (p.key === "link") {
      push({ role: "ai", text: t("Sure — paste a job posting link or the full text of a JD below, and I’ll turn it into a JD for your company.") });
    } else {
      push({ role: "ai", kind: "form", text: t("Sure — fill in the details below and save. Job title, location, headcount, responsibilities and requirements are required.") });
    }
    if (p.key !== "upload" && p.key !== "form") setTimeout(() => composerRef.current?.focus(), 0);
  };

  const handleVoicePartial = (transcript: string) => {
    if (voiceBaseInputRef.current === null) voiceBaseInputRef.current = input;
    setInput(mergeVoiceTranscript(voiceBaseInputRef.current, transcript));
  };

  const handleVoiceFinal = (transcript: string) => {
    setInput(mergeVoiceTranscript(voiceBaseInputRef.current ?? input, transcript));
    voiceBaseInputRef.current = null;
  };

  const handleVoiceError = (message: string) => {
    voiceBaseInputRef.current = null;
    say(message, { type: "error" });
  };

  const startNewConversation = async () => {
    if (working) return;
    setHistoryOpen(false);
    try {
      const conversation = await createCopilotConversation();
      mutate((draft) => {
        draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
        draft.geminiChats = { ...draft.geminiChats, [key]: [] };
        draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: "home" };
      });
      setInput("");
    } catch {
      say(t("Sorry, Copilot couldn’t process that just now. Please try again."), { type: "error" });
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryError("");
    try {
      setHistoryItems(await listCopilotConversations());
    } catch (error) {
      setHistoryError(errorText(error));
    } finally {
      setHistoryLoading(false);
    }
  };

  const selectHistoryItem = async (id: string) => {
    if (working) return;
    try {
      const conversation = await getCopilotConversation(id);
      mutate((draft) => {
        draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
        draft.geminiChats = { ...draft.geminiChats, [key]: conversationToGeminiMsgs(conversation) };
        draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: "home" };
      });
      setHistoryOpen(false);
      setInput("");
    } catch (error) {
      setHistoryError(errorText(error));
    }
  };

  const handleAttachFile = async (file: File) => {
    // Picked from the "Upload a JD" card: refine an incomplete extraction straight into a full draft.
    const fromUploadPath = path === "upload";
    mutate((draft) => {
      const list = (draft.geminiChats[key] ?? []).map((m) => (m.role === "ai" && m.kind === "upload" ? { ...m, done: true } : m));
      draft.geminiChats = { ...draft.geminiChats, [key]: list };
    });
    push({ role: "user", text: `[${t("Uploaded file")}] ${file.name}` });
    setAttaching(true);
    try {
      if (await runStep((conversationId) => uploadCopilotAttachment(conversationId, file), fromUploadPath)) setPath("home");
    } finally {
      setAttaching(false);
    }
  };

  const handleAutoComplete = async () => {
    if (working) return;
    push({ role: "user", text: AUTO_COMPLETE_LABEL });
    await runStep((conversationId) => autoCompleteCopilotConversation(conversationId));
  };

  const createJobFromDraft = async (d: GeminiDraft, seniority?: string) => {
    // Confirms the draft as a real Job on the Core Record service and uses its real id, so the job
    // this navigates to is the same one the Job Library page (which now reads real backend data) will
    // show. Only falls back to a local-only fixture id if the backend call itself fails.
    const conversationId = state.geminiConversationIds[key];
    let newId: string;
    try {
      if (!conversationId) throw new Error("No conversation to confirm.");
      newId = (await confirmCopilotDraft(conversationId)).jobId;
      if (seniority) await updateJobFields(newId, { seniority }).catch((error) => console.warn("Failed to save the job level:", error));
    } catch (error) {
      console.warn("Copilot confirm-draft failed, falling back to a local-only job:", error);
      newId = uid("job-gen");
    }
    mutate((draft) => {
      draft.jobs[newId] = {
        id: newId,
        title: d.title,
        department: d.department,
        team: d.department,
        location: d.location || "Ho Chi Minh City, VN",
        employmentType: d.employmentType || "Full-time",
        workplaceType: "Hybrid",
        level: seniority || "Mid",
        priority: "normal",
        headcount: d.headcount || 1,
        hiringManager: draft.currentUserId,
        recruiter: draft.currentUserId,
        owner: draft.currentUserId,
        hiringStatus: "draft",
        activeRoleVersionRef: null,
        collaborationStatus: "ready",
        draftRevision: 1,
        createdAt: nowISO(),
        updatedAt: nowISO(),
        approvalStatus: "not_submitted",
        activationStatus: "not_requested",
        publicationStatus: "not_published",
        story: "Created live via the Ask Copilot voice/chat flow (Gemini-style creation panel).",
      };
      const mkReq = (s: string, id: string, priority: Requirement["priority"]): Requirement => ({
        id,
        statement: s,
        category: "experience",
        priority,
        evaluationType: "scored",
        dimensionId: null,
        evidenceStandard: "Not specified — Copilot-drafted; confirm evidence standard before approval.",
        dataStatus: "disputed",
      });
      draft.requirements[newId] = [
        ...d.must.map((s, i) => mkReq(s, `${newId}-must-${i}`, "must_have")),
        ...(d.pref ?? []).map((s, i) => mkReq(s, `${newId}-pref-${i}`, "preferred")),
      ];
      let n = 1;
      const bid = () => "g" + newId.slice(-4) + "-" + n++;
      draft.drafts[docKey(newId)] = {
        id: "doc-" + newId,
        jobId: newId,
        audience: "internal",
        language: "en",
        revision: 1,
        saveState: "saved",
        blocks: normalizeBlocks([
          mkBlock(bid(), "h2", d.title),
          mkBlock(bid(), "p", d.summary || "Drafted live with Ask Copilot from a spoken/typed description."),
          mkBlock(bid(), "h2", "Responsibilities"),
          mkBlock(bid(), "ul", d.responsibilities),
          mkBlock(bid(), "h2", "Requirements"),
          mkBlock(bid(), "ul", d.must),
          ...(d.pref && d.pref.length ? [mkBlock(bid(), "h2", "Preferred"), mkBlock(bid(), "ul", d.pref)] : []),
        ]),
      };
      (draft.activity[newId] = draft.activity[newId] || []).unshift({
        at: nowISO(),
        actor: draft.currentUserId,
        text: "Created this job from a description via Ask Copilot (voice/chat).",
        tag: "AI",
      });
    });
    say(`${t("Created")} “${d.title}” ${t("from your description")}`);
    push({
      role: "ai",
      text: t("The JD is created. You can"),
      options: [{ id: `view-jd:${newId}`, label: t("View the created JD"), href: `/jobs/${newId}/document` }],
    });
  };

  /** Saves user-picked/authored fields on the conversation, then creates the job from them. */
  const createFromFields = async (fields: CopilotJdFields, label: string, seniority?: string) => {
    if (working) return false;
    setBusy(true);
    try {
      const conversationId = await ensureConversation();
      const result = await setCopilotFields(conversationId, fields, label);
      push({ role: "user", text: label });
      await createJobFromDraft(jdFieldsToGeminiDraft(result.fields), seniority);
      return true;
    } catch (error) {
      say(errorText(error), { type: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pickVariant = async (index: number, variantIndex: number) => {
    const msg = msgs[index];
    if (!msg || msg.role !== "ai" || msg.kind !== "variants") return;
    const v = msg.variants[variantIndex];
    const label = `${t("Create job with version %s").replace("%s", String.fromCharCode(65 + variantIndex))} · ${t(v.label)}`;
    if (await createFromFields(v.fields, label)) updateMsg(index, { picked: variantIndex });
  };

  const submitForm = async (index: number, fields: CopilotJdFields, seniority: string) => {
    if (await createFromFields(fields, `${t("Create Manually")}: ${fields.title}`, seniority || undefined)) {
      updateMsg(index, { done: true });
      setPath("home");
    }
  };

  const handleSelectOption = (option: ConversationActionOption) => {
    closeModal();
    navigate(option.href);
  };

  return (
    <div className="gemini-panel">
      <div className="gemini-panel-header">
        <span className="gp-icon material-icons-o">auto_awesome</span>
        <div className="gp-title">{historyOpen ? t("History") : t("Ask Copilot")}</div>
        <div style={{ flex: 1 }} />
        {!historyOpen && (
          <>
            <button className="icon-btn" type="button" disabled={working} onClick={() => void startNewConversation()} title={t("New conversation")} aria-label={t("New conversation")}>
              <Icon name="edit_square" />
            </button>
            <button className="icon-btn" type="button" disabled={working} onClick={() => void openHistory()} title={t("Conversation history")} aria-label={t("Conversation history")}>
              <Icon name="history" />
            </button>
          </>
        )}
        {historyOpen && (
          <button className="icon-btn" type="button" onClick={() => setHistoryOpen(false)} title={t("Back")} aria-label={t("Back")}>
            <Icon name="arrow_back" />
          </button>
        )}
        <button className="close-x" onClick={closeModal} aria-label={t("Close")}>
          <Icon name="close" />
        </button>
      </div>
      {historyOpen ? (
        <div className="gemini-messages">
          {historyLoading && <div className="gm-empty">{t("Loading…")}</div>}
          {!historyLoading && historyError && (
            <div className="gm-empty" role="alert">
              {historyError}
            </div>
          )}
          {!historyLoading && !historyError && historyItems.length === 0 && <div className="gm-empty">{t("No conversations yet.")}</div>}
          {!historyLoading
            && !historyError
            && historyItems.map((item) => (
              <button key={item.id} className="gm-chip" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }} onClick={() => void selectHistoryItem(item.id)}>
                <strong>{item.fields.title || t("Untitled conversation")}</strong>
                <div className="tiny">{fmtRelative(item.updatedAt)}</div>
              </button>
            ))}
        </div>
      ) : (
        <div className="gemini-messages" ref={messagesRef}>
          {msgs.length === 0 ? (
            <CreateHub onStart={startPath} />
          ) : (
            msgs.map((m, i) => (
              <GeminiMessage
                key={i}
                msg={m}
                busy={working}
                onCreate={createJobFromDraft}
                onSelectOption={handleSelectOption}
                onChooseFile={() => attachFileInputRef.current?.click()}
                onPickVariant={(variantIndex) => void pickVariant(i, variantIndex)}
                onSubmitForm={(fields, seniority) => void submitForm(i, fields, seniority)}
              />
            ))
          )}
        </div>
      )}
      {!historyOpen && (
        <div className="gemini-input-wrap">
          {voiceStatus === "connecting" && (
            <div className="gm-listening-row">
              <span className="gm-dot" />
              {t("Connecting…")}
            </div>
          )}
          <div className="gemini-composer-shell">
            <textarea
              ref={composerRef}
              rows={1}
              placeholder={t(COMPOSER_PLACEHOLDERS[path])}
              value={input}
              disabled={voiceStatus !== "idle"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              autoFocus
            />
            <div className="gemini-composer-footer">
              <div className="gemini-composer-tools">
                <button
                  className="gemini-composer-tool"
                  type="button"
                  disabled={working}
                  onClick={() => attachFileInputRef.current?.click()}
                  title={t("Upload source material")}
                  aria-label={t("Upload source material")}
                >
                  <Icon name="add" />
                </button>
                <button
                  className="gemini-composer-tool"
                  type="button"
                  disabled={working}
                  onClick={() => void handleAutoComplete()}
                  title={AUTO_COMPLETE_LABEL}
                  aria-label={AUTO_COMPLETE_LABEL}
                >
                  <Icon name="auto_fix_high" />
                </button>
                <input
                  ref={attachFileInputRef}
                  type="file"
                  accept={JD_FILE_ACCEPT}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void handleAttachFile(file);
                  }}
                />
              </div>
              <VoiceWaveform level={voiceLevel} listening={voiceStatus === "listening"} />
              <div className="gemini-composer-actions">
                <VoiceInputButton
                  disabled={working}
                  onPartialTranscript={handleVoicePartial}
                  onTranscript={handleVoiceFinal}
                  onError={handleVoiceError}
                  onStatusChange={setVoiceStatus}
                  onAudioLevelChange={setVoiceLevel}
                />
                <button className="gm-send-btn" onClick={() => send()} aria-label={t("Send")}>
                  <Icon name="send" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The empty-conversation home: "Create a Job" and its five starting points. */
function CreateHub({ onStart }: { onStart: (p: (typeof CREATE_PATHS)[number]) => void }) {
  const { t } = useStore();
  return (
    <div className="gm-hub">
      <div className="gm-hub-intro">
        <div className="gm-hub-h">{t("Create a Job")}</div>
        <div className="gm-hub-sub">{t("Choose how you’d like to start.")}</div>
      </div>
      {CREATE_PATHS.map((p) => (
        <div
          key={p.key}
          className="gm-path"
          role="button"
          tabIndex={0}
          onClick={() => onStart(p)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onStart(p);
            }
          }}
        >
          <span className="gm-path-ico">
            <Icon name={p.icon} />
          </span>
          <span className="gm-path-body">
            <span className="gm-path-t">
              {t(p.title)}
              <Tooltip
                placement="bottom"
                title={
                  <div className="gm-path-tip">
                    <div>{t(p.what)}</div>
                    <div>
                      <b>{t("Good for:")}</b> {t(p.benefit)}
                    </div>
                    <div>
                      <b>{t("You:")}</b> {t(p.todo)}
                    </div>
                  </div>
                }
              >
                <button type="button" className="gm-path-help" aria-label={t("More about this option")} onClick={(e) => e.stopPropagation()}>
                  <Icon name="info" />
                </button>
              </Tooltip>
            </span>
            <span className="gm-path-d">{t(p.short)}</span>
          </span>
          <Icon name="chevron_right" className="gm-path-go" />
        </div>
      ))}
    </div>
  );
}

const WAVE_BAR_WEIGHTS = Array.from({ length: 28 }, (_, index) => 0.5 + (index % 5) * 0.1);

/** Live audio-level bars shown in place of the textarea while listening, ported from the old
 * project's `VoiceActivityWaveform` — each bar's height is the live level scaled by a fixed per-bar
 * weight, which is what gives it its slightly uneven, organic look instead of moving as one flat block. */
function VoiceWaveform({ level, listening }: { level: number; listening: boolean }) {
  const { t } = useStore();
  return (
    <div
      className={`gm-wave-bars${listening ? " is-listening" : ""}`}
      role={listening ? "status" : undefined}
      aria-label={listening ? t("Listening…") : undefined}
      aria-hidden={!listening}
    >
      {WAVE_BAR_WEIGHTS.map((weight, index) => (
        <span key={index} className="gm-wave-bar" style={{ transform: `scaleY(${0.2 + level * weight})` }} />
      ))}
    </div>
  );
}

/** Structured JD preview shared by the draft card and the title-variant picker. */
function DraftBody({ d }: { d: GeminiDraft }) {
  const { t } = useStore();
  return (
    <>
      <div className="gm-draft-title">{d.title}</div>
      <div className="tiny">{d.department}</div>
      {d.summary && <p style={{ margin: "8px 0 0" }}>{d.summary}</p>}
      <div style={{ fontWeight: 500, marginTop: 8 }}>{t("Responsibilities")}</div>
      <ul>
        {d.responsibilities.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div style={{ fontWeight: 500, marginTop: 4 }}>{t("Requirements — must-have")}</div>
      <ul>
        {d.must.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {d.pref && d.pref.length > 0 && (
        <>
          <div style={{ fontWeight: 500, marginTop: 4 }}>{t("Preferred")}</div>
          <ul>
            {d.pref.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function VariantPicker({
  msg,
  busy,
  onPick,
}: {
  msg: Extract<GeminiMsg, { kind: "variants" }>;
  busy: boolean;
  onPick: (variantIndex: number) => void;
}) {
  const { t } = useStore();
  const [selected, setSelected] = useState(msg.picked ?? 0);
  const done = msg.picked !== undefined;
  const letter = String.fromCharCode(65 + selected);
  return (
    <div className="gm-bubble ai">
      <div>{t("I’ve drafted “%s” in 3 different styles. Pick the one that fits.").replace("%s", msg.title)}</div>
      <div className="gm-variants">
        {msg.variants.map((v, i) => (
          <button
            key={v.key}
            type="button"
            className={`gm-variant${i === selected ? " active" : ""}`}
            disabled={done}
            onClick={() => setSelected(i)}
          >
            <span className="gm-variant-radio" />
            <span className="gm-variant-txt">
              <b>
                {String.fromCharCode(65 + i)} · {t(v.label)}
              </b>
              <span>{t(v.description)}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="gm-variant-preview">
        <DraftBody d={jdFieldsToGeminiDraft(msg.variants[selected].fields)} />
      </div>
      {!done && (
        <div className="gm-actions">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => onPick(selected)}>
            <Icon name="add_circle" />
            {t("Create job with version %s").replace("%s", letter)}
          </Button>
        </div>
      )}
    </div>
  );
}

const LEVELS = ["Intern", "Junior", "Mid", "Senior", "Staff", "Lead", "Manager", "Director"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

/** "Create Manually": the user writes the JD fields themselves — no AI drafting. */
function ManualJobForm({
  msg,
  busy,
  onSubmit,
}: {
  msg: Extract<GeminiMsg, { kind: "form" }>;
  busy: boolean;
  onSubmit: (fields: CopilotJdFields, seniority: string) => void;
}) {
  const { t, say } = useStore();
  const [values, setValues] = useState({
    title: "",
    location: "",
    headcount: "",
    level: "",
    employmentType: "Full-time",
    department: "",
    summary: "",
    responsibilities: "",
    mustHave: "",
    niceToHave: "",
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (invalid === field) setInvalid(null);
  };
  const fail = (field: string, message: string) => {
    setInvalid(field);
    say(t(message), { type: "error" });
  };

  const submit = () => {
    const headcount = Number(values.headcount);
    if (!values.title.trim()) return fail("title", "Please enter a job title.");
    if (!values.location.trim()) return fail("location", "Please enter a work location.");
    if (!Number.isInteger(headcount) || headcount < 1) return fail("headcount", "Headcount must be a whole number of 1 or more.");
    const responsibilities = toLines(values.responsibilities);
    const mustHave = toLines(values.mustHave);
    const niceToHave = toLines(values.niceToHave);
    if (!responsibilities.length) return fail("responsibilities", "Please add at least one responsibility.");
    if (!mustHave.length) return fail("mustHave", "Please add at least one requirement.");
    onSubmit(
      {
        title: values.title.trim(),
        location: values.location.trim(),
        headcount,
        employmentType: values.employmentType,
        ...(values.department.trim() ? { department: values.department.trim() } : {}),
        ...(values.summary.trim() ? { roleSummary: values.summary.trim() } : {}),
        responsibilities,
        mustHave,
        ...(niceToHave.length ? { niceToHave } : {}),
      },
      values.level,
    );
  };

  if (msg.done) return <div className="gm-bubble ai">{msg.text}</div>;
  const cls = (field: string) => (invalid === field ? "gm-invalid" : undefined);
  return (
    <div className="gm-bubble ai gm-form-bubble">
      <div>{msg.text}</div>
      <div className="gm-inline-form gm-form-grid">
        <label className="full">
          {t("Job title")} *
          <input className={cls("title")} value={values.title} onChange={set("title")} placeholder={t("e.g. Growth Operations Manager")} autoFocus />
        </label>
        <label>
          {t("Location")} *
          <input className={cls("location")} value={values.location} onChange={set("location")} placeholder={t("e.g. Ho Chi Minh City, VN")} />
        </label>
        <label>
          {t("Headcount")} *
          <input className={cls("headcount")} type="number" min={1} step={1} value={values.headcount} onChange={set("headcount")} placeholder={t("e.g. 2")} />
        </label>
        <label>
          {t("Level")}
          <select value={values.level} onChange={set("level")}>
            <option value="">{t("Not set")}</option>
            {LEVELS.map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Employment type")}
          <select value={values.employmentType} onChange={set("employmentType")}>
            {EMPLOYMENT_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(x)}
              </option>
            ))}
          </select>
        </label>
        <label className="full">
          {t("Department")}
          <input value={values.department} onChange={set("department")} placeholder={t("e.g. International Growth")} />
        </label>
        <label className="full">
          {t("Role summary")}
          <textarea rows={2} value={values.summary} onChange={set("summary")} />
        </label>
        <label className="full">
          {t("Responsibilities")} * <span className="gm-hint">{t("one per line")}</span>
          <textarea className={cls("responsibilities")} rows={4} value={values.responsibilities} onChange={set("responsibilities")} />
        </label>
        <label className="full">
          {t("Requirements")} * <span className="gm-hint">{t("one per line")}</span>
          <textarea className={cls("mustHave")} rows={4} value={values.mustHave} onChange={set("mustHave")} />
        </label>
        <label className="full">
          {t("Preferred")} <span className="gm-hint">{t("one per line")}</span>
          <textarea rows={2} value={values.niceToHave} onChange={set("niceToHave")} />
        </label>
        <Button variant="primary" size="sm" className="full" disabled={busy} onClick={submit}>
          {t("Save")}
        </Button>
      </div>
    </div>
  );
}

function GeminiMessage({
  msg,
  busy,
  onCreate,
  onSelectOption,
  onChooseFile,
  onPickVariant,
  onSubmitForm,
}: {
  msg: GeminiMsg;
  busy: boolean;
  onCreate: (draft: GeminiDraft) => void;
  onSelectOption: (option: ConversationActionOption) => void;
  onChooseFile: () => void;
  onPickVariant: (variantIndex: number) => void;
  onSubmitForm: (fields: CopilotJdFields, seniority: string) => void;
}) {
  const { t } = useStore();
  if (msg.role === "user") return <div className="gm-bubble user">{msg.text}</div>;
  if (msg.role === "thinking")
    return (
      <div className="gm-bubble ai">
        <div className="gm-thinking">
          <span />
          <span />
          <span />
        </div>
      </div>
    );
  if (msg.kind === "variants") return <VariantPicker msg={msg} busy={busy} onPick={onPickVariant} />;
  if (msg.kind === "form") return <ManualJobForm msg={msg} busy={busy} onSubmit={onSubmitForm} />;
  if (msg.kind === "upload")
    return (
      <div className="gm-bubble ai">
        <div>{msg.text}</div>
        {!msg.done && (
          <div className="gm-actions">
            <Button variant="primary" size="sm" disabled={busy} onClick={onChooseFile}>
              <Icon name="upload_file" />
              {t("Choose file")}
            </Button>
          </div>
        )}
      </div>
    );
  if (msg.draft) {
    const d = msg.draft;
    return (
      <div className="gm-bubble ai">
        <DraftBody d={d} />
        <div className="gm-actions">
          <Button variant="primary" size="sm" disabled={busy} onClick={() => onCreate(d)}>
            <Icon name="add_circle" />
            {t("Create job from this draft")}
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="gm-bubble ai">
      <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
      {msg.options && msg.options.length > 0 && (
        <div className="gm-msg-options">
          {msg.options.map((option) => (
            <button key={option.id} type="button" className="gm-msg-option" onClick={() => onSelectOption(option)}>
              <Icon name="subdirectory_arrow_right" size={16} />
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
