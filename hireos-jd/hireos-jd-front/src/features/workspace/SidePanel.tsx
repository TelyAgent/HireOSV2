import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { fmtRelative } from "../../lib/format";
import { blockLevel, blockPlainText, selectDraft, selectSuggestions } from "./docHelpers";
import { useDocActions } from "./docActions";
import { Input } from "antd";
import { VoiceInputButton, type VoiceInputStatus } from "../copilot/VoiceInputButton";
import { mergeVoiceTranscript } from "../../lib/voice-stream";
import { useCompleteness } from "./useCompleteness";
import { issueCount } from "./completeness";
import { AnalysisPanel } from "./AnalysisPanel";
import { scrollToBlock } from "./DocumentTab";
import type { Suggestion } from "../../data/types";
import type { CopilotMsg, SideTab } from "../../store/types";

export function SidePanel({ jobId }: { jobId: string }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId);
  const ev = useCompleteness(jobId);
  const issues = ev ? issueCount(ev) : 0;
  const tabs: { key: SideTab; label: string; count?: number; tone?: string }[] = [
    { key: "copilot", label: "Copilot" },
    { key: "analysis", label: "Analysis", count: issues, tone: ev && (ev.missing || ev.blockers) ? "bad" : "warn" },
  ];
  const activeTab = state.wsSideTab;

  return (
    <div className="jw-side">
      <div className="jw-side-tabs">
        {tabs.map((x) => (
          <div
            key={x.key}
            className={`jw-side-tab${activeTab === x.key ? " active" : ""}`}
            onClick={() => actions.setSideTab(x.key)}
          >
            {t(x.label)}
            {x.count ? <span className={`jw-side-cnt ${x.tone}`}>{x.count}</span> : null}
          </div>
        ))}
      </div>
      {activeTab === "analysis" ? (
        <div className="jw-side-body">
          <AnalysisPanel jobId={jobId} />
        </div>
      ) : (
        <div className="jw-side-body is-copilot">
          <CopilotTab jobId={jobId} />
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   Copilot
   --------------------------------------------------------------- */
function CopilotTab({ jobId }: { jobId: string }) {
  const { state, t, say } = useStore();
  const actions = useDocActions(jobId);
  const [input, setInput] = useState("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceInputStatus>("idle");
  // Text that was already typed when dictation started; transcripts are merged onto it.
  const voiceBase = useRef<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const sel = state.wsSelection;
  const busy = state.wsCopilotBusy;
  const focused = state.wsFocusBlockId
    ? selectDraft(state, jobId).blocks.find((b) => b.id === state.wsFocusBlockId)
    : undefined;

  // Completeness standard V5: Confidential blocks are never sent to Copilot.
  const targetId = sel ? sel.blockId : focused?.id;
  const target = targetId ? selectDraft(state, jobId).blocks.find((b) => b.id === targetId) : undefined;
  const restrictedBlocked = !!target && blockLevel(target) === "confidential";

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.wsCopilotThread.length, busy]);

  const send = () => {
    if (!input.trim() || busy) return;
    actions.sendCopilot(input.trim());
    setInput("");
  };

  return (
    <>
      <div className="copilot-scroll" ref={threadRef}>
        <div className="copilot-msg">
          <div className="who">
            <Icon name="auto_awesome" size={15} />
            Copilot
          </div>
          <div className="bubble">
            {t(
              "I can help define and manage this job — its responsibilities, requirements and compensation. Select any text in the document to ask me to rewrite, shorten, clarify it, or ask me anything below.",
            )}
          </div>
        </div>

        <div>
          {state.wsCopilotThread.map((m, i) => (
            <CopilotMessage key={i} msg={m} jobId={jobId} />
          ))}
          {busy && (
            <div className="copilot-msg">
              <div className="who">
                <Icon name="auto_awesome" size={15} />
                Copilot
              </div>
              <div className="bubble tiny">{t("Thinking…")}</div>
            </div>
          )}
        </div>
      </div>

      <div className="cp-composer">
        {sel ? (
          <div className="chip cp-quote">
            <Icon name="text_fields" size={14} />
            <span className="cp-quote-txt">
              {t(sel.scopeLabel || "Selected text")}: “{(sel.text || "").slice(0, 60)}
              {(sel.text || "").length > 60 ? "…" : ""}”
            </span>
            <button onClick={actions.clearSelection} aria-label={t("Clear selection")}>
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : (
          focused && (
            <div className="chip cp-quote">
              <Icon name="text_fields" size={14} />
              <span className="cp-quote-txt">
                {t("Current block")}: “{blockPlainText(focused).slice(0, 60)}”
              </span>
            </div>
          )
        )}
        {restrictedBlocked && (
          <div className="warning-inline" style={{ marginBottom: 8 }}>
            <Icon name="lock" />
            {t("This block is Confidential — Copilot can’t read or rewrite it.")}
          </div>
        )}
        <div className={`cp-box${restrictedBlocked ? " is-disabled" : ""}`}>
          <Input.TextArea
            variant="borderless"
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder={t("Ask Copilot to rewrite, explain, or draft something…")}
            disabled={restrictedBlocked || voiceStatus !== "idle"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter for a new line; leave Enter alone while an IME is composing.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="cp-bar">
            <VoiceInputButton
              className="cp-mic"
              disabled={restrictedBlocked || busy}
              onPartialTranscript={(text) => {
                if (voiceBase.current === null) voiceBase.current = input;
                setInput(mergeVoiceTranscript(voiceBase.current, text));
              }}
              onTranscript={(text) => {
                setInput(mergeVoiceTranscript(voiceBase.current ?? input, text));
                voiceBase.current = null;
              }}
              onError={(message) => {
                voiceBase.current = null;
                say(message, { type: "error" });
              }}
              onStatusChange={setVoiceStatus}
            />
            <span className="cp-listen">
              {voiceStatus === "connecting" ? t("Connecting…") : voiceStatus === "listening" ? t("Listening…") : ""}
            </span>
            <button
              type="button"
              className="cp-send"
              title={t("Send")}
              aria-label={t("Send to Copilot")}
              disabled={!input.trim() || busy || restrictedBlocked || voiceStatus !== "idle"}
              onClick={send}
            >
              <Icon name="arrow_upward" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function CopilotMessage({ msg, jobId }: { msg: CopilotMsg; jobId: string }) {
  const { state, t, person } = useStore();
  const actions = useDocActions(jobId);

  if (msg.kind === "user") {
    return (
      <div className="copilot-msg from-user">
        <div className="who">{person?.name}</div>
        <div className="bubble">{msg.text}</div>
      </div>
    );
  }
  if (msg.kind === "text") {
    return (
      <div className="copilot-msg">
        <div className="who">
          <Icon name="auto_awesome" size={15} />
          Copilot
        </div>
        <div className="bubble">{msg.text}</div>
      </div>
    );
  }

  // Read the live copy so status updates (accepted/rejected) show through.
  const live = selectSuggestions(state, jobId).find((x) => x.id === msg.suggestion.id) ?? msg.suggestion;
  return (
    <div className="copilot-msg">
      <div className="who">
        <Icon name="auto_awesome" size={15} />
        Copilot
      </div>
      <div className="bubble">
        {msg.explain}
        <div className="locate-tag" onClick={() => scrollToBlock(live.anchorBlock)}>
          <Icon name="north_east" size={13} />
          {t("View in document")}
        </div>
      </div>
      <div className="suggestion-card">
        <div className="sc-head">
          <Icon name="auto_awesome" size={13} />
          {t("AI suggestion")} • {fmtRelative(live.createdAt)}
        </div>
        <div className="sc-diff" style={{ whiteSpace: "pre-line" }}>
          <span className="ci-old" style={{ textDecoration: "line-through", color: "var(--danger-text)" }}>
            {live.oldText}
          </span>
          <br />
          <span className="ci-new" style={{ color: "var(--success-text)" }}>
            {live.newText}
          </span>
        </div>
        <div className="sc-note">{live.reason}</div>
        {live.status === "proposed" ? (
          <div className="sc-actions" style={{ marginTop: 8 }}>
            <Button variant="primary" size="sm" onClick={() => actions.acceptSuggestion(live.id)}>
              {t("Accept")}
            </Button>
            <Button size="sm" onClick={() => actions.rejectSuggestion(live.id)}>
              {t("Reject")}
            </Button>
            <Button variant="text" size="sm" onClick={() => actions.refineSuggestion(live.id)}>
              {t("Refine")}
            </Button>
          </div>
        ) : (
          <SuggestionStatusBadge status={live.status} />
        )}
      </div>
    </div>
  );
}

function SuggestionStatusBadge({ status }: { status: Suggestion["status"] }) {
  const { t } = useStore();
  const tone = status === "accepted" ? "badge-success" : status === "rejected" ? "badge-neutral" : "badge-warning";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <span className={`badge ${tone}`}>{t(label, `suggestion.${label}`)}</span>;
}
