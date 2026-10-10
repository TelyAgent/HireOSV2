import { Fragment, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Dropdown } from "antd";
import { Icon } from "../../components/ui/Icons";
import { Button } from "../../components/ui/Primitives";
import { useStore } from "../../store/StoreContext";
import {
  BLOCK_LEVELS,
  BLOCK_LEVEL_KEYS,
  DOC_AUDIENCE,
  blockLevel,
  buildDraftFromBackend,
  docKey,
  ensureDraft,
  groupSections,
  normalizeBlocks,
  pendingSuggestionsFor,
  sectionBlockIds,
  selectDraft,
  selectSuggestions,
  stripHtml,
} from "./docHelpers";
import { BLOCK_DRAG_MIME, RichBlockEditor } from "./RichBlockEditor";
import { getCurrentDraft, getJobDocument, listSuggestions } from "./documentsApi";
import { getPerson } from "../../data/fixtures/people";
import { updateJobFields } from "../jobs/jobsApi";
import { coreJobToLocalJob } from "../jobs/jobsMapping";
import { SidePanel } from "./SidePanel";
import { JobMetaFields } from "./JobMetaFields";
import { useDocActions } from "./docActions";
import { useCompleteness } from "./useCompleteness";
import { useDocumentSaver } from "./useDocumentSaver";
import { issueCount, sectionRank, type ComplianceFlag, type Evaluation, type ReqRow } from "./completeness";
import type { BlockLevel, DocBlock, Suggestion } from "../../data/types";

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

/** What is being dragged: one block, or a whole section (its heading plus everything under it). */
interface DragState {
  type: "block" | "section";
  ids: string[];
}
interface DropTarget {
  id: string;
  after: boolean;
}

