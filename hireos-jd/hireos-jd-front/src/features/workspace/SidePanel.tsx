import { useEffect, useRef, useState } from "react";
import { Icon } from "../../components/ui/Icons";
import { Button, EmptyState, PersonAvatar } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { getPerson } from "../../data/fixtures/people";
import { fmtRelative } from "../../lib/format";
import { selectSuggestions, selectThreads } from "./docHelpers";
import { useDocActions } from "./docActions";
import { scrollToBlock } from "./DocumentTab";
import type { Audience, Suggestion } from "../../data/types";
import type { CopilotMsg, SideTab } from "../../store/types";

export function SidePanel({ jobId, audience }: { jobId: string; audience: Audience }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId, audience);
  const activeTab = state.wsSideTab;

  const openComments = selectThreads(state, jobId, audience).filter((x) => x.status === "open").length;
  const openChanges = selectSuggestions(state, jobId, audience).filter(
    (x) => x.status === "proposed" || x.status === "stale",
  ).length;

  const tabs: { key: SideTab; label: string; count?: number }[] = [
    { key: "copilot", label: "Copilot" },
    { key: "comments", label: "Comments", count: openComments },
    { key: "changes", label: "Changes", count: openChanges },
  ];

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
            {x.count != null ? ` (${x.count})` : ""}
          </div>
        ))}
      </div>
      <div className="jw-side-body">
        {activeTab === "copilot" && <CopilotTab jobId={jobId} audience={audience} />}
        {activeTab === "comments" && <CommentsTab jobId={jobId} audience={audience} />}
        {activeTab === "changes" && <ChangesTab jobId={jobId} audience={audience} />}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   Copilot
   --------------------------------------------------------------- */
