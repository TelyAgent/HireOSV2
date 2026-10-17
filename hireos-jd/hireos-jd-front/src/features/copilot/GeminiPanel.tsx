import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Tooltip } from "antd";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { mkBlock } from "../../data/fixtures/documents";
import { docKey, normalizeBlocks } from "../workspace/docHelpers";
import { money, nowISO } from "../../lib/format";
import {
  TITLE_UNCONFIRMED,
  autoCompleteCopilotConversation,
  confirmCopilotFields,
  CopilotRequestError,
  confirmCopilotDraft,
  createCopilotConversation,
  generateCopilotTitleVariants,
  getCopilotConversation,
  importCopilotSource,
  refineCopilotDraft,
  refineCopilotVariants,
  listCopilotConversations,
  quickStartCopilotConversation,
  setCopilotFields,
  streamCopilotMessage,
  uploadCopilotAttachment,
  type CopilotConversationDto,
  type CopilotJdFields,
  type CopilotWebAnswer,
} from "./copilotApi";
import { updateJobFields } from "../jobs/jobsApi";
import { CURRENCIES } from "../workspace/SalaryModal";
import { VoiceInputButton, type VoiceInputHandle, type VoiceInputStatus } from "./VoiceInputButton";
import { mergeVoiceTranscript } from "../../lib/voice-stream";
import { fmtRelative } from "../../lib/format";
import type { Audience, Requirement } from "../../data/types";
import type { ConversationActionOption, FieldMetaMap, GeminiCreatePath, GeminiCreateRetry, GeminiDraft, GeminiMsg, GeminiOrigin, GeminiRequestRetry, GeminiVariant } from "../../store/types";
import { ATTACHMENT_FILE_EMPTY, ATTACHMENT_TOO_LARGE, HISTORY_ROUNDS, HISTORY_TRIMMED, MAX_ATTACHMENT_MB, describeCopilotError } from "./copilotErrors";
import { toGroupedLines, toLines } from "./formLines";
import { safeRandomUUID } from "../../lib/uuid";

/** Converts a fetched conversation's raw messages back into the panel's bubble shapes. There's no
 * per-message phase snapshot server-side, so a conversation that's currently ready to confirm gets its
 * trailing assistant reply swapped for the draft card — matching what a live turn would have shown. */
export function conversationToGeminiMsgs(dto: CopilotConversationDto): GeminiMsg[] {
  const msgs: GeminiMsg[] = dto.messages.map((m): GeminiMsg =>
    m.role === "user" ? { role: "user", text: m.text || "" } : { role: "ai", text: m.text || "" },
  );
  if (dto.phase === "ready_to_confirm") {
    if (msgs.length && msgs[msgs.length - 1].role === "ai") msgs.pop();
    msgs.push({ role: "ai", draft: jdFieldsToGeminiDraft(dto.fields), titlePending: titlePendingIn(dto), fieldMeta: dto.fieldMeta, origin: conversationOrigin(dto) });
  }
  return msgs;
}

/** Restore recorded provenance, never infer an import merely from a URL in chat text. */
function conversationOrigin(dto: CopilotConversationDto): GeminiOrigin | undefined {
  const answers = dto.messages.filter(
    (m) => m.role === "user" && Array.isArray(m.attachments) && m.attachments.some((a) => (a as { kind?: unknown })?.kind === "quick_start"),
  );
  for (const message of [...dto.messages].reverse()) {
    if (message.role !== 'user' || !Array.isArray(message.attachments)) continue;
    for (const item of message.attachments) {
      const source = item as { kind?: string; url?: string } | null;
      if (source?.kind === 'link' && typeof source.url === 'string' && /^https?:\/\//i.test(source.url)) return { path: 'link', detail: source.url, sourceType: 'link' };
      if (source?.kind === 'pasted_text') return { path: 'link', detail: message.text || '', sourceType: 'text' };
      if (source?.kind === 'quick_start') return { path: 'questions', detail: answers.map(m => m.text || '').join('\n') };
    }
  }
  return undefined;
}

function titlePendingIn(dto: Pick<CopilotConversationDto, "missingFields">): boolean {
  return Array.isArray(dto.missingFields) && dto.missingFields.includes(TITLE_UNCONFIRMED);
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
    compensation: fields.publicCompensation,
    businessProblem: fields.businessProblem,
    outcomes: fields.expectedOutcomes,
    success: fields.successCriteria,
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

function resultToMsg(result: CopilotConversationDto, origin?: GeminiOrigin, prev?: GeminiDraft): GeminiMsg {
  const lastReply = result.messages[result.messages.length - 1];
  return result.phase === "ready_to_confirm"
    ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields), titlePending: titlePendingIn(result), fieldMeta: result.fieldMeta, origin, prev }
    : { role: "ai", text: lastReply?.text || "" };
}

/** Comparable form of draft fields: key order and empty/absent values ignored (a missing list equals `[]`). */
function canonFields(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonFields);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined && x !== null && x !== "" && !(Array.isArray(x) && x.length === 0))
        .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
        .map(([k, x]) => [k, canonFields(x)]),
    );
  }
  return v;
}

/** Labels for the draft fields a refine can change — both the API's field names and the panel's draft names. */
const REFINE_FIELD_LABELS: Record<string, string> = {
  title: "Job title",
  department: "Department",
  location: "Location",
  headcount: "Headcount",
  employmentType: "Employment type",
  roleSummary: "Role summary",
  summary: "Role summary",
  responsibilities: "Responsibilities",
  mustHave: "Requirements",
  must: "Requirements",
  niceToHave: "Preferred",
  pref: "Preferred",
  publicCompensation: "Salary",
  compensation: "Salary",
  businessProblem: "Business problem",
  expectedOutcomes: "Expected outcomes",
  outcomes: "Expected outcomes",
  successCriteria: "Success criteria",
  success: "Success criteria",
};
const SALARY_FIELDS = ["publicCompensation", "compensation"];
/** A note asking for salary content — then an unchanged salary must be called out, not hidden behind other edits. */
const SALARY_NOTE = /salary|compensation|pay\b|wage|薪|工资|待遇|年薪|月薪/i;

/** Which fields really differ between two drafts (#99), in a stable order. */
function changedFields(next: unknown, prev: unknown): string[] {
  const a = canonFields(next) as Record<string, unknown>;
  const b = canonFields(prev) as Record<string, unknown>;
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .sort();
}

function formatWebAnswer(answer: CopilotWebAnswer, sourcesLabel: string): string {
  if (answer.sources.length === 0) return answer.text;
  return `${answer.text}\n\n${sourcesLabel}\n${answer.sources.map((source) => `- ${source.title} ${source.url}`).join("\n")}`;
}

const URL_PATTERN = /https?:\/\/[^\s<>"'）)】」]+/g;

/** Plain message text with http(s) URLs turned into links (shown as their host) — e.g. web answer sources. */
function LinkifiedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const start = match.index;
    if (start > last) parts.push(text.slice(last, start));
    let label = url;
    try {
      label = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      // Keep the raw URL as its own label.
    }
    parts.push(
      <a key={start} className="gm-link" href={url} target="_blank" rel="noopener noreferrer" title={url}>
        {label}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

type ActiveDraftMsg = Extract<GeminiMsg, { draft: GeminiDraft }> | Extract<GeminiMsg, { kind: "variants" }>;

/** The draft the Workspace shows: the latest draft or variant set that is still open (not replaced, not created). */
function findActiveDraft(msgs: GeminiMsg[]): { index: number; msg: ActiveDraftMsg } | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role !== "ai") continue;
    if (m.kind === "variants") return m.superseded || m.picked !== undefined ? null : { index: i, msg: m };
    if (m.kind) continue;
    if (m.draft) return m.superseded || m.created ? null : { index: i, msg: m };
  }
  return null;
}

