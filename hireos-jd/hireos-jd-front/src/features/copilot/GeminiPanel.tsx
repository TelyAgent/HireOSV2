import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { mkBlock } from "../../data/fixtures/documents";
import { nowISO, uid } from "../../lib/format";
import {
  autoCompleteCopilotConversation,
  confirmCopilotDraft,
  createCopilotConversation,
  getCopilotConversation,
  listCopilotConversations,
  streamCopilotMessage,
  uploadCopilotAttachment,
  type CopilotConversationDto,
  type CopilotJdFields,
} from "./copilotApi";
import { CREATE_EXAMPLES, EDIT_CHIPS, EDIT_SELECTION_CHIPS, generateEditResponse, trunc } from "./geminiLogic";
import { VoiceInputButton, type VoiceInputStatus } from "./VoiceInputButton";
import { mergeVoiceTranscript } from "../../lib/voice-stream";
import { fmtRelative } from "../../lib/format";
import type { Audience, Requirement } from "../../data/types";
import type { ConversationActionOption, GeminiDraft, GeminiMsg } from "../../store/types";

/** Converts a fetched conversation's raw messages back into the panel's bubble shapes. There's no
 * per-message phase snapshot server-side, so a conversation that's currently ready to confirm gets its
 * trailing assistant reply swapped for the draft card — matching what a live turn would have shown. */
function conversationToGeminiMsgs(dto: CopilotConversationDto): GeminiMsg[] {
  const msgs: GeminiMsg[] = dto.messages.map((m) => ({ role: m.role === "user" ? "user" : "ai", text: m.text || "" }));
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
    summary: fields.roleSummary,
    responsibilities: fields.responsibilities && fields.responsibilities.length > 0 ? fields.responsibilities : [],
    must: fields.mustHave && fields.mustHave.length > 0 ? fields.mustHave : [],
    pref: fields.niceToHave,
  };
}

export interface GeminiCtx {
  mode: "create" | "edit";
  jobId: string | null;
  audience: Audience;
  selText: string | null;
}

export function chatKey(ctx: GeminiCtx) {
  return ctx.mode === "create" ? "new" : `${ctx.jobId}:${ctx.audience}`;
}

// Ported verbatim from the old project's `copilot.intro.greeting` catalog entry — the AI itself only
// ever replies in Chinese for this feature (the backend prompts are Chinese-only), so this intro isn't
// translated for the English UI toggle either.
const JD_STEWARD_GREETING =
  "你好，我是你的 JD 管家。很高兴陪你一起把这次招聘想清楚、写明白。告诉我你想找什么样的人，哪怕现在只有一个岗位名称也没关系，我们可以从已有信息开始，慢慢把它整理成一份专业、真实又有吸引力的 JD。";