function CopilotTab({ jobId, audience }: { jobId: string; audience: Audience }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId, audience);
  const [input, setInput] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const sel = state.wsSelection;

  // The External JD conversation must never carry internal compensation.
  const restrictedBlocked =
    audience === "external" && !!sel?.text && /budget|ceiling|\$7,000|internal comp/i.test(sel.text);

  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.wsCopilotThread.length]);

  const send = () => {
    if (!input.trim()) return;
    actions.sendCopilot(input.trim());
    setInput("");
  };

  return (
    <>
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

      {sel ? (
        <div className="chip" style={{ marginBottom: 12 }}>
          <Icon name="text_fields" size={14} />
          <span style={{ maxWidth: 230, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {t(sel.scopeLabel || "Selected text")}: “{(sel.text || "").slice(0, 60)}
            {(sel.text || "").length > 60 ? "…" : ""}”
          </span>
          <button onClick={actions.clearSelection} aria-label={t("Clear selection")}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ) : (
        <div className="tiny" style={{ marginBottom: 12 }}>
          {t("No text selected — Copilot will ask before acting on the whole document.")}
        </div>
      )}

      {restrictedBlocked && (
        <div className="warning-inline" style={{ marginBottom: 12 }}>
          <Icon name="lock" />
          {t("This looks like internal compensation. It can’t be used in the External JD conversation.")}
        </div>
      )}

      <div ref={threadRef}>
        {state.wsCopilotThread.map((m, i) => (
          <CopilotMessage key={i} msg={m} jobId={jobId} audience={audience} />
        ))}
      </div>

      <div className="field" style={{ marginTop: 14 }}>
        <textarea
          placeholder={t("Ask Copilot to rewrite, explain, or draft something…")}
          disabled={restrictedBlocked}
          style={{ minHeight: 60 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
      </div>
      <Button variant="primary" className="w-full" disabled={restrictedBlocked} onClick={send}>
        <Icon name="send" />
        {t("Ask Copilot")}
      </Button>
    </>
  );
}

function CopilotMessage({ msg, jobId, audience }: { msg: CopilotMsg; jobId: string; audience: Audience }) {
  const { state, t, person } = useStore();
  const actions = useDocActions(jobId, audience);

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
  const live = selectSuggestions(state, jobId, audience).find((x) => x.id === msg.suggestion.id) ?? msg.suggestion;
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
        <div className="sc-diff">
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

/* ---------------------------------------------------------------
   Comments
   --------------------------------------------------------------- */
function CommentsTab({ jobId, audience }: { jobId: string; audience: Audience }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId, audience);
  const threads = selectThreads(state, jobId, audience);

  if (threads.length === 0) {
    return (
      <EmptyState
        icon="forum"
        title={t("No comments yet")}
        body={t("Select text in the document and choose Add comment.")}
      />
    );
  }

  return (
    <>
      {threads.map((th) => (
        <div key={th.id} className={`comment-thread${th.status === "resolved" ? " resolved" : ""}`}>
          <div className="ct-head">
            <PersonAvatar id={th.author} />
            <strong style={{ fontSize: "var(--fs-sm)" }}>{getPerson(th.author)?.name}</strong>
            <span className="tiny">{fmtRelative(th.createdAt)}</span>
            {th.status === "resolved" && <span className="badge badge-neutral">{t("Resolved")}</span>}
          </div>
          <div className="ct-body">{th.body}</div>
          {th.replies.map((r, i) => (
            <div key={i} className="ct-reply">
              <PersonAvatar id={r.author} />
              <strong style={{ fontSize: "var(--fs-xs)" }}>{getPerson(r.author)?.name}</strong>{" "}
              <span className="tiny">{fmtRelative(r.createdAt)}</span>
              <div style={{ marginTop: 3 }}>{r.body}</div>
            </div>
          ))}
          <div className="flex gap-8" style={{ marginTop: 8 }}>
            <Button variant="text" size="sm" onClick={() => scrollToBlock(th.anchorBlock)}>
              {t("View in document")}
            </Button>
            {th.status === "open" ? (
              <>
                <Button variant="text" size="sm" onClick={() => actions.replyThread(th.id)}>
                  {t("Reply")}
                </Button>
                <Button variant="text" size="sm" onClick={() => actions.resolveThread(th.id)}>
                  {t("Resolve")}
                </Button>
              </>
            ) : (
              <Button variant="text" size="sm" onClick={() => actions.reopenThread(th.id)}>
                {t("Reopen")}
              </Button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------
   Changes
   --------------------------------------------------------------- */
function ChangesTab({ jobId, audience }: { jobId: string; audience: Audience }) {
  const { state, t, say } = useStore();
  const actions = useDocActions(jobId, audience);
  const list = selectSuggestions(state, jobId, audience).filter((s) => s.status === "proposed" || s.status === "stale");

  if (list.length === 0) {
    return (
      <EmptyState
        icon="rule"
        title={t("No pending changes")}
        body={t("Suggested edits and requirement changes will show up here for review.")}
      />
    );
  }

  const acceptAllReady = () => {
    const ready = list.filter((s) => s.status === "proposed");
    ready.forEach((s) => actions.acceptSuggestion(s.id));
    say(`${ready.length} ${t("change(s) accepted")}`);
  };

  return (
    <>
      <div className="tiny" style={{ marginBottom: 10 }}>
        {list.length} {t("unresolved")} •{" "}
        <button className="link-btn" onClick={acceptAllReady}>
          {t("Accept all ready")}
        </button>
      </div>
      {list.map((s) => (
        <div key={s.id} className={`changes-item${s.status === "stale" ? " stale" : ""}`}>
          <div className="ci-head">
            <Icon name={s.author === "ai" ? "auto_awesome" : "person"} size={14} />
            {s.author === "ai" ? t("AI suggestion") : getPerson(s.initiatedBy)?.name} • {fmtRelative(s.createdAt)}{" "}
            {s.status === "stale" && <span className="badge badge-warning">{t("Needs refresh")}</span>}
          </div>
          <div className="ci-diff">
            <span className="ci-old">{s.oldText}</span>
            <br />
            <span className="ci-new">{s.newText}</span>
          </div>
          <div className="tiny" style={{ marginBottom: 8 }}>
            {s.reason}
          </div>
          {s.status === "stale" ? (
            <>
              <div className="warning-inline" style={{ marginBottom: 8 }}>
                <Icon name="warning" />
                {s.staleReason || t("Based on an older draft.")}
              </div>
              <Button size="sm" onClick={() => actions.reviewLatest(s.id)}>
                {t("Review latest text")}
              </Button>
            </>
          ) : (
            <div className="sc-actions">
              <Button variant="primary" size="sm" onClick={() => actions.acceptSuggestion(s.id)}>
                {t("Accept")}
              </Button>
              <Button size="sm" onClick={() => actions.rejectSuggestion(s.id)}>
                {t("Reject")}
              </Button>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