export function DocumentTab({ jobId }: { jobId: string }) {
  const { state, t, set, mutate, say } = useStore();
  const draft = selectDraft(state, jobId);
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  // Bumped whenever the document is replaced wholesale (loaded from the backend), so the per-block
  // editors — which only read their content on mount — remount with the new text.
  const [docEpoch, setDocEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const docRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [pendingSel, setPendingSel] = useState<PendingSel | null>(null);
  const actions = useDocActions(jobId);

  const editorsRef = useRef(new Map<string, Editor>());
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  // A block created by Enter / "Add block" gets focus as soon as its editor mounts.
  const pendingFocus = useRef<{ id: string; at: "start" | "end" } | null>(null);
  const focusBlock = (id: string, at: "start" | "end") => {
    const editor = editorsRef.current.get(id);
    if (editor) editor.commands.focus(at);
    else pendingFocus.current = { id, at };
  };

  const dragRef = useRef<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  useEffect(() => setPendingSel(null), [jobId]);
  useEffect(() => setActiveBlockId(null), [jobId]);
  // Mirror the focused block into the store so the Copilot panel can act on it without a selection.
  useEffect(() => set({ wsFocusBlockId: activeBlockId }), [activeBlockId, set]);
  // "Fill in" from the Analysis panel asks for a block to be focused.
  const focusRequest = state.wsFocusRequest;
  useEffect(() => {
    if (!focusRequest) return;
    focusBlock(focusRequest.blockId, "start");
    // Scroll after the block has rendered.
    setTimeout(() => document.querySelector(`.doc-block[data-block-id="${focusRequest.blockId}"]`)?.scrollIntoView({ block: "center" }), 50);
  }, [focusRequest]);
  const ev = useCompleteness(jobId);

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
      const saved = await getJobDocument(jobId, DOC_AUDIENCE);
      if (cancelled) return;
      if (saved) {
        mutate((d) => {
          const blocks = normalizeBlocks(saved.blocks);
          d.drafts[docKey(jobId)] = {
            ...ensureDraft(d, jobId),
            blocks,
            meta: saved.meta ?? undefined,
            serverRevision: saved.revision,
            // Documents saved before per-block visibility get migrated here; save that once.
            saveState: blocks === saved.blocks ? "saved" : "dirty",
          };
        });
      } else {
        const content = await getCurrentDraft(jobId);
        if (cancelled || !content) return;
        mutate((d) => {
          const title = d.jobs[jobId]?.title ?? "";
          d.drafts[docKey(jobId)] = buildDraftFromBackend(title, content, jobId);
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
  }, [jobId]);

  // Suggestions live server-side so they survive reloads and are shared with the team.
  useEffect(() => {
    let cancelled = false;
    listSuggestions(jobId, DOC_AUDIENCE)
      .then((list) => {
        if (cancelled) return;
        mutate((d) => {
          d.suggestions[docKey(jobId)] = list;
        });
      })
      .catch((error) => console.warn("Failed to load document suggestions:", error));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  const isDirty = draft.saveState === "dirty";
  const saveDocument = useDocumentSaver(jobId);

  // Cmd/Ctrl+S saves; leaving the page with unsaved edits asks first.
  const saveRef = useRef(saveDocument);
  saveRef.current = saveDocument;
  // Accepting a suggestion asks for an immediate save (see `acceptSuggestion`).
  const handledSaveRequest = useRef(state.wsSaveRequest);
  useEffect(() => {
    if (state.wsSaveRequest === handledSaveRequest.current) return;
    handledSaveRequest.current = state.wsSaveRequest;
    if (latestDraft.current.saveState === "dirty") void saveRef.current();
  }, [state.wsSaveRequest]);
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

  // The document's title heading is the job title: editing it renames the job (debounced).
  const titleTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(titleTimer.current), []);
  const syncJobTitle = (text: string) => {
    window.clearTimeout(titleTimer.current);
    const title = stripHtml(text).replace(/\s+/g, " ").trim();
    if (!title || title === state.jobs[jobId]?.title) return;
    titleTimer.current = window.setTimeout(async () => {
      try {
        const updated = await updateJobFields(jobId, { title });
        mutate((d) => {
          const j = d.jobs[jobId];
          if (j) d.jobs = { ...d.jobs, [jobId]: { ...coreJobToLocalJob(updated, j), title } };
        });
      } catch (error) {
        say(error instanceof Error ? error.message : t("Couldn't rename the job. Please try again."), { type: "error" });
      }
    }, 800);
  };

  const commitBlockText = (blockId: string, text: string | string[]) => {
    const first = latestDraft.current.blocks[0];
    if (first?.id === blockId && first.kind === "h2" && typeof text === "string") syncJobTitle(text);
    mutate((d) => {
      const doc = ensureDraft(d, jobId);
      const block = doc.blocks.find((b) => b.id === blockId);
      if (!block) return;
      block.text = text;
      // Editing an AI-written block counts as reviewing it.
      block.aiDraft = false;
      doc.revision++;
      if (doc.saveState !== "saving") doc.saveState = "dirty";
    });
  };

  const onMouseUp = () => {
    // Let the browser finish updating the selection before reading it.
    setTimeout(() => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      if (!txt || txt.length < 2) return setPendingSel(null);
      const doc = docRef.current;
      if (!sel || !sel.rangeCount || !doc || !sel.getRangeAt(0).intersectsNode(doc)) return setPendingSel(null);
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const wrapRect = wrap.getBoundingClientRect();
      const { blockId, text } = selectionInBlock(doc, range, txt);
      // Confidential content never goes to Copilot (completeness standard V5).
      const block = blockId ? latestDraft.current.blocks.find((b) => b.id === blockId) : undefined;
      if (block && blockLevel(block) === "confidential") return setPendingSel(null);
      setPendingSel({
        text,
        blockId,
        top: Math.max(4, rect.top - wrapRect.top - 44 + wrap.scrollTop),
        left: Math.max(0, rect.left - wrapRect.left),
      });
    }, 5);
  };

  /* ---------------- drag & drop ---------------- */
  const startDrag = (e: DragEvent, blockId: string, isHead: boolean) => {
    const ids = isHead ? sectionBlockIds(latestDraft.current.blocks, blockId) : [blockId];
    dragRef.current = { type: isHead ? "section" : "block", ids };
    e.dataTransfer.effectAllowed = "move";
    // A private type (not text/plain), so dropping onto an editor never pastes the id as text.
    e.dataTransfer.setData(BLOCK_DRAG_MIME, blockId);
    const el = (e.target as HTMLElement).closest(isHead ? ".doc-section" : ".doc-block");
    if (el) e.dataTransfer.setDragImage(el, 24, 16);
  };
  const dropTargetFrom = (e: DragEvent): DropTarget | null => {
    const drag = dragRef.current;
    if (!drag) return null;
    const target = e.target as HTMLElement;
    if (drag.type === "section") {
      const el = target.closest<HTMLElement>(".doc-section");
      const id = el?.dataset.sectionId;
      if (!el || !id || drag.ids.includes(id)) return null;
      const r = el.getBoundingClientRect();
      return { id, after: e.clientY - r.top > r.height / 2 };
    }
    const el = target.closest<HTMLElement>(".doc-block");
    const id = el?.dataset.blockId;
    if (!el || !id || drag.ids.includes(id)) return null;
    const r = el.getBoundingClientRect();
    // Dropping on a heading puts the block at the top of that section.
    return { id, after: el.classList.contains("sec-head") || e.clientY - r.top > r.height / 2 };
  };
  const onDragOver = (e: DragEvent) => {
    const target = dropTargetFrom(e);
    if (!target) return setDropTarget(null);
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (target.id !== dropTarget?.id || target.after !== dropTarget?.after) setDropTarget(target);
  };
  const endDrag = () => {
    dragRef.current = null;
    setDropTarget(null);
  };
  const onDrop = (e: DragEvent) => {
    const drag = dragRef.current;
    const target = dropTargetFrom(e);
    endDrag();
    if (!drag || !target) return;
    e.preventDefault();
    if (drag.type === "section") {
      // Drop before a section's heading, or after its last block.
      const targetIds = sectionBlockIds(latestDraft.current.blocks, target.id);
      actions.moveBlocks(drag.ids, target.after ? targetIds[targetIds.length - 1] : targetIds[0], target.after);
    } else {
      actions.moveBlocks(drag.ids, target.id, target.after);
    }
  };

  // Use the evaluation's own sections so its rows can be matched to them by identity.
  const sections = ev?.sections ?? groupSections(draft.blocks);
  // Missing required sections show as placeholders where they would go in the default section order.
  const slotsBefore = new Map<number, ReqRow[]>();
  ev?.rows
    .filter((r) => !r.ok && r.item.heading && !r.section)
    .forEach((r) => {
      const rank = sectionRank(r.item.heading!.en);
      let at = sections.length;
      for (let i = 1; i < sections.length; i++) {
        const head = sections[i].head;
        if (head && sectionRank(stripHtml(head.text as string)) > rank) {
          at = i;
          break;
        }
      }
      slotsBefore.set(at, [...(slotsBefore.get(at) ?? []), r]);
    });
  const levelCounts = BLOCK_LEVEL_KEYS.map((k) => ({ level: k, count: draft.blocks.filter((b) => blockLevel(b) === k).length }));

  const renderBlock = (b: DocBlock, isHead: boolean) => (
    <DocBlockView
      key={b.id}
      block={b}
      jobId={jobId}
      isHead={isHead}
      isActive={activeBlockId === b.id}
      flags={ev?.flags.filter((f) => f.blockId === b.id) ?? []}
      drop={dropTarget?.id === b.id && dragRef.current?.type === "block" ? (dropTarget.after ? "after" : "before") : null}
      onDragStart={(e) => startDrag(e, b.id, isHead)}
      onDragEnd={endDrag}
      onTextChange={(text) => commitBlockText(b.id, text)}
      onFocusBlock={() => setActiveBlockId(b.id)}
      onEditorReady={(editor) => {
        editorsRef.current.set(b.id, editor);
        if (pendingFocus.current?.id === b.id) {
          const at = pendingFocus.current.at;
          pendingFocus.current = null;
          // Let the editor finish mounting into the DOM first.
          setTimeout(() => editor.commands.focus(at), 0);
        }
      }}
      onEditorDestroy={() => editorsRef.current.delete(b.id)}
      onSplit={(before, after) => focusBlock(actions.splitBullet(b.id, before, after), "start")}
      onRemoveEmpty={() => {
        const prev = actions.removeEmptyBlock(b.id);
        if (prev) focusBlock(prev, "end");
      }}
    />
  );

  return (
    <>
      <div className="jw-toolbar">
        <div className="lvl-legend">
          {levelCounts.map(({ level, count }) => (
            <span key={level} className={`lvl-tag lvl-${level} static`} title={t(BLOCK_LEVELS[level].hint)}>
              <Icon name={BLOCK_LEVELS[level].icon} />
              {t(BLOCK_LEVELS[level].label)}
              <b>{count}</b>
            </span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        {state.wsAiUndo?.jobId === jobId && (
          <span className="ai-undo">
            <Icon name="auto_awesome" />
            {t("Copilot updated")} “{t(state.wsAiUndo.label)}”
            <button type="button" className="req-link" onClick={() => actions.undoAi()}>
              {t("Undo")}
            </button>
            <button type="button" className="ai-undo-x" title={t("Dismiss")} onClick={() => actions.dismissAiUndo()}>
              <Icon name="close" />
            </button>
          </span>
        )}
        {ev && <AnalyzeButton ev={ev} busy={!!state.wsAiBusy[`${jobId}:analyze`]} onClick={() => actions.analyze()} />}
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
        <div className="jw-doc-wrap" ref={wrapRef}>
          <div
            className="jw-doc"
            ref={docRef}
            onMouseUp={onMouseUp}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
            }}
            key={docEpoch}
          >
            {sections.map((sec, si) => {
              const sectionDrop =
                sec.head && dropTarget?.id === sec.head.id && dragRef.current?.type === "section"
                  ? dropTarget.after
                    ? " drop-after"
                    : " drop-before"
                  : "";
              return (
                <Fragment key={sec.head?.id ?? "__lead"}>
                {(slotsBefore.get(si) ?? []).map((r) => (
                  <MissingSlot
                    key={r.item.id}
                    row={r}
                    busy={!!state.wsAiBusy[`${jobId}:${r.item.id}`]}
                    onAi={r.item.noAi ? undefined : () => actions.aiDraft(r.item)}
                    onFill={() => (r.item.id === "F1" ? actions.openSalaryForm() : actions.fillRequired(r.item))}
                  />
                ))}
                <section
                  className={`doc-section${sec.head ? "" : " headless"}${sectionDrop}`}
                  data-section-id={sec.head?.id ?? "__lead"}
                >
                  {sec.head && renderBlock(sec.head, true)}
                  {si === 0 && <JobMetaFields jobId={jobId} ev={ev} />}
                  {sec.blocks.map((b) => renderBlock(b, false))}
                  {ev?.rows
                    .filter((r) => r.section === sec && r.ok && r.weak)
                    .map((r) => (
                      <WeakBar
                        key={r.item.id}
                        row={r}
                        busy={!!state.wsAiBusy[`${jobId}:${r.item.id}`]}
                        onAi={r.item.heading && !r.item.noAi ? () => actions.aiFix(r) : undefined}
                        onFormat={r.item.id === "F1" ? () => actions.openSalaryForm() : undefined}
                      />
                    ))}
                  {ev?.rows
                    .filter((r) => r.section === sec && !r.ok)
                    .map((r) => (
                      <MissingSlot
                    key={r.item.id}
                    row={r}
                    busy={!!state.wsAiBusy[`${jobId}:${r.item.id}`]}
                    onAi={r.item.noAi ? undefined : () => actions.aiDraft(r.item)}
                    onFill={() => (r.item.id === "F1" ? actions.openSalaryForm() : actions.fillRequired(r.item))}
                  />
                    ))}
                  <AddBlockButton
                    onAdd={(kind) => focusBlock(actions.addBlock(sec.head?.id ?? null, kind), "start")}
                  />
                </section>
                </Fragment>
              );
            })}
            {(slotsBefore.get(sections.length) ?? []).map((r) => (
              <MissingSlot
                    key={r.item.id}
                    row={r}
                    busy={!!state.wsAiBusy[`${jobId}:${r.item.id}`]}
                    onAi={r.item.noAi ? undefined : () => actions.aiDraft(r.item)}
                    onFill={() => (r.item.id === "F1" ? actions.openSalaryForm() : actions.fillRequired(r.item))}
                  />
            ))}
            <button type="button" className="blk-add" onClick={() => focusBlock(actions.addSection(), "start")}>
              <Icon name="add" />
              {t("Add section")}
            </button>
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
            </div>
          )}
        </div>

        <SidePanel jobId={jobId} />
      </div>
    </>
  );
}

function AddBlockButton({ onAdd }: { onAdd: (kind: "p" | "ul") => void }) {
  const { t } = useStore();
  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items: [
          { key: "p", label: t("Paragraph"), icon: <Icon name="notes" size={16} /> },
          { key: "ul", label: t("Bullet point"), icon: <Icon name="format_list_bulleted" size={16} /> },
        ],
        onClick: ({ key }) => onAdd(key as "p" | "ul"),
      }}
    >
      <button type="button" className="sec-add">
        <Icon name="add" />
        {t("Add block")}
      </button>
    </Dropdown>
  );
}