// Matches the backend's `jd-autotake` skill exactly: this literal string is both the button's tooltip
// and the synthetic user-turn text sent to `/auto-complete`, so the chat bubble reads the same as the
// action the user just took (same pattern as the old project's autotake trigger copy).
const AUTO_COMPLETE_LABEL = "自动补全并优化内容";

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
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const push = (msg: GeminiMsg) =>
    mutate((draft) => {
      draft.geminiChats = { ...draft.geminiChats, [key]: [...(draft.geminiChats[key] ?? []), msg] };
    });

  const sendCreate = async (text: string) => {
    setBusy(true);
    let streaming = false;
    let accumulatedText = "";
    try {
      let conversationId = state.geminiConversationIds[key];
      if (!conversationId) {
        const conversation = await createCopilotConversation();
        conversationId = conversation.id;
        mutate((draft) => {
          draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversationId! };
        });
      }
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
      const lastReply = result.messages[result.messages.length - 1];
      const finalReply: GeminiMsg =
        result.phase === "ready_to_confirm"
          ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields) }
          : { role: "ai", text: lastReply?.text || "" };
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

  const send = (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || busy) return;
    setInput("");
    push({ role: "user", text });
    push({ role: "thinking" });

    if (ctx.mode === "create") {
      void sendCreate(text);
      return;
    }

    const id = window.setTimeout(() => {
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        const reply: GeminiMsg = { role: "ai", text: generateEditResponse(text, ctx.selText), canReplace: !!ctx.selText };
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, reply] };
      });
    }, 900);
    timers.current.push(id);
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
    if (busy) return;
    setHistoryOpen(false);
    try {
      const conversation = await createCopilotConversation();
      mutate((draft) => {
        draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
        draft.geminiChats = { ...draft.geminiChats, [key]: [] };
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
      setHistoryError(error instanceof Error ? error.message : t("Sorry, Copilot couldn’t process that just now. Please try again."));
    } finally {
      setHistoryLoading(false);
    }
  };

  const selectHistoryItem = async (id: string) => {
    if (busy) return;
    try {
      const conversation = await getCopilotConversation(id);
      mutate((draft) => {
        draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversation.id };
        draft.geminiChats = { ...draft.geminiChats, [key]: conversationToGeminiMsgs(conversation) };
      });
      setHistoryOpen(false);
      setInput("");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : t("Sorry, Copilot couldn’t process that just now. Please try again."));
    }
  };

  const handleAttachFile = async (file: File) => {
    setAttaching(true);
    push({ role: "user", text: `[${t("Uploaded file")}] ${file.name}` });
    push({ role: "thinking" });
    try {
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
      const finalReply: GeminiMsg =
        result.phase === "ready_to_confirm"
          ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields) }
          : { role: "ai", text: lastReply?.text || "" };
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, finalReply] };
      });
    } catch (error) {
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        const errorReply: GeminiMsg = {
          role: "ai",
          text: error instanceof Error ? error.message : t("Couldn't process this file. Please try again."),
        };
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, errorReply] };
      });
    } finally {
      setAttaching(false);
    }
  };

  const handleAutoComplete = async () => {
    if (busy) return;
    setBusy(true);
    push({ role: "user", text: AUTO_COMPLETE_LABEL });
    push({ role: "thinking" });
    try {
      let conversationId = state.geminiConversationIds[key];
      if (!conversationId) {
        const conversation = await createCopilotConversation();
        conversationId = conversation.id;
        mutate((draft) => {
          draft.geminiConversationIds = { ...draft.geminiConversationIds, [key]: conversationId! };
        });
      }
      const result = await autoCompleteCopilotConversation(conversationId);
      const lastReply = result.messages[result.messages.length - 1];
      const finalReply: GeminiMsg =
        result.phase === "ready_to_confirm"
          ? { role: "ai", draft: jdFieldsToGeminiDraft(result.fields) }
          : { role: "ai", text: lastReply?.text || "" };
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, finalReply] };
      });
    } catch (error) {
      mutate((draft) => {
        const list = (draft.geminiChats[key] ?? []).filter((m) => m.role !== "thinking");
        const errorReply: GeminiMsg = {
          role: "ai",
          text: error instanceof Error ? error.message : t("Sorry, Copilot couldn’t process that just now. Please try again."),
        };
        draft.geminiChats = { ...draft.geminiChats, [key]: [...list, errorReply] };
      });
    } finally {
      setBusy(false);
    }
  };

  const insert = (text: string, mode: "append" | "replace") => {
    if (!ctx.jobId) return;
    const jobId = ctx.jobId;
    let applied = false;
    mutate((draft) => {
      const doc = draft.drafts[`${jobId}:${ctx.audience}`];
      if (!doc) return;
      if (mode === "replace" && ctx.selText) {
        for (const b of doc.blocks) {
          if (applied) break;
          if (typeof b.text === "string" && b.text.includes(ctx.selText)) {
            b.text = b.text.replace(ctx.selText, text);
            applied = true;
          } else if (Array.isArray(b.text)) {
            const li = b.text.findIndex((x) => x.includes(ctx.selText!));
            if (li >= 0) {
              b.text[li] = b.text[li].replace(ctx.selText, text);
              applied = true;
            }
          }
        }
      }
      if (!applied) doc.blocks.push(mkBlock(uid("gb"), "p", text));
      doc.revision = (doc.revision || 1) + 1;
      doc.saveState = "saved";
      (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
        at: nowISO(),
        actor: draft.currentUserId,
        text: "Inserted Copilot-generated text via Ask Copilot.",
        tag: "AI",
      });
    });
    closeModal();
    say(applied ? t("Replaced the selected text") : t("Inserted into the document"));
  };

  const createJobFromDraft = async (d: GeminiDraft) => {
    // Confirms the draft as a real Job on the Core Record service and uses its real id, so the job
    // this navigates to is the same one the Job Library page (which now reads real backend data) will
    // show. Only falls back to a local-only fixture id if the backend call itself fails.
    const conversationId = state.geminiConversationIds[key];
    let newId: string;
    try {
      if (!conversationId) throw new Error("No conversation to confirm.");
      newId = (await confirmCopilotDraft(conversationId)).jobId;
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
        location: "Ho Chi Minh City, VN",
        employmentType: "Full-time",
        workplaceType: "Hybrid",
        level: "Mid",
        priority: "normal",
        headcount: 1,
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
      draft.drafts[newId + ":internal"] = {
        id: "doc-" + newId + "-internal",
        jobId: newId,
        audience: "internal",
        language: "en",
        revision: 1,
        saveState: "saved",
        blocks: [
          mkBlock(bid(), "h2", `${d.title} — ${d.department}`),
          mkBlock(bid(), "p", d.summary || "Drafted live with Ask Copilot from a spoken/typed description."),
          mkBlock(bid(), "h2", "Responsibilities"),
          mkBlock(bid(), "ul", d.responsibilities),
          mkBlock(bid(), "h2", "Requirements — Must-have"),
          mkBlock(bid(), "ul", d.must),
          ...(d.pref && d.pref.length ? [mkBlock(bid(), "h2", "Preferred"), mkBlock(bid(), "ul", d.pref)] : []),
        ],
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

  const handleSelectOption = (option: ConversationActionOption) => {
    closeModal();
    navigate(option.href);
  };

  const title = ctx.mode === "create" ? t("Ask Copilot — Create a job") : t("Ask Copilot");
  const sub =
    ctx.mode === "create"
      ? t("Describe the role out loud or in writing — Copilot drafts a structured job for you to review.")
      : ctx.selText
        ? `${t("Working with the selected text")}: “${trunc(ctx.selText, 90)}”`
        : t(
            "Ask for a rewrite, a new section, or anything else — Copilot drafts it here first, nothing changes in the document until you insert it.",
          );
  const chips = ctx.selText ? EDIT_SELECTION_CHIPS : EDIT_CHIPS;

  return (
    <div className="gemini-panel">
      <div className="gemini-panel-header">
        <span className="gp-icon material-icons-o">auto_awesome</span>
        <div className="gp-title">{historyOpen ? t("History") : title}</div>
        <div style={{ flex: 1 }} />
        {ctx.mode === "create" && !historyOpen && (
          <>
            <button className="icon-btn" type="button" disabled={busy} onClick={() => void startNewConversation()} title={t("New conversation")} aria-label={t("New conversation")}>
              <Icon name="add" />
            </button>
            <button className="icon-btn" type="button" disabled={busy} onClick={() => void openHistory()} title={t("Conversation history")} aria-label={t("Conversation history")}>
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
      {!historyOpen && <div className="gemini-panel-sub">{sub}</div>}
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
            ctx.mode === "create" ? (
              <div className="gm-intro">
                <p>{t(JD_STEWARD_GREETING)}</p>
                <div className="gm-example-list">
                  <p className="gm-example-label">{t("You could say")}</p>
                  {CREATE_EXAMPLES.map((example) => (
                    <button key={example} className="gm-example" type="button" onClick={() => send(example)}>
                      <Icon name="subdirectory_arrow_right" size={16} />
                      <span>{example}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="gm-empty">
                <Icon name="auto_awesome" size={34} />
                <div style={{ marginTop: 6 }}>{t("Tap the microphone and describe what you need, or type below.")}</div>
                <div className="gm-chip-row">
                  {chips.map((c) => (
                    <div key={c} className="gm-chip" onClick={() => send(c)}>
                      {t(c)}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            msgs.map((m, i) => (
              <GeminiMessage
                key={i}
                msg={m}
                showInsertActions={ctx.mode === "edit"}
                onInsert={insert}
                onCreate={createJobFromDraft}
                onSelectOption={handleSelectOption}
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
              rows={1}
              placeholder={t("Or type instead…")}
              value={input}
              disabled={voiceStatus !== "idle"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              autoFocus
            />
            <div className="gemini-composer-footer">
              <div className="gemini-composer-tools">
                {ctx.mode === "create" && (
                  <button
                    className="gemini-composer-tool"
                    type="button"
                    disabled={attaching || busy}
                    onClick={() => attachFileInputRef.current?.click()}
                    title={t("Upload source material")}
                    aria-label={t("Upload source material")}
                  >
                    <Icon name="add" />
                  </button>
                )}
                {ctx.mode === "create" && (
                  <button
                    className="gemini-composer-tool"
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAutoComplete()}
                    title={AUTO_COMPLETE_LABEL}
                    aria-label={AUTO_COMPLETE_LABEL}
                  >
                    <Icon name="auto_fix_high" />
                  </button>
                )}
                <input
                  ref={attachFileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
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
                  disabled={busy}
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

function GeminiMessage({
  msg,
  showInsertActions,
  onInsert,
  onCreate,
  onSelectOption,
}: {
  msg: GeminiMsg;
  showInsertActions: boolean;
  onInsert: (text: string, mode: "append" | "replace") => void;
  onCreate: (draft: GeminiDraft) => void;
  onSelectOption: (option: ConversationActionOption) => void;
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
  if (msg.draft) {
    const d = msg.draft;
    return (
      <div className="gm-bubble ai">
        <div className="gm-draft-title">{d.title}</div>
        <div className="tiny">{d.department}</div>
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
        <div className="gm-actions">
          <Button variant="primary" size="sm" onClick={() => onCreate(d)}>
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
      {showInsertActions && (
        <div className="gm-actions">
          <Button variant="primary" size="sm" onClick={() => onInsert(msg.text!, "append")}>
            <Icon name="add" />
            {t("Insert into document")}
          </Button>
          {msg.canReplace && (
            <Button size="sm" onClick={() => onInsert(msg.text!, "replace")}>
              <Icon name="find_replace" />
              {t("Replace selected text")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