interface DraftChanges {
  fields: Partial<Record<"title" | "department" | "summary" | "location" | "employmentType" | "headcount" | "compensation" | "businessProblem", string>>;
  responsibilities: Set<number>;
  must: Set<number>;
  pref: Set<number>;
  outcomes: Set<number>;
  success: Set<number>;
  count: number;
}

/** Prototype's `geminiDiffDrafts`: changed scalar fields (with their old value) and list items that are new. */
function diffDrafts(prev: GeminiDraft | undefined, next: GeminiDraft): DraftChanges | null {
  if (!prev) return null;
  const changes: DraftChanges = {
    fields: {},
    responsibilities: new Set(),
    must: new Set(),
    pref: new Set(),
    outcomes: new Set(),
    success: new Set(),
    count: 0,
  };
  for (const field of ["title", "department", "summary", "location", "employmentType", "headcount", "businessProblem"] as const) {
    const before = String(prev[field] ?? "");
    if (before !== String(next[field] ?? "")) {
      changes.fields[field] = before;
      changes.count++;
    }
  }
  // Compare the amounts themselves, not their display text, so any real change is highlighted.
  if (JSON.stringify(canonFields(prev.compensation ?? {})) !== JSON.stringify(canonFields(next.compensation ?? {}))) {
    changes.fields.compensation = money(prev.compensation);
    changes.count++;
  }
  for (const list of ["responsibilities", "must", "pref", "outcomes", "success"] as const) {
    const old = new Set(prev[list] ?? []);
    (next[list] ?? []).forEach((item, i) => {
      if (!old.has(item)) {
        changes[list].add(i);
        changes.count++;
      }
    });
  }
  return changes.count ? changes : null;
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
  /** Why the last Send did nothing (empty / not a title), shown above the composer. */
  const [composerHint, setComposerHint] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [busy, setBusy] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyItems, setHistoryItems] = useState<CopilotConversationDto[]>([]);
  const [attaching, setAttaching] = useState(false);
  const [refining, setRefining] = useState(false);
  const [wsOpen, setWsOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const voiceBaseInputRef = useRef<string | null>(null);
  const voiceButtonRef = useRef<VoiceInputHandle>(null);
  // Send was pressed mid-recording: stop voice first, then send once the transcript is in the composer.
  const sendAfterVoiceRef = useRef(false);
  const [voiceSendQueued, setVoiceSendQueued] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const attachFileInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const working = busy || attaching;
  const errorText = (error: unknown) => t(describeCopilotError(error));
  // Idempotency key of a conversation create still awaiting success: a retry after a lost response reuses it (#33 AC-4).
  const pendingConversationKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const active = findActiveDraft(msgs);
  const activeIndex = active?.index ?? -1;
  const narrow = useNarrowScreen();
  const showWorkspace = !!active && wsOpen && !historyOpen && !narrow;

  // A new draft always opens the Workspace again, even if the previous one was closed.
  useEffect(() => {
    if (activeIndex >= 0) setWsOpen(true);
    else setRefining(false);
  }, [activeIndex]);

  // The drawer widens to fit the Workspace column (prototype's `gm-has-ws`).
  useEffect(() => {
    const drawer = panelRef.current?.closest(".drawer");
    if (!drawer) return;
    drawer.classList.toggle("gm-has-ws", showWorkspace);
    return () => drawer.classList.remove("gm-has-ws");
  }, [showWorkspace]);

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

  const removeMsg = (index: number) =>
    mutate((draft) => {
      draft.geminiChats = { ...draft.geminiChats, [key]: (draft.geminiChats[key] ?? []).filter((_, i) => i !== index) };
    });

  const updateMsg = (
    index: number,
    patch: { done?: boolean; picked?: number; selected?: number; superseded?: boolean; created?: boolean; titlePending?: boolean; draft?: GeminiDraft; fieldMeta?: FieldMetaMap },
  ) =>
    mutate((draft) => {
      const list = [...(draft.geminiChats[key] ?? [])];
      const current = list[index];
      if (current && current.role === "ai") list[index] = { ...current, ...patch } as GeminiMsg;
      draft.geminiChats = { ...draft.geminiChats, [key]: list };
    });

  const setPath = (next: GeminiCreatePath) =>
    mutate((draft) => {
      draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: next };
    });

  const ensureConversation = async () => {
    const existing = state.geminiConversationIds[key];
    if (existing) return existing;
    pendingConversationKeyRef.current ??= `copilot-conv-${safeRandomUUID()}`;
    const conversation = await createCopilotConversation(pendingConversationKeyRef.current);
    pendingConversationKeyRef.current = null;
    mutate((draft) => {
      draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
    });
    return conversation.id;
  };

  /**
   * Swaps the "thinking" dots (and a half-streamed reply) for a failure card with Retry / Start over (#33).
   * Typed input goes back into an empty composer so nothing has to be retyped.
   */
  const failRequest = (error: unknown, retry?: GeminiRequestRetry, dropStreamed = false) => {
    console.error("Copilot request failed:", error);
    mutate((draft) => {
      let list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
      if (dropStreamed) list = list.slice(0, -1);
      draft.geminiChats = { ...draft.geminiChats, [key]: [...list, { role: "ai", kind: "request-failed", text: errorText(error), retry }] };
    });
    if (retry && "text" in retry) setInput((current) => (current.trim() ? current : retry.text));
  };

  /** Runs one backend step behind the "thinking" dots; `autoFill` finishes an incomplete extraction in a second auto-complete turn. */
  const runStep = async (
    step: (conversationId: string) => Promise<CopilotConversationDto>,
    autoFill = false,
    origin?: GeminiOrigin,
    retry?: GeminiRequestRetry,
  ) => {
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      let result = await step(conversationId);
      // Only when the source actually described a role — otherwise keep Copilot's reply instead of inventing a JD.
      if (autoFill && result.phase !== "ready_to_confirm" && result.fields.title) {
        result = await autoCompleteCopilotConversation(conversationId);
      }
      resolveThinking(resultToMsg(result, origin));
      return true;
    } catch (error) {
      failRequest(error, retry);
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
      const finalReply = resultToMsg(result, { path: "home", detail: text });
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        draft.geminiChats = { ...draft.geminiChats, [key]: [...(streaming ? list.slice(0, -1) : list), finalReply] };
      });
    } catch (error) {
      failRequest(error, { action: "chat", text }, streaming);
    } finally {
      setBusy(false);
    }
  };

  /** Quick Start: the three answers go to auto-complete in one turn, which writes the whole JD. */
  /** Quick Start (#65): the backend keeps the answers so far; each message adds to them. */
  const runQuickStart = async (text: string) => {
    const retry: GeminiRequestRetry = { action: "questions", text };
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      const result = await quickStartCopilotConversation(conversationId, text);
      resolveThinking(resultToMsg(result, { path: "questions", detail: text }));
      // Still collecting: stay on Quick Start so the next message answers what was asked.
      if (result.phase === "ready_to_confirm") setPath("home");
    } catch (error) {
      failRequest(error, retry);
    } finally {
      setBusy(false);
    }
  };

  const runTitleVariants = async (title: string) => {
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      const result = await generateCopilotTitleVariants(conversationId, title);
      resolveThinking({ role: "ai", kind: "variants", title: result.title, variants: result.variants, selected: 0, origin: { path: "title", detail: title } });
      setPath("home");
    } catch (error) {
      failRequest(error, { action: "title", text: title });
    } finally {
      setBusy(false);
    }
  };

  const runImport = async (text: string) => {
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(text) && !/^https?:\/\//i.test(text)) {
      push({ role: 'ai', kind: 'request-failed', text: t('Only http:// and https:// links are supported. Paste the full JD text instead.'), retry: { action: 'link', text } });
      setInput(text);
      return;
    }
    if (/^https?:\/\/\S+$/i.test(text)) {
      if (await runStep((conversationId) => importCopilotSource(conversationId, { url: text }), false, { path: "link", detail: text, sourceType: 'link' }, { action: "link", text }))
        setPath("home");
      return;
    }
    if (text.length < 20) {
      push({ role: "ai", text: t("That doesn’t look like a link or a JD. Paste a job posting URL (starting with http:// or https://) or the full JD text.") });
      return;
    }
    if (await runStep((conversationId) => importCopilotSource(conversationId, { text }), false, { path: "link", detail: text, sourceType: 'text' }, { action: "link", text }))
      setPath("home");
  };

  /** A note typed while a draft is open rewrites it (every version, for variants); changes get highlighted. */
  const refineDraft = async (note: string, target: { index: number; msg: ActiveDraftMsg }) => {
    setBusy(true);
    push({ role: "thinking" });
    try {
      const conversationId = await ensureConversation();
      const { index, msg } = target;
      let reply: GeminiMsg;
      // Only claim what actually changed (#99): list the fields each version really changed, say these are
      // unsaved drafts, and when the note asked for salary but the salary didn't change, say so plainly.
      const fieldList = (keys: string[]) => keys.map((k) => t(REFINE_FIELD_LABELS[k] ?? k)).join(", ");
      const salaryAsked = SALARY_NOTE.test(note);
      let summary: string;
      if (msg.kind === "variants") {
        const result = await refineCopilotVariants(conversationId, note, msg.variants, msg.selected ?? 0);
        if (result.answer) return void resolveThinking({ role: "ai", text: formatWebAnswer(result.answer, t("Sources:")) });
        const changes = result.variants.map((v, i) => ({ letter: String.fromCharCode(65 + i), fields: changedFields(v.fields, msg.variants[i]?.fields) }));
        if (changes.every((c) => !c.fields.length)) {
          return void resolveThinking({ role: "ai", text: t("Nothing changed — none of the versions needed an edit for that note. Nothing has been saved.") });
        }
        reply = { ...msg, variants: result.variants, prev: msg.variants, superseded: undefined };
        const lines = changes.map((c) =>
          `- ${t("Version %s").replace("%s", c.letter)}: ${c.fields.length ? fieldList(c.fields) : t("no change")}`,
        );
        const noSalary = changes.filter((c) => !c.fields.some((k) => SALARY_FIELDS.includes(k))).map((c) => c.letter);
        summary = [
          t("Changed by your note (still unsaved drafts — nothing is written to a job until you create one; changes are highlighted in the Workspace):"),
          ...lines,
          ...(salaryAsked && noSalary.length
            ? [
                noSalary.length === changes.length
                  ? t("The salary was not changed in any version.")
                  : t("The salary was not changed in version %s.").replace("%s", noSalary.join(", ")),
              ]
            : []),
        ].join("\n");
      } else {
        const result = await refineCopilotDraft(conversationId, note);
        // A question, not an edit: show the answer and keep the current draft as-is.
        if (result.answer) return void resolveThinking({ role: "ai", text: formatWebAnswer(result.answer, t("Sources:")) });
        reply = resultToMsg(result, msg.origin, msg.draft);
        // Copilot replied with a question or a note instead of a new draft: show it, claim nothing.
        if (!("draft" in reply) || !reply.draft) return void resolveThinking(reply);
        const fields = changedFields(reply.draft, msg.draft);
        if (!fields.length) {
          return void resolveThinking({ role: "ai", text: t("Nothing changed — the draft didn’t need an edit for that note. Nothing has been saved.") });
        }
        summary = [
          t("Changed in the draft: %s. It’s still an unsaved draft — nothing is written to a job until you create one; changes are highlighted in the Workspace.").replace("%s", fieldList(fields)),
          ...(salaryAsked && !fields.some((k) => SALARY_FIELDS.includes(k)) ? [t("The salary was not changed.")] : []),
        ].join("\n");
      }
      updateMsg(index, { superseded: true });
      resolveThinking({ role: "ai", text: summary });
      push(reply);
      setRefining(false);
      setWsOpen(true);
    } catch (error) {
      failRequest(error, { action: "refine", text: note, index: target.index });
    } finally {
      setBusy(false);
    }
  };

  const startRefine = () => {
    setRefining(true);
    setWsOpen(true);
    setTimeout(() => composerRef.current?.focus(), 0);
  };

  const send = (overrideText?: string) => {
    if (overrideText === undefined && voiceStatus !== "idle") {
      if (voiceSendQueued) return;
      sendAfterVoiceRef.current = true;
      if (voiceButtonRef.current?.stop() !== "pending" && sendAfterVoiceRef.current) {
        // Ended without a transcript callback (nothing recognized yet): send what's already typed.
        sendAfterVoiceRef.current = false;
        setVoiceSendQueued(true);
      }
      return;
    }
    const text = (overrideText ?? input).trim();
    if (working) return;
    // Say why nothing happens instead of silently ignoring the click (#75); the typed text stays.
    if (!text) return void setComposerHint(path === "title" ? "Enter a job title first." : "Type a message first.");
    if (path === "title" && !/\p{L}/u.test(text)) {
      return void setComposerHint("That doesn’t look like a job title — use words, e.g. “Finance Manager” or “CFO”.");
    }
    setComposerHint("");
    setInput("");
    push({ role: "user", text });
    if (active && path === "home") return void refineDraft(text, active);
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
    setComposerHint("");
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
    if (sendAfterVoiceRef.current) {
      sendAfterVoiceRef.current = false;
      setVoiceSendQueued(true);
    }
  };

  const handleVoiceError = (message: string) => {
    voiceBaseInputRef.current = null;
    sendAfterVoiceRef.current = false;
    say(message, { type: "error" });
  };

  // Waits for the button to report idle so `send` sees the final composer text and doesn't re-stop voice.
  useEffect(() => {
    if (voiceStatus !== "idle") return;
    // Voice was cancelled while a send was pending (no transcript came back): drop the pending send.
    sendAfterVoiceRef.current = false;
    if (!voiceSendQueued) return;
    setVoiceSendQueued(false);
    send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceSendQueued, voiceStatus]);

  /**
   * Back to the five "Create a Job" entries right away (#33 AC-1). Purely local: the next conversation
   * is created lazily when the first message is sent, so this works even while the backend is down.
   */
  const startNewConversation = () => {
    if (working) return;
    setHistoryOpen(false);
    pendingConversationKeyRef.current = null;
    mutate((draft) => {
      const ids = { ...draft.geminiConversationIds };
      delete ids[key];
      draft.geminiConversationIds = ids;
      draft.geminiChats = { ...draft.geminiChats, [key]: [] };
      draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: "home" };
    });
    setInput("");
    setRefining(false);
  };

  /** "Retry" on a failure card: re-send the original input through the same path, once (#33 AC-2/AC-4). */
  const retryRequest = (index: number) => {
    const msg = msgs[index];
    if (working || !msg || msg.role !== "ai" || msg.kind !== "request-failed" || msg.done || !msg.retry) return;
    const retry = msg.retry;
    // The new attempt shows its own outcome, so the old card goes rather than stacking a second identical
    // error under it (#64 AC-4). Upload only reopens the file picker, which can be cancelled: keep that card.
    if (retry.action === "upload") updateMsg(index, { done: true });
    else removeMsg(index);
    if ("text" in retry) setInput((current) => (current.trim() === retry.text.trim() ? "" : current));
    switch (retry.action) {
      case "chat":
        push({ role: "thinking" });
        return void sendCreate(retry.text);
      case "questions":
        return void runQuickStart(retry.text);
      case "title":
        return void runTitleVariants(retry.text);
      case "link":
        return void runImport(retry.text);
      case "refine": {
        const target = msgs[retry.index];
        if (target && target.role === "ai" && (target.kind === "variants" || ("draft" in target && target.draft))) {
          return void refineDraft(retry.text, { index: retry.index, msg: target as ActiveDraftMsg });
        }
        push({ role: "thinking" });
        return void sendCreate(retry.text);
      }
      case "upload":
        return attachFileInputRef.current?.click();
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
        // A Quick Start still collecting answers resumes, so the next answer goes through its three-question check.
        draft.geminiCreatePaths = { ...draft.geminiCreatePaths, [key]: conversation.quickStartOpen ? "questions" : "home" };
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
    // Nothing to send: say exactly why and offer to pick another file (#82).
    const refused = file.size === 0 ? ATTACHMENT_FILE_EMPTY : file.size > MAX_ATTACHMENT_MB * 1024 * 1024 ? ATTACHMENT_TOO_LARGE : null;
    if (refused) {
      push({ role: "ai", kind: "request-failed", text: t(refused), retry: { action: "upload", fileName: file.name } });
      return;
    }
    setAttaching(true);
    try {
      if (
        await runStep((conversationId) => uploadCopilotAttachment(conversationId, file), fromUploadPath, { path: "upload", detail: file.name }, {
          action: "upload",
          fileName: file.name,
        })
      ) {
        setPath("home");
      }
    } finally {
      setAttaching(false);
    }
  };

  const handleAutoComplete = async () => {
    if (working || path === "questions") return;
    push({ role: "user", text: AUTO_COMPLETE_LABEL });
    await runStep((conversationId) => autoCompleteCopilotConversation(conversationId));
  };

  /**
   * Confirms the draft as a real Job on the Core Record service and opens it. Throws when the backend
   * call fails — there is no local-only fallback any more (#34): a job the user is told about must
   * survive a refresh. The conversation id is passed in by the caller, because a conversation created
   * earlier in the same click isn't in this render's `state` yet.
   */
  const createJobFromDraft = async (conversationId: string, d: GeminiDraft, seniority?: string) => {
    const newId = (await confirmCopilotDraft(conversationId)).jobId;
    if (seniority) await updateJobFields(newId, { seniority }).catch((error) => console.warn("Failed to save the job level:", error));
    mutate((draft) => {
      draft.jobs[newId] = {
        id: newId,
        title: d.title,
        department: d.department,
        team: d.department,
        // Only what the user or the draft actually gave; "—" is the mapping's "not set" (#76, #88).
        location: d.location || "—",
        employmentType: d.employmentType || "—",
        workplaceType: "—",
        level: seniority || "—",
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
          // An empty summary stays empty (the editor shows its placeholder), not invented copy (#89).
          mkBlock(bid(), "p", d.summary || ""),
          ...(d.businessProblem
            ? [
                mkBlock(bid(), "h2", "Business problem", { level: "internal" }),
                mkBlock(bid(), "p", d.businessProblem, { level: "internal" }),
              ]
            : []),
          mkBlock(bid(), "h2", "Responsibilities"),
          mkBlock(bid(), "ul", d.responsibilities),
          mkBlock(bid(), "h2", "Requirements"),
          mkBlock(bid(), "ul", d.must),
          ...(d.pref && d.pref.length ? [mkBlock(bid(), "h2", "Preferred"), mkBlock(bid(), "ul", d.pref)] : []),
          mkBlock(bid(), "h2", "Compensation"),
          mkBlock(bid(), "p", money(d.compensation)),
          ...(d.outcomes?.length
            ? [mkBlock(bid(), "h2", "Expected outcomes", { level: "internal" }), mkBlock(bid(), "ul", d.outcomes, { level: "internal" })]
            : []),
          ...(d.success?.length
            ? [
                mkBlock(bid(), "h2", "Success in the first 90 days", { level: "internal" }),
                mkBlock(bid(), "ul", d.success, { level: "internal" }),
              ]
            : []),
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
    // AC-4: go straight to the new job's editor.
    closeModal();
    navigate(`/jobs/${newId}/document`);
    return newId;
  };

  /** Nothing was saved: say why, keep the input where it was, and offer a retry of the same create (#34). */
  const reportCreateFailure = (error: unknown, retry: GeminiCreateRetry) => {
    console.error("Creating the job failed:", error);
    const reason = errorText(error);
    say(t("The job was not created — %s").replace("%s", reason), { type: "error" });
    push({ role: "ai", kind: "create-failed", text: t("The job was not created — %s").replace("%s", reason), retry });
  };

  /** Saves user-picked/authored fields on the conversation, then creates the job from them. */
  const createFromFields = async (retry: Extract<GeminiCreateRetry, { source: "fields" }>, echo = true) => {
    if (working) return false;
    setBusy(true);
    try {
      const conversationId = await ensureConversation();
      const result = await setCopilotFields(conversationId, retry.fields as CopilotJdFields, retry.label);
      if (echo) push({ role: "user", text: retry.label });
      await createJobFromDraft(conversationId, jdFieldsToGeminiDraft(result.fields), retry.seniority);
      if (retry.variant) updateMsg(retry.variant.index, { picked: retry.variant.variantIndex });
      if (retry.formIndex !== undefined) {
        updateMsg(retry.formIndex, { done: true });
        setPath("home");
      }
      return true;
    } catch (error) {
      reportCreateFailure(error, retry);
      return false;
    } finally {
      setBusy(false);
    }
  };

  /** The user confirms (or edits) an AI-suggested job title; the draft becomes theirs to create (#66). */
  const confirmDraftTitle = async (index: number, title: string) => {
    const conversationId = state.geminiConversationIds[key];
    const clean = title.trim();
    if (working || !conversationId || !clean) return;
    setBusy(true);
    try {
      const conversation = await getCopilotConversation(conversationId);
      const result = await setCopilotFields(conversationId, { ...conversation.fields, title: clean }, `${t("Confirm job title")}: ${clean}`);
      updateMsg(index, { draft: jdFieldsToGeminiDraft(result.fields), titlePending: false, fieldMeta: result.fieldMeta });
    } catch (error) {
      say(errorText(error), { type: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createFromDraftCard = async (index: number, d: GeminiDraft) => {
    if (working) return;
    setBusy(true);
    try {
      const conversationId = state.geminiConversationIds[key];
      if (!conversationId) throw new Error(t("This conversation has expired — start a new one."));
      await createJobFromDraft(conversationId, d);
      updateMsg(index, { created: true });
    } catch (error) {
      reportCreateFailure(error, { source: "draft", draftIndex: index, draft: d });
    } finally {
      setBusy(false);
    }
  };

  const pickVariant = async (index: number, variantIndex: number) => {
    const msg = msgs[index];
    if (!msg || msg.role !== "ai" || msg.kind !== "variants") return;
    const v = msg.variants[variantIndex];
    const label = `${t("Create job with version %s").replace("%s", String.fromCharCode(65 + variantIndex))} · ${t(v.label)}`;
    await createFromFields({ source: "fields", fields: v.fields as Record<string, unknown>, label, variant: { index, variantIndex } });
  };

  const submitForm = async (index: number, fields: CopilotJdFields, seniority: string) => {
    await createFromFields({
      source: "fields",
      fields: fields as Record<string, unknown>,
      label: `${t("Create Manually")}: ${fields.title}`,
      seniority: seniority || undefined,
      formIndex: index,
    });
  };

  /** The user confirms AI-suggested fields as they are (#68 AC-2). */
  const confirmDraftFields = async (index: number, fields: string[]) => {
    const conversationId = state.geminiConversationIds[key];
    if (working || !conversationId || !fields.length) return;
    const msg = msgs[index];
    const seen = msg && msg.role === "ai" && "fieldMeta" in msg ? (msg.fieldMeta ?? {}) : {};
    const revisions = Object.fromEntries(fields.map((field) => [field, seen[field]?.revision ?? 0]));
    setBusy(true);
    try {
      const result = await confirmCopilotFields(conversationId, fields, revisions);
      // Values too, not just the marks: a field changed elsewhere must show its new value before anyone
      // confirms it at its new revision (#68 review).
      updateMsg(index, { draft: jdFieldsToGeminiDraft(result.fields), fieldMeta: result.fieldMeta, titlePending: titlePendingIn(result) });
    } catch (error) {
      say(errorText(error), { type: "error" });
      // The draft changed elsewhere (e.g. another tab): show what it is now, to review before confirming.
      if (error instanceof CopilotRequestError && error.code === "DRAFT_CHANGED") {
        const latest = await getCopilotConversation(conversationId).catch(() => null);
        if (latest) updateMsg(index, { draft: jdFieldsToGeminiDraft(latest.fields), fieldMeta: latest.fieldMeta, titlePending: titlePendingIn(latest) });
      }
    } finally {
      setBusy(false);
    }
  };

  /** "Retry" on a failure card: run the same create again (same conversation, same idempotency key). */
  const retryCreate = async (index: number) => {
    const msg = msgs[index];
    if (working || !msg || msg.role !== "ai" || msg.kind !== "create-failed" || msg.done) return;
    updateMsg(index, { done: true });
    if (msg.retry.source === "draft") await createFromDraftCard(msg.retry.draftIndex, msg.retry.draft);
    else await createFromFields(msg.retry, false);
  };

  const handleSelectOption = (option: ConversationActionOption) => {
    closeModal();
    navigate(option.href);
  };

  return (
    <div className={`gemini-panel${showWorkspace ? " has-ws" : ""}`} ref={panelRef}>
     <div className="gemini-body">
      <div className="gemini-chat-column">
      <div className="gemini-panel-header">
        <span className="gp-icon material-icons-o">auto_awesome</span>
        <div className="gp-title">{historyOpen ? t("History") : t("Ask Copilot")}</div>
        <div style={{ flex: 1 }} />
        {!historyOpen && (
          <>
            <button className="icon-btn" type="button" disabled={working} onClick={startNewConversation} title={t("New conversation")} aria-label={t("New conversation")}>
              <Icon name="edit_square" />
            </button>
            <button className="icon-btn" type="button" disabled={working} onClick={() => void openHistory()} title={t("Conversation history")} aria-label={t("Conversation history")}>
              <Icon name="history" />
            </button>
            {active && !wsOpen && (
              <button className="icon-btn" type="button" onClick={() => setWsOpen(true)} title={t("Open Workspace")} aria-label={t("Open Workspace")}>
                <Icon name="right_panel_open" />
              </button>
            )}
          </>
        )}
        {historyOpen && (
          <button className="icon-btn" type="button" onClick={() => setHistoryOpen(false)} title={t("Back")} aria-label={t("Back")}>
            <Icon name="arrow_back" />
          </button>
        )}
        {!showWorkspace && (
          <button className="close-x" onClick={closeModal} aria-label={t("Close")}>
            <Icon name="close" />
          </button>
        )}
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
            <>
            {msgs.filter((m) => m.role === "user").length > HISTORY_ROUNDS && <div className="tiny muted" role="note">{t(HISTORY_TRIMMED)}</div>}
            {msgs.map((m, i) => (
              <GeminiMessage
                key={i}
                msg={m}
                busy={working}
                wsVisible={showWorkspace}
                onCreate={(d) => void createFromDraftCard(i, d)}
                onConfirmTitle={(title) => void confirmDraftTitle(i, title)}
                onRefine={startRefine}
                onSelectVariant={(variantIndex) => updateMsg(i, { selected: variantIndex })}
                onSelectOption={handleSelectOption}
                onChooseFile={() => attachFileInputRef.current?.click()}
                onPickVariant={(variantIndex) => void pickVariant(i, variantIndex)}
                onSubmitForm={(fields, seniority) => void submitForm(i, fields, seniority)}
                onRetryCreate={() => void retryCreate(i)}
                onRetryRequest={() => retryRequest(i)}
                onPasteText={() => { setPath('link'); setInput(''); composerRef.current?.focus(); }}
                onStartOver={startNewConversation}
              />
            ))}
            </>
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
          {composerHint && (
            <div className="gm-composer-hint" role="alert">
              {t(composerHint)}
            </div>
          )}
          <div className="gemini-composer-shell">
            <textarea
              ref={composerRef}
              rows={1}
              placeholder={t(refining && active ? "What would you like to change?" : COMPOSER_PLACEHOLDERS[path])}
              value={input}
              disabled={voiceStatus !== "idle"}
              aria-invalid={composerHint ? true : undefined}
              onChange={(e) => {
                setInput(e.target.value);
                setComposerHint("");
              }}
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
                  // Quick Start drafts only from its three answers; auto-complete would skip that check (#65).
                  disabled={working || path === "questions"}
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
                  ref={voiceButtonRef}
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
      {showWorkspace && active && (
        <CopilotWorkspace
          msg={active.msg}
          busy={working}
          onConfirmFields={(fields) => void confirmDraftFields(active.index, fields)}
          onSelectVariant={(variantIndex) => updateMsg(active.index, { selected: variantIndex })}
          onClose={() => setWsOpen(false)}
        />
      )}
     </div>
    </div>
  );
}

const NARROW_QUERY = "(max-width: 760px)";

/** Below 760px there's no room for the Workspace column, so drafts stay inline in the chat. */
function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW_QUERY);
    const update = () => setNarrow(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
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
      <div style={{ fontWeight: 500, marginTop: 4 }}>{t("Compensation")}</div>
      <div>{money(d.compensation)}</div>
      {d.businessProblem && (
        <>
          <div style={{ fontWeight: 500, marginTop: 4 }}>{t("Business problem")}</div>
          <div>{d.businessProblem}</div>
        </>
      )}
      {(
        [
          ["Expected outcomes", d.outcomes],
          ["Success criteria", d.success],
        ] as const
      ).map(([title, items]) =>
        items && items.length > 0 ? (
          <div key={title}>
            <div style={{ fontWeight: 500, marginTop: 4 }}>{t(title)}</div>
            <ul>
              {items.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
    </>
  );
}

function VariantPicker({
  msg,
  busy,
  wsVisible,
  onSelect,
  onPick,
  onRefine,
}: {
  msg: Extract<GeminiMsg, { kind: "variants" }>;
  busy: boolean;
  wsVisible: boolean;
  onSelect: (variantIndex: number) => void;
  onPick: (variantIndex: number) => void;
  onRefine: () => void;
}) {
  const { t } = useStore();
  const selected = msg.picked ?? msg.selected ?? 0;
  const done = msg.picked !== undefined;
  const letter = String.fromCharCode(65 + selected);
  return (
    <div className="gm-bubble ai">
      <div>
        {t(
          wsVisible && !msg.superseded && !done
            ? "I’ve drafted “%s” in 3 different styles — compare them in the Workspace. Pick the one that fits."
            : "I’ve drafted “%s” in 3 different styles. Pick the one that fits.",
        ).replace("%s", msg.title)}
      </div>
      {msg.superseded ? (
        <div className="tiny" style={{ marginTop: 8 }}>{t("Superseded by a newer draft below.")}</div>
      ) : (
        <>
          <div className="gm-variants">
            {msg.variants.map((v, i) => (
              <button
                key={v.key}
                type="button"
                className={`gm-variant${i === selected ? " active" : ""}`}
                disabled={done}
                onClick={() => onSelect(i)}
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
          {!wsVisible && (
            <div className="gm-variant-preview">
              <DraftBody d={jdFieldsToGeminiDraft(msg.variants[selected].fields)} />
            </div>
          )}
          {!done && (
            <div className="gm-actions">
              <Button variant="primary" size="sm" disabled={busy} onClick={() => onPick(selected)}>
                <Icon name="add_circle" />
                {t("Create job with version %s").replace("%s", letter)}
              </Button>
              <Button size="sm" disabled={busy} onClick={onRefine}>
                {t("Refine", "gm_action.Refine")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const ORIGIN_LABELS: Record<GeminiCreatePath, string> = {
  home: "Describe in chat",
  questions: "Quick Start",
  title: "Start with a Job Title",
  upload: "Upload a JD",
  link: "Paste a Link or Text",
  form: "Create Manually",
};

const ORIGIN_DETAIL_LABELS: Record<GeminiCreatePath, string> = {
  home: "Your description",
  questions: "Your answers",
  title: "Job title",
  upload: "Source file",
  link: "Source",
  form: "Your input",
};

/** The right-hand Workspace column: the open draft as a document, with version tabs and change highlights. */
function CopilotWorkspace({
  msg,
  busy,
  onConfirmFields,
  onSelectVariant,
  onClose,
}: {
  msg: ActiveDraftMsg;
  busy: boolean;
  onConfirmFields: (fields: string[]) => void;
  onSelectVariant: (variantIndex: number) => void;
  onClose: () => void;
}) {
  const { t, closeModal } = useStore();
  const isVariants = msg.kind === "variants";
  const selected = isVariants ? (msg.selected ?? 0) : 0;
  const draft = isVariants ? jdFieldsToGeminiDraft(msg.variants[selected].fields) : msg.draft;
  const prevVariant = isVariants ? msg.prev?.[selected] : undefined;
  const prev = isVariants ? (prevVariant ? jdFieldsToGeminiDraft(prevVariant.fields) : undefined) : msg.prev;
  const origin = msg.origin;
  const detail = origin?.detail && origin.detail.length > 600 ? `${origin.detail.slice(0, 600)}…` : origin?.detail;
  return (
    <aside className="gemini-expand-column">
      <div className="gm-ws-head">
        <div className="gm-ws-title">
          <Icon name="description" />
          {t("Workspace")}
        </div>
        <button className="close-x" type="button" onClick={onClose} title={t("Close Workspace")} aria-label={t("Close Workspace")}>
          <Icon name="right_panel_close" />
        </button>
        <button className="close-x" type="button" onClick={closeModal} title={t("Close")} aria-label={t("Close")}>
          <Icon name="close" />
        </button>
      </div>
      <div className="gm-ws-body">
        {isVariants && (
          <>
            <div className="gm-ws-tabs" role="tablist">
              {msg.variants.map((v: GeminiVariant, i: number) => (
                <button
                  key={v.key}
                  type="button"
                  role="tab"
                  aria-selected={i === selected}
                  className={`gm-ws-tab${i === selected ? " active" : ""}`}
                  onClick={() => onSelectVariant(i)}
                >
                  {String.fromCharCode(65 + i)} · {t(v.label)}
                </button>
              ))}
            </div>
            <div className="tiny" style={{ margin: "0 0 10px" }}>{t(msg.variants[selected].description)}</div>
          </>
        )}
        <WorkspaceDoc
          d={draft}
          changes={diffDrafts(prev, draft)}
          origin={origin}
          // Field-by-field source and confirmation are shown for Quick Start drafts (M1, #68).
          provenance={!isVariants && origin?.path === "questions" && msg.fieldMeta ? { meta: msg.fieldMeta, busy, onConfirm: onConfirmFields } : undefined}
        />
        {origin && (
          <details className="gm-ws-inputs">
            <summary>{t("Captured inputs")}</summary>
            <div className="gm-snap-row">
              <span>{t("Creation path")}</span>
              <strong>{t(ORIGIN_LABELS[origin.path])}</strong>
            </div>
            {detail && (
              <div className="gm-snap-row">
                <span>{t(ORIGIN_DETAIL_LABELS[origin.path])}</span>
                <strong style={{ whiteSpace: "pre-wrap" }}>{detail}</strong>
              </div>
            )}
          </details>
        )}
      </div>
    </aside>
  );
}

type Provenance = { meta: FieldMetaMap; busy: boolean; onConfirm: (fields: string[]) => void };

/** Backend field name of each part of the draft (field meta is keyed by these). */
const FIELD_NAMES = {
  title: "title",
  department: "department",
  location: "location",
  employmentType: "employmentType",
  headcount: "headcount",
  summary: "roleSummary",
  businessProblem: "businessProblem",
  responsibilities: "responsibilities",
  must: "mustHave",
  pref: "niceToHave",
  compensation: "publicCompensation",
  outcomes: "expectedOutcomes",
  success: "successCriteria",
} as const;

/** Source, status and revision of one field: AI suggestions are flagged until the user confirms them (#68). */
function FieldMark({ field, provenance }: { field: string; provenance?: Provenance }) {
  const { t } = useStore();
  const m = provenance?.meta[field];
  if (!provenance || !m) return null;
  const pending = m.status === "pending";
  return (
    <span className={`gm-field-mark${pending ? " pending" : ""}`} data-field={field}>
      <span className={pending ? "gm-ai-tag" : "gm-user-tag"}>
        {pending ? t("AI suggested · to confirm") : m.source === "ai" ? t("AI suggested · confirmed") : t("Your answer · confirmed")}
      </span>
      <span className="gm-field-rev">v{m.revision}</span>
      {pending && field !== "title" && (
        <button type="button" className="req-link" disabled={provenance.busy} onClick={() => provenance.onConfirm([field])}>
          {t("Confirm")}
        </button>
      )}
    </span>
  );
}

function WorkspaceDoc({ d, changes, origin, provenance }: { d: GeminiDraft; changes: DraftChanges | null; origin?: GeminiOrigin; provenance?: Provenance }) {
  const { t } = useStore();
  const mark = (part: keyof typeof FIELD_NAMES) => <FieldMark field={FIELD_NAMES[part]} provenance={provenance} />;
  const pendingCls = (part: keyof typeof FIELD_NAMES) => (provenance?.meta[FIELD_NAMES[part]]?.status === "pending" ? " gm-pending" : "");
  const pendingFields = provenance ? Object.entries(provenance.meta).filter(([, m]) => m.status === "pending").map(([f]) => f) : [];
  const changed = (field: keyof DraftChanges["fields"]) => !!changes && field in changes.fields;
  const was = (field: keyof DraftChanges["fields"]) =>
    changed(field) ? t("Was: %s").replace("%s", changes?.fields[field] || "—") : undefined;
  const tag = (label: "New" | "Updated") => <span className="gm-chg-tag">{t(label, `change_tag.${label}`)}</span>;
  const meta = (field: keyof DraftChanges["fields"], value: string | undefined) =>
    value ? (
      <span className={changed(field) ? "gm-changed" : undefined} title={was(field)}>
        {value}
        {changed(field) && tag("Updated")}
      </span>
    ) : null;
  const internalTag = <span className="badge" style={{ marginLeft: 6 }}>{t("Internal")}</span>;
  const list = (
    title: string,
    items: string[] | undefined,
    key: "responsibilities" | "must" | "pref" | "outcomes" | "success",
    internal = false,
  ) =>
    items && items.length > 0 ? (
      <div className={`gm-field${pendingCls(key)}`}>
        <h4>
          {t(title)}
          {internal && internalTag}
          {mark(key)}
        </h4>
        <ul>
          {items.map((item, i) => {
            const isNew = !!changes?.[key].has(i);
            return (
              <li key={`${i}-${item}`} className={isNew ? "gm-changed" : undefined}>
                {item}
                {isNew && tag("New")}
              </li>
            );
          })}
        </ul>
      </div>
    ) : null;
  const sourceNote =
    origin?.path === "upload" && origin.detail
      ? t("Source file: %s").replace("%s", origin.detail)
      : origin?.path === "link" && origin.sourceType !== 'text' && origin.detail && /^https?:\/\//i.test(origin.detail)
        ? <><span>{t("Link source")}:</span> <a href={origin.detail} target="_blank" rel="noopener noreferrer">{origin.detail}</a></>
        : origin?.path === "link" && origin.detail
          ? t("Text source")
        : null;
  return (
    <div className="gm-ws-doc">
      {changes && (
        <div className="gm-ws-note">
          <Icon name="edit_note" />
          <span>{t("Updated draft — %s change(s) highlighted").replace("%s", String(changes.count))}</span>
        </div>
      )}
      {pendingFields.length > 0 && (
        <div className="gm-ws-note gm-pending-note">
          <Icon name="help" />
          <span>{t("%s AI-suggested field(s) to confirm — highlighted below").replace("%s", String(pendingFields.length))}</span>
          <button type="button" className="req-link" disabled={provenance?.busy} onClick={() => provenance?.onConfirm(pendingFields)}>
            {t("Confirm all")}
          </button>
        </div>
      )}
      <div className="eyebrow" style={{ marginBottom: 6 }}>{t("Drafted job")}</div>
      <h3 className={`gm-ws-doc-title${changed("title") ? " gm-changed" : ""}${pendingCls("title")}`} title={was("title")}>
        {d.title}
        {changed("title") && tag("Updated")}
        {mark("title")}
      </h3>
      <div className={`tiny${pendingCls("department")}`} title={was("department")}>
        {d.department}
        {changed("department") && tag("Updated")}
        {d.department && mark("department")}
      </div>
      <div className="gm-draft-meta">
        {origin && <span className="badge badge-info">{t(origin.path === 'link' ? origin.sourceType !== 'text' && /^https?:\/\//i.test(origin.detail || '') ? 'Link source' : 'Text source' : ORIGIN_LABELS[origin.path])}</span>}
        {meta("location", d.location)}
        {d.location && mark("location")}
        {meta("employmentType", d.employmentType ? t(d.employmentType) : undefined)}
        {d.employmentType && mark("employmentType")}
        {meta("headcount", d.headcount ? t("%s openings").replace("%s", String(d.headcount)) : undefined)}
        {d.headcount ? mark("headcount") : null}
      </div>
      {sourceNote && <div className="tiny gm-ws-source" data-testid="draft-source" style={{ overflowWrap: 'anywhere' }}>{sourceNote}</div>}
      {d.summary && (
        <p className={`${changed("summary") ? "gm-changed" : ""}${pendingCls("summary")}`} title={was("summary")}>
          {d.summary}
          {changed("summary") && tag("Updated")}
          {mark("summary")}
        </p>
      )}
      {d.businessProblem && (
        <>
          <h4>
            {t("Business problem")}
            {internalTag}
            {mark("businessProblem")}
          </h4>
          <p className={changed("businessProblem") ? "gm-changed" : undefined} title={was("businessProblem")}>
            {d.businessProblem}
            {changed("businessProblem") && tag("Updated")}
          </p>
        </>
      )}
      {list("Responsibilities", d.responsibilities, "responsibilities")}
      {list("Requirements", d.must, "must")}
      {list("Nice-to-have", d.pref, "pref")}
      <h4>
        {t("Compensation")}
        {d.compensation && mark("compensation")}
      </h4>
      <p className={changed("compensation") ? "gm-changed" : undefined} title={was("compensation")}>
        {money(d.compensation)}
        {changed("compensation") && tag("Updated")}
      </p>
      {list("Expected outcomes", d.outcomes, "outcomes", true)}
      {list("Success criteria", d.success, "success", true)}
    </div>
  );
}

/** An AI-suggested job title, highlighted until the user confirms or edits it (#66). */
function TitleConfirm({ title, busy, onConfirm }: { title: string; busy: boolean; onConfirm: (title: string) => void }) {
  const { t } = useStore();
  const [value, setValue] = useState(title);
  useEffect(() => setValue(title), [title]);
  return (
    <div className="gm-title-confirm">
      <div className="gm-title-confirm-head">
        <span className="gm-ai-tag">{t("AI suggested · to confirm")}</span>
        {t("This job title is a suggestion from your answers. Confirm it or change it before creating the job.")}
      </div>
      <div className="gm-title-confirm-row">
        <input value={value} aria-label={t("Job title")} onChange={(e) => setValue(e.target.value)} maxLength={200} />
        <Button size="sm" variant="primary" disabled={busy || !value.trim()} onClick={() => onConfirm(value)}>
          {t(value.trim() === title ? "Confirm title" : "Use this title")}
        </Button>
      </div>
    </div>
  );
}

const LEVELS = ["Intern", "Junior", "Mid", "Senior", "Staff", "Lead", "Manager", "Director"];
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];
/** Same cap as Core Record / the backend's `MAX_JOB_TITLE_LENGTH`. */
const MAX_JOB_TITLE_LENGTH = 200;

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
    // Optional: left unset unless the user picks one, so no type is recorded as if confirmed (#88).
    employmentType: "",
    department: "",
    summary: "",
    responsibilities: "",
    mustHave: "",
    niceToHave: "",
    salaryMin: "",
    salaryMax: "",
    currency: "CNY",
    period: "month",
    basis: "gross",
  });
  const [invalid, setInvalid] = useState<string | null>(null);
  const [invalidReason, setInvalidReason] = useState("");
  const set = (field: keyof typeof values) => (e: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: e.target.value }));
    if (invalid === field) setInvalid(null);
  };
  const fail = (field: string, message: string) => {
    setInvalid(field);
    setInvalidReason(message);
    say(t(message), { type: "error" });
  };

  const submit = () => {
    const headcount = Number(values.headcount);
    if (!values.title.trim()) return fail("title", "Please enter a job title.");
    if (values.title.trim().length > MAX_JOB_TITLE_LENGTH) return fail("title", "Job title can be at most 200 characters.");
    if (!values.location.trim()) return fail("location", "Please enter a work location.");
    if (!Number.isInteger(headcount) || headcount < 1) return fail("headcount", "Headcount must be a whole number of 1 or more.");
    const responsibilities = toLines(values.responsibilities);
    // Requirements keep the groups they are written in, e.g. "1.基础条件" / "2.专业能力" (#86).
    const { items: mustHave, groups: mustHaveGroups } = toGroupedLines(values.mustHave);
    const { items: niceToHave, groups: niceToHaveGroups } = toGroupedLines(values.niceToHave);
    if (!responsibilities.length) return fail("responsibilities", "Please add at least one responsibility.");
    if (!mustHave.length) return fail("mustHave", "Please add at least one requirement.");
    // Optional, entered in thousands like the editor's salary dialog; both ends or neither.
    let publicCompensation: CopilotJdFields["publicCompensation"];
    if (values.salaryMin.trim() || values.salaryMax.trim()) {
      const min = Number(values.salaryMin);
      const max = Number(values.salaryMax);
      if (!values.salaryMin.trim() || !values.salaryMax.trim() || !(min > 0) || !(max >= min)) {
        return fail("salary", "Enter a min and max (max ≥ min).");
      }
      publicCompensation = {
        min: Math.round(min * 1000),
        max: Math.round(max * 1000),
        currency: values.currency,
        period: values.period,
        basis: values.basis,
      };
    }
    onSubmit(
      {
        title: values.title.trim(),
        location: values.location.trim(),
        headcount,
        ...(values.employmentType ? { employmentType: values.employmentType } : {}),
        ...(values.department.trim() ? { department: values.department.trim() } : {}),
        ...(values.summary.trim() ? { roleSummary: values.summary.trim() } : {}),
        responsibilities,
        mustHave,
        ...(mustHaveGroups.some(Boolean) ? { mustHaveGroups } : {}),
        ...(niceToHave.length ? { niceToHave } : {}),
        ...(niceToHaveGroups.some(Boolean) ? { niceToHaveGroups } : {}),
        ...(publicCompensation ? { publicCompensation } : {}),
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
          {invalid === "title" && <span className="gm-field-error">{t(invalidReason)}</span>}
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
            <option value="">{t("Not set")}</option>
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
        <label>
          {t("Min")} <span className="gm-hint">K</span>
          <input className={cls("salary")} type="number" min={0} step="any" value={values.salaryMin} onChange={set("salaryMin")} placeholder={t("e.g. 15")} />
        </label>
        <label>
          {t("Max")} <span className="gm-hint">K</span>
          <input className={cls("salary")} type="number" min={0} step="any" value={values.salaryMax} onChange={set("salaryMax")} placeholder={t("e.g. 25")} />
        </label>
        <label>
          {t("Currency")}
          <select value={values.currency} onChange={set("currency")}>
            {CURRENCIES.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Pay period")}
          <select value={values.period} onChange={set("period")}>
            <option value="month">{t("Monthly")}</option>
            <option value="year">{t("Yearly")}</option>
          </select>
        </label>
        <label className="full">
          {t("Gross / net")}
          <select value={values.basis} onChange={set("basis")}>
            <option value="gross">{t("Gross (pre-tax)")}</option>
            <option value="net">{t("Net (after tax)")}</option>
          </select>
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
  wsVisible,
  onCreate,
  onConfirmTitle,
  onRefine,
  onSelectVariant,
  onSelectOption,
  onChooseFile,
  onPickVariant,
  onSubmitForm,
  onRetryCreate,
  onRetryRequest,
  onPasteText,
  onStartOver,
}: {
  msg: GeminiMsg;
  busy: boolean;
  wsVisible: boolean;
  onCreate: (draft: GeminiDraft) => void;
  onConfirmTitle: (title: string) => void;
  onRefine: () => void;
  onSelectVariant: (variantIndex: number) => void;
  onSelectOption: (option: ConversationActionOption) => void;
  onChooseFile: () => void;
  onPickVariant: (variantIndex: number) => void;
  onSubmitForm: (fields: CopilotJdFields, seniority: string) => void;
  onRetryCreate: () => void;
  onRetryRequest: () => void;
  onPasteText: () => void;
  onStartOver: () => void;
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
  if (msg.kind === "variants")
    return <VariantPicker msg={msg} busy={busy} wsVisible={wsVisible} onSelect={onSelectVariant} onPick={onPickVariant} onRefine={onRefine} />;
  if (msg.kind === "form") return <ManualJobForm msg={msg} busy={busy} onSubmit={onSubmitForm} />;
  if (msg.kind === "create-failed")
    return (
      <div className="gm-bubble ai gm-create-failed" role="alert">
        <div>{msg.text}</div>
        <div className="tiny" style={{ marginTop: 4 }}>
          {t("Nothing was saved and your input is kept.")}
        </div>
        {!msg.done && (
          <div className="gm-actions">
            <Button variant="primary" size="sm" disabled={busy} onClick={onRetryCreate}>
              <Icon name="refresh" />
              {busy ? t("Creating…") : t("Retry")}
            </Button>
          </div>
        )}
      </div>
    );
  if (msg.kind === "request-failed")
    return (
      <div className="gm-bubble ai gm-create-failed" role="alert">
        <div>{msg.text}</div>
        {!msg.done && (
          <div className="gm-actions">
            {msg.retry && (
              <Button variant="primary" size="sm" disabled={busy} onClick={onRetryRequest}>
                <Icon name="refresh" />
                {msg.retry.action === "upload" ? t("Choose the file again") : t("Retry")}
              </Button>
            )}
            {msg.retry?.action === 'link' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={onPasteText}>
                {t('Paste full JD text')}
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={busy} onClick={onStartOver}>
              <Icon name="restart_alt" />
              {t("Start over")}
            </Button>
          </div>
        )}
      </div>
    );
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
    const open = !msg.superseded && !msg.created;
    // With the Workspace open the full JD lives there; otherwise (closed, or a narrow screen) it stays inline.
    return (
      <div className="gm-bubble ai">
        <div>{t(wsVisible && open ? "I’ve drafted “%s” — review it in the Workspace." : "I’ve drafted “%s”.").replace("%s", d.title)}</div>
        {open && !wsVisible && (
          <div className="gm-variant-preview">
            <DraftBody d={d} />
          </div>
        )}
        {msg.superseded && <div className="tiny" style={{ marginTop: 8 }}>{t("Superseded by a newer draft below.")}</div>}
        {open && msg.titlePending && <TitleConfirm title={d.title} busy={busy} onConfirm={onConfirmTitle} />}
        {open && (
          <div className="gm-actions">
            <Button
              variant="primary"
              size="sm"
              disabled={busy || msg.titlePending}
              title={msg.titlePending ? t("Confirm or edit the job title first.") : undefined}
              onClick={() => onCreate(d)}
            >
              <Icon name="add_circle" />
              {t("Create job from this draft")}
            </Button>
            <Button size="sm" disabled={busy} onClick={onRefine}>
              {t("Refine", "gm_action.Refine")}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="gm-bubble ai">
      <div style={{ whiteSpace: "pre-wrap" }}>
        <LinkifiedText text={msg.text} />
      </div>
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