function LevelTag({ level, onChange }: { level: BlockLevel; onChange: (level: BlockLevel) => void }) {
  const { t } = useStore();
  return (
    <Dropdown
      trigger={["click"]}
      placement="bottomRight"
      menu={{
        selectedKeys: [level],
        items: [
          { type: "group", label: t("Content visibility") },
          ...BLOCK_LEVEL_KEYS.map((k) => ({
            key: k,
            label: (
              <span className="lvl-menu-item">
                <span className="lvl-menu-label">{t(BLOCK_LEVELS[k].label)}</span>
                <span className="lvl-menu-hint">{t(BLOCK_LEVELS[k].hint)}</span>
              </span>
            ),
            icon: <Icon name={BLOCK_LEVELS[k].icon} size={18} className={`lvl-${k} lvl-menu-icon`} />,
          })),
        ],
        onClick: ({ key }) => onChange(key as BlockLevel),
      }}
    >
      <button type="button" className={`lvl-tag lvl-${level}`} title={t("Change visibility")}>
        <Icon name={BLOCK_LEVELS[level].icon} />
        {t(BLOCK_LEVELS[level].label)}
        <Icon name="expand_more" className="lvl-caret" />
      </button>
    </Dropdown>
  );
}

function AnalyzeButton({ ev, busy, onClick }: { ev: Evaluation; busy: boolean; onClick: () => void }) {
  const { t } = useStore();
  const n = issueCount(ev);
  const kind = ev.missing || ev.blockers ? "bad" : ev.weakCount ? "warn" : "ok";
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm js-analyze"
      disabled={busy}
      onClick={onClick}
      title={t("Check this JD against the completeness standard")}
    >
      <Icon name={busy ? "autorenew" : "auto_awesome"} className={busy ? "req-spin" : undefined} />
      {busy ? t("Analyzing…") : t("Analyze")}
      <span className={`an-badge ${kind}`}>{n ? n : <Icon name="check" />}</span>
    </button>
  );
}

