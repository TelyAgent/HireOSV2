import { Fragment, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import { selectDraft, selectSuggestions, selectThreads, pendingSuggestionsFor, ensureDraft, stripHtml, docKey, buildDraftFromBackend } from "./docHelpers";
import { COMMIT_DEBOUNCE_MS, RichBlockEditor } from "./RichBlockEditor";
import { getCurrentDraft, getJobDocument, saveJobDocument } from "./documentsApi";
import { SidePanel } from "./SidePanel";
import { useDocActions } from "./docActions";
import type { Audience, DocBlock } from "../../data/types";
import type { WsMode } from "../../store/types";

const MODES: WsMode[] = ["editing", "suggesting", "viewing"];

export function scrollToBlock(blockId: string) {
  const el = document.querySelector(`.doc-block[data-block-id="${blockId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("selected");
  setTimeout(() => el.classList.remove("selected"), 1200);
}

interface PendingSel {
  text: string;
  blockId: string | null;
  top: number;
  left: number;
}

export function DocumentTab({ jobId, audience }: { jobId: string; audience: Audience }) {
  const { state, t, set, mutate, say } = useStore();
  const draft = selectDraft(state, jobId, audience);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  // Bumped whenever the document is replaced wholesale (loaded from the backend), so the per-block
  // editors — which only read their content on mount — remount with the new text.
  const [docEpoch, setDocEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const docRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pendingSel, setPendingSel] = useState<PendingSel | null>(null);
  const actions = useDocActions(jobId, audience);

  // Rich-text editing is scoped to the Internal document's Editing mode for now (see RichBlockEditor) —
  // Suggesting/Viewing and the External audience keep the existing static, read-only rendering.
  const isRichEditable = state.wsMode === "editing" && audience === "internal";
  const editorsRef = useRef(new Map<string, Editor>());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [, bumpTick] = useReducer((c: number) => c + 1, 0);
  const activeEditor = activeBlockId ? editorsRef.current.get(activeBlockId) : undefined;
  const canFormat = isRichEditable && !!activeEditor;

  // Clear the floating toolbar whenever the document identity changes.
  useEffect(() => setPendingSel(null), [jobId, audience, state.wsMode]);
  // Each RichBlockEditor registers/unregisters itself in editorsRef via its own mount/unmount effect
  // (whichever blocks exist for the new jobId/audience naturally (de)register themselves) — this only
  // needs to drop the now-stale "focused block" pointer from the previous document.
  useEffect(() => setActiveBlockId(null), [jobId, audience]);

  // Load the saved document, or — for a job whose document was never saved — seed it from the
  // structured JD content Copilot stored when the job was created. Unsaved local edits win.
  useEffect(() => {
    if (latestDraft.current.saveState === "dirty") {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const saved = await getJobDocument(jobId, audience);
      if (cancelled) return;
      if (saved) {
        mutate((d) => {
          d.drafts[docKey(jobId, audience)] = {
            ...ensureDraft(d, jobId, audience),
            blocks: saved.blocks,
            serverRevision: saved.revision,
            saveState: "saved",
          };
        });
      } else {
        const content = await getCurrentDraft(jobId);
        if (cancelled || !content) return;
        mutate((d) => {
          const title = d.jobs[jobId]?.title ?? "";
          d.drafts[docKey(jobId, audience)] = buildDraftFromBackend(title, content, jobId, audience);
        });
      }
      setDocEpoch((n) => n + 1);
    })()
      .catch((error) => console.warn("Failed to load the job document:", error))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, audience]);

  const isDirty = draft.saveState === "dirty";
  const saveDocument = async () => {
    if (latestDraft.current.saveState === "saving") return;
    mutate((d) => void (ensureDraft(d, jobId, audience).saveState = "saving"));
    // Editors commit keystrokes on a short debounce — wait it out so the last edit is included.
    await new Promise((resolve) => window.setTimeout(resolve, COMMIT_DEBOUNCE_MS + 50));
    const doc = latestDraft.current;
    const sentRevision = doc.revision;
    try {
      const saved = await saveJobDocument(jobId, audience, doc.blocks, doc.serverRevision);
      mutate((d) => {
        const target = ensureDraft(d, jobId, audience);
        target.serverRevision = saved.revision;
        // Edits made while the request was in flight stay unsaved.
        target.saveState = target.revision === sentRevision ? "saved" : "dirty";
      });
      say(t("Document saved"), { type: "success" });
    } catch (error) {
      mutate((d) => void (ensureDraft(d, jobId, audience).saveState = "dirty"));
      say(error instanceof Error ? error.message : t("Couldn't save the document. Please try again."), { type: "error" });
    }
  };

  // Cmd/Ctrl+S saves; leaving the page with unsaved edits asks first.
  const saveRef = useRef(saveDocument);
  saveRef.current = saveDocument;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (latestDraft.current.saveState === "dirty") void saveRef.current();
      }
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (latestDraft.current.saveState === "dirty") e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const commitBlockText = (blockId: string, text: string | string[]) => {
    mutate((d) => {
      const doc = ensureDraft(d, jobId, audience);
      const block = doc.blocks.find((b) => b.id === blockId);
      if (!block) return;
      block.text = text;
      doc.revision++;
      if (doc.saveState !== "saving") doc.saveState = "dirty";
    });
  };

  const convertActiveBlockToList = () => {
    if (!activeBlockId) return;
    mutate((d) => {
      const doc = ensureDraft(d, jobId, audience);
      const block = doc.blocks.find((b) => b.id === activeBlockId);
      if (!block || block.kind === "ul") return;
      block.kind = "ul";
      block.text = [typeof block.text === "string" ? stripHtml(block.text) : ""];
      doc.revision++;
      doc.saveState = "dirty";
    });
  };

  const onMouseUp = () => {
    // Let the browser finish updating the selection before reading it.
    setTimeout(() => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      if (!txt || txt.length < 2 || state.wsMode === "viewing") return setPendingSel(null);
      if (!sel?.anchorNode || !docRef.current?.contains(sel.anchorNode)) return setPendingSel(null);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const blockEl = (sel.anchorNode.parentElement as HTMLElement | null)?.closest(".doc-block");
      setPendingSel({
        text: txt,
        blockId: blockEl?.getAttribute("data-block-id") ?? null,
        top: Math.max(4, rect.top - wrapRect.top - 44 + wrap.scrollTop),
        left: Math.max(0, rect.left - wrapRect.left),
      });
    }, 5);
  };

  const outline = draft.blocks.filter((b) => b.kind === "h2");

  return (
    <>
      <div className="jw-toolbar">
        <div className="jw-mode-tabs">
          {MODES.map((m) => (
            <button
              key={m}
              className={`jw-mode-tab${state.wsMode === m ? " active" : ""}`}
              onClick={() => set({ wsMode: m })}
            >
              {t(m.charAt(0).toUpperCase() + m.slice(1))}
            </button>
          ))}
        </div>
        <div className="tb-sep" />
        <div className="jw-mode-tabs">
          <button
            className={`jw-mode-tab${audience === "internal" ? " active" : ""}`}
            onClick={() => actions.setAudience("internal")}
          >
            {t("Internal")}
          </button>
          <button
            className={`jw-mode-tab${audience === "external" ? " active" : ""}`}
            onClick={() => actions.setAudience("external")}
          >
            {t("External")}
          </button>
        </div>
        <div className="tb-sep" />
        <button
          className={`tb-btn${activeEditor?.isActive("bold") ? " active" : ""}`}
          title={t("Bold")}
          disabled={!canFormat}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => activeEditor?.chain().focus().toggleBold().run()}
        >
          <Icon name="format_bold" />
        </button>
        <button
          className={`tb-btn${activeEditor?.isActive("italic") ? " active" : ""}`}
          title={t("Italic")}
          disabled={!canFormat}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => activeEditor?.chain().focus().toggleItalic().run()}
        >
          <Icon name="format_italic" />
        </button>
        <button
          className={`tb-btn${activeEditor?.isActive("bulletList") ? " active" : ""}`}
          title={t("Bulleted list")}
          disabled={!canFormat || activeEditor?.isActive("bulletList")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={convertActiveBlockToList}
        >
          <Icon name="format_list_bulleted" />
        </button>
        <button
          className="tb-btn"
          title={t("Undo")}
          disabled={!canFormat}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => activeEditor?.chain().focus().undo().run()}
        >
          <Icon name="undo" />
        </button>
        <button className="tb-btn" title={t("Find")}>
          <Icon name="search" />
        </button>
        <div style={{ flex: 1 }} />
        {loading ? (
          <span className="jw-save-state">
            <Icon name="sync" />
            {t("Loading…")}
          </span>
        ) : isDirty ? (
          <>
            <span className="jw-save-state">{t("Unsaved changes")}</span>
            <Button size="sm" variant="primary" onClick={() => void saveDocument()} title="⌘/Ctrl + S">
              <Icon name="save" />
              {t("Save")}
            </Button>
          </>
        ) : (
          <span className="jw-save-state">
            <Icon name={draft.saveState === "saving" ? "sync" : "cloud_done"} />
            {draft.saveState === "saving" ? t("Saving…") : t("Saved")}
          </span>
        )}
      </div>

      <div className="jw-body">
        <div className="jw-outline">
          <div
            className="tiny"
            style={{ fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", padding: "0 10px 8px" }}
          >
            {t("Outline")}
          </div>
          {outline.map((b) => (
            <div key={b.id} className="jw-outline-item" onClick={() => scrollToBlock(b.id)}>
              {typeof b.text === "string" ? stripHtml(b.text) : ""}
            </div>
          ))}
        </div>

        <div className="jw-doc-wrap" ref={wrapRef}>
          <div className="jw-doc" ref={docRef} onMouseUp={onMouseUp} key={docEpoch}>
            {audience === "external" && (
              <div className="info-inline" style={{ marginBottom: 18 }}>
                {t("Candidate-facing version")} • {t("source")}: {t("role")} v
                {state.jobs[jobId].activeRoleVersionRef
                  ? state.roleVersions[state.jobs[jobId].activeRoleVersionRef!]?.versionNo
                  : "—"}{" "}
                • {draft.reviewStatus === "reviewed" ? t("Reviewed") : t("Needs review")}
              </div>
            )}
            {draft.blocks.map((b) => (
              <DocBlockView
                key={b.id}
                block={b}
                jobId={jobId}
                audience={audience}
                editable={isRichEditable}
                isActive={activeBlockId === b.id}
                onTextChange={(text) => commitBlockText(b.id, text)}
                onFocusBlock={() => setActiveBlockId(b.id)}
                onEditorReady={(editor) => {
                  editorsRef.current.set(b.id, editor);
                  if (activeBlockId === b.id) bumpTick();
                }}
                onEditorDestroy={() => editorsRef.current.delete(b.id)}
                onActivity={() => {
                  if (activeBlockId === b.id) bumpTick();
                }}
              />
            ))}
          </div>
          {pendingSel && (
            <div className="sel-toolbar" style={{ position: "absolute", top: pendingSel.top, left: pendingSel.left }}>
              <button
                onClick={() => {
                  actions.askCopilotFromSelection(pendingSel.blockId, pendingSel.text);
                  setPendingSel(null);
                }}
              >
                <Icon name="auto_awesome" />
                {t("Ask Copilot")}
              </button>
              {(["rewrite", "shorten", "clarify"] as const).map((kind) => (
                <button
                  key={kind}
                  onClick={() => {
                    actions.quickAction(pendingSel.blockId, pendingSel.text, kind);
                    setPendingSel(null);
                  }}
                >
                  <Icon name={kind === "rewrite" ? "edit" : kind === "shorten" ? "short_text" : "lightbulb"} />
                  {t(kind.charAt(0).toUpperCase() + kind.slice(1))}
                </button>
              ))}
              <button
                onClick={() => {
                  actions.addCommentFromSelection(pendingSel.blockId, pendingSel.text);
                  setPendingSel(null);
                }}
              >
                <Icon name="add_comment" />
                {t("Comment")}
              </button>
            </div>
          )}
        </div>

        <SidePanel jobId={jobId} audience={audience} />
      </div>
    </>
  );
}

/** Converts simple inline HTML (only `<strong>`/`<b>`/`<em>`/`<i>` are recognized — anything else is
 * unwrapped to its text) produced by `RichBlockEditor` into React elements, instead of using
 * `dangerouslySetInnerHTML`. Falls back to returning the string as-is when there's no tag, which is the
 * common case for content that was never rich-edited. */
function renderInlineHtml(html: string): ReactNode {
  if (!/<[a-z]/i.test(html)) return html;
  const parsed = new DOMParser().parseFromString(html, "text/html");
  const convert = (node: ChildNode): ReactNode => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent;
    if (node.nodeType !== Node.ELEMENT_NODE) return null;
    const el = node as HTMLElement;
    const children = Array.from(el.childNodes).map((child, i) => <Fragment key={i}>{convert(child)}</Fragment>);
    const tag = el.tagName.toLowerCase();
    if (tag === "strong" || tag === "b") return <strong>{children}</strong>;
    if (tag === "em" || tag === "i") return <em>{children}</em>;
    return <>{children}</>;
  };
  return Array.from(parsed.body.childNodes).map((node, i) => <Fragment key={i}>{convert(node)}</Fragment>);
}

/* ---------------------------------------------------------------
   One document block, with inline suggestion marks and comment anchors.
   --------------------------------------------------------------- */
function DocBlockView({
  block,
  jobId,
  audience,
  editable,
  isActive,
  onTextChange,
  onFocusBlock,
  onEditorReady,
  onEditorDestroy,
  onActivity,
}: {
  block: DocBlock;
  jobId: string;
  audience: Audience;
  editable: boolean;
  isActive: boolean;
  onTextChange: (text: string | string[]) => void;
  onFocusBlock: () => void;
  onEditorReady: (editor: Editor) => void;
  onEditorDestroy: () => void;
  onActivity: () => void;
}) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId, audience);
  const suggestions = pendingSuggestionsFor(state, jobId, audience, block.id);
  const threads = selectThreads(state, jobId, audience).filter((x) => x.anchorBlock === block.id);
  const openThreadCount = threads.filter((x) => x.status === "open").length;
  const hasStale = selectSuggestions(state, jobId, audience).some(
    (s) => s.status === "stale" && s.anchorBlock === block.id,
  );

  const marked = (text: string) => {
    // Demo suggestions are always plain text matched against the block's stripped content — a block
    // that's been rich-edited (and so may contain `<strong>`/`<em>`) just won't match, same as today.
    const active = suggestions.find((s) => s.oldText && stripHtml(text).includes(s.oldText));
    if (!active) return renderInlineHtml(text);
    const plain = stripHtml(text);
    const [before, ...rest] = plain.split(active.oldText);
    return (
      <>
        {before}
        <span className="del">{active.oldText}</span>
        <span className="ins">{active.newText}</span>
        <span className={`mark-badge ${active.author === "ai" ? "ai" : "human"}`}>
          {active.author === "ai" ? "AI" : "Maya"}
        </span>
        {rest.join(active.oldText)}
      </>
    );
  };

  const richEditorProps = { onTextChange, onFocusBlock, onEditorReady, onEditorDestroy, onActivity };
  const richWrapClass = `rich-block-editor kind-${block.kind}${isActive ? " is-focused" : ""}`;

  return (
    <div className={`doc-block${openThreadCount > 0 ? " has-comment" : ""}`} data-block-id={block.id}>
      {block.kind === "h2" &&
        (editable ? (
          <div className={richWrapClass}>
            <RichBlockEditor block={block} {...richEditorProps} />
          </div>
        ) : (
          <h2 className="docH">{marked(block.text as string)}</h2>
        ))}
      {block.kind === "h3" &&
        (editable ? (
          <div className={richWrapClass}>
            <RichBlockEditor block={block} {...richEditorProps} />
          </div>
        ) : (
          <h3 className="docH3">{marked(block.text as string)}</h3>
        ))}
      {block.kind === "p" &&
        (editable ? (
          <div className={richWrapClass}>
            <RichBlockEditor block={block} {...richEditorProps} />
          </div>
        ) : (
          <p className={`docP${block.role === "requirement" ? "" : " presentation-only"}`}>{marked(block.text as string)}</p>
        ))}
      {block.kind === "ul" &&
        (editable ? (
          <div className={richWrapClass}>
            <RichBlockEditor block={block} {...richEditorProps} />
          </div>
        ) : (
          <ul className="docList">
            {(block.text as string[]).map((x, i) => (
              <li key={i}>{marked(x)}</li>
            ))}
          </ul>
        ))}
      {openThreadCount > 0 && (
        <span
          className="comment-anchor"
          title={`${openThreadCount} ${t("comment(s)")}`}
          onClick={() => actions.openCommentsFor(block.id)}
        >
          {openThreadCount}
        </span>
      )}
      {hasStale && (
        <span className="stale-flag">
          <Icon name="restore" size={11} />
          {t("Needs refresh")}
        </span>
      )}
    </div>
  );
}