/** Placeholder for a required item that has no content yet. */
function MissingSlot({ row, onFill, onAi, busy }: { row: ReqRow; onFill: () => void; onAi?: () => void; busy: boolean }) {
  const { t } = useStore();
  const level = row.item.level ?? "public";
  return (
    <div className="req-slot" data-req={row.item.id}>
      <Icon name="error" className="req-ic" />
      <div className="req-slot-txt">
        <div className="req-slot-t">
          {t(row.item.label)}
          <span className="req-pill">{t("Required")}</span>
          <span className={`lvl-tag lvl-${level} static`}>
            <Icon name={BLOCK_LEVELS[level].icon} />
            {t(BLOCK_LEVELS[level].label)}
          </span>
        </div>
        <div className="req-slot-h">{t(row.item.hint)}</div>
      </div>
      {onAi && (
        <button type="button" className="req-fill req-ai" disabled={busy} onClick={onAi}>
          <Icon name={busy ? "autorenew" : "auto_awesome"} className={busy ? "req-spin" : undefined} />
          {busy ? t("Drafting…") : t("AI draft")}
        </button>
      )}
      <button type="button" className="req-fill" onClick={onFill}>
        <Icon name="edit" />
        {t("Fill in")}
      </button>
    </div>
  );
}

/** A required item that is filled in but hits a known defect ("Needs revision"). */
function WeakBar({ row, onAi, onFormat, busy }: { row: ReqRow; onAi?: () => void; onFormat?: () => void; busy: boolean }) {
  const { t } = useStore();
  return (
    <div className="req-weak" data-req={row.item.id}>
      <Icon name="warning" className="req-ic" />
      <div>
        <div className="req-slot-t">
          {t(row.item.label)}
          <span className="req-pill warn">{t("Needs revision")}</span>
        </div>
        <div className="req-slot-h">{t(row.weak)}</div>
      </div>
      {onAi && (
        <button type="button" className="req-fill req-ai" disabled={busy} onClick={onAi}>
          <Icon name={busy ? "autorenew" : "auto_awesome"} className={busy ? "req-spin" : undefined} />
          {busy ? t("Revising…") : t("AI fix")}
        </button>
      )}
      {onFormat && (
        <button type="button" className="req-fill" onClick={onFormat}>
          <Icon name="edit_note" />
          {t("Fill in by format")}
        </button>
      )}
    </div>
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

const PLACEHOLDERS: Record<string, string> = {
  h2: "Section title",
  p: "Write a paragraph…",
  ul: "Write a bullet point…",
};

/* ---------------------------------------------------------------
   One document block: drag handle, content, delete, visibility tag.
   --------------------------------------------------------------- */
function DocBlockView({
  block,
  jobId,
  isHead,
  isActive,
  flags,
  drop,
  onDragStart,
  onDragEnd,
  onTextChange,
  onFocusBlock,
  onEditorReady,
  onEditorDestroy,
  onSplit,
  onRemoveEmpty,
}: {
  block: DocBlock;
  jobId: string;
  isHead: boolean;
  isActive: boolean;
  flags: ComplianceFlag[];
  drop: "before" | "after" | null;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onTextChange: (text: string | string[]) => void;
  onFocusBlock: () => void;
  onEditorReady: (editor: Editor) => void;
  onEditorDestroy: () => void;
  onSplit: (before: string, after: string) => void;
  onRemoveEmpty: () => void;
}) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId);
  const suggestions = pendingSuggestionsFor(state, jobId, block.id);
  const hasStale = selectSuggestions(state, jobId).some((s) => s.status === "stale" && s.anchorBlock === block.id);
  const level = blockLevel(block);

  // A block with a pending Copilot proposal shows the proposal inline and is edited by accepting /
  // rejecting it (in the Copilot panel) rather than by typing.
  const active = suggestions[0];
  const badge = active ? <SuggestionBadge s={active} onClick={() => actions.setSideTab("copilot")} /> : null;
  const markedText = (text: string) => (active ? markFragment(text, active, badge) : renderInlineHtml(text));

  let body: ReactNode;
  if (!active) {
    body = (
      <div className={`rich-block-editor kind-${block.kind}${isActive ? " is-focused" : ""}`}>
        <RichBlockEditor
          block={block}
          placeholder={t(PLACEHOLDERS[block.kind] ?? "")}
          onTextChange={onTextChange}
          onFocusBlock={onFocusBlock}
          onEditorReady={onEditorReady}
          onEditorDestroy={onEditorDestroy}
          onActivity={() => undefined}
          onSplit={block.kind === "ul" ? onSplit : undefined}
          onRemoveEmpty={isHead ? undefined : onRemoveEmpty}
        />
      </div>
    );
  } else if (block.kind === "h2") body = <h2 className="docH">{markedText(block.text as string)}</h2>;
  else if (block.kind === "h3") body = <h3 className="docH3">{markedText(block.text as string)}</h3>;
  else if (block.kind === "p") body = <p className="docP">{markedText(block.text as string)}</p>;
  else body = <ul className="docList">{renderListItems(block.text as string[], active, badge)}</ul>;

  return (
    <div
      className={`doc-block kind-${block.kind}${isHead ? " sec-head" : ""} lvl-${level}${drop ? ` drop-${drop}` : ""}${flags.some((f) => f.severity === "blocker") ? " has-blocker" : ""}`}
      data-block-id={block.id}
    >
      <span
        className="blk-handle"
        draggable
        title={isHead ? t("Drag to move this section") : t("Drag to reorder")}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <Icon name="drag_indicator" />
      </span>
      <div className="blk-body">
        {body}
        {block.aiDraft && (
          <button type="button" className="ai-draft-pill" title={t("Written by Copilot — click to keep as is")} onClick={() => actions.keepAiDraft(block.id)}>
            <Icon name="auto_awesome" />
            {t("AI draft")}
            <Icon name="check" />
          </button>
        )}
        {flags.map((f) => (
          <div key={f.rule} className={`blk-flag ${f.severity}`}>
            <Icon name={f.severity === "blocker" ? "block" : "warning"} />
            <span>{t(f.message)}</span>
            {f.shouldBe && (
              <button type="button" className="req-link" onClick={() => actions.fixVisibility(block.id, f.shouldBe!)}>
                {t("Mark Confidential")}
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="blk-del"
        title={isHead ? t("Delete section") : t("Delete block")}
        onClick={() => (isHead ? actions.deleteSection(block.id) : actions.deleteBlock(block.id))}
      >
        <Icon name="delete_outline" />
      </button>
      <LevelTag level={level} onChange={(next) => actions.setBlockLevel(block.id, next)} />
      {hasStale && (
        <span className="stale-flag">
          <Icon name="restore" size={11} />
          {t("Needs refresh")}
        </span>
      )}
    </div>
  );
}

/**
 * Resolves which document block a selection belongs to. Reading only `anchorNode` misses selections
 * that start on a container element (e.g. dragging from the margin), so this takes the first block the
 * range actually intersects. A selection spanning several blocks is clipped to that first block, since
 * a suggestion always targets exactly one block.
 */
function selectionInBlock(root: HTMLElement, range: Range, fallbackText: string): { blockId: string | null; text: string } {
  const blocks = Array.from(root.querySelectorAll<HTMLElement>(".doc-block"));
  const hit = blocks.filter((el) => range.intersectsNode(el) && rangeTextIn(range, el) !== "");
  const first = hit[0];
  if (!first) return { blockId: null, text: fallbackText };
  const blockId = first.getAttribute("data-block-id");
  if (hit.length === 1) return { blockId, text: fallbackText };
  return { blockId, text: rangeTextIn(range, first) || fallbackText };
}

function rangeTextIn(range: Range, el: HTMLElement): string {
  const clipped = range.cloneRange();
  const bounds = document.createRange();
  bounds.selectNodeContents(el);
  if (clipped.compareBoundaryPoints(Range.START_TO_START, bounds) < 0) clipped.setStart(bounds.startContainer, bounds.startOffset);
  if (clipped.compareBoundaryPoints(Range.END_TO_END, bounds) > 0) clipped.setEnd(bounds.endContainer, bounds.endOffset);
  return clipped.toString().trim();
}

function SuggestionBadge({ s, onClick }: { s: Suggestion; onClick: () => void }) {
  const { t } = useStore();
  const name = s.author === "ai" ? "AI" : (getPerson(s.initiatedBy)?.name ?? t("Suggestion"));
  return (
    <span
      className={`mark-badge ${s.author === "ai" ? "ai" : "human"}`}
      title={t("Review in Copilot")}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {name}
    </span>
  );
}

/** Splits `a` → `b` into shared prefix, removed middle, inserted middle and shared suffix. */
function diffMiddle(a: string, b: string) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  return { prefix: a.slice(0, p), del: a.slice(p, a.length - q), ins: b.slice(p, b.length - q), suffix: a.slice(a.length - q) };
}

function renderDiff(oldText: string, newText: string, badge: ReactNode) {
  const d = diffMiddle(oldText, newText);
  return (
    <>
      {d.prefix}
      {d.del && <span className="del">{d.del}</span>}
      {d.ins && <span className="ins">{d.ins}</span>}
      {badge}
      {d.suffix}
    </>
  );
}

/** Marks a fragment suggestion inside one paragraph / heading / list item, or returns the plain text. */
function markFragment(text: string, s: Suggestion, badge: ReactNode): ReactNode {
  const plain = stripHtml(text);
  const idx = s.oldText ? plain.indexOf(s.oldText) : -1;
  if (idx < 0) return renderInlineHtml(text);
  return (
    <>
      {plain.slice(0, idx)}
      {renderDiff(s.oldText, stripHtml(s.newText), badge)}
      {plain.slice(idx + s.oldText.length)}
    </>
  );
}

function renderListItems(items: string[], s: Suggestion | undefined, badge: ReactNode): ReactNode {
  if (!s) return items.map((x, i) => <li key={i}>{renderInlineHtml(x)}</li>);
  if (!s.newItems) {
    const hit = items.findIndex((x) => stripHtml(x).includes(s.oldText));
    return items.map((x, i) => <li key={i}>{i === hit ? markFragment(x, s, badge) : renderInlineHtml(x)}</li>);
  }
  // A bullet rewritten into one or more bullets: old struck through, then the proposal.
  const next = s.newItems.map(stripHtml);
  if (next.length === 1 && items.length === 1) return <li>{renderDiff(stripHtml(items[0]), next[0], badge)}</li>;
  return (
    <>
      {items.map((x, i) => (
        <li key={`old-${i}`}>
          <span className="del">{stripHtml(x)}</span>
        </li>
      ))}
      {next.map((x, i) => (
        <li key={`new-${i}`}>
          <span className="ins">{x}</span>
          {i === next.length - 1 && badge}
        </li>
      ))}
    </>
  );
}
