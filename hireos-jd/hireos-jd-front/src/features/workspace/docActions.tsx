/**
 * Job document actions: block structure (add / delete / move / split / visibility) and the Copilot
 * side panel (AI rewrite suggestions and their accept / reject / refine lifecycle).
 */
import { useMemo, useState } from "react";
import { Input } from "antd";
import { Button } from "../../components/ui/Primitives";
import { CancelButton, ConfirmDialog, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { mkBlock } from "../../data/fixtures/documents";
import {
  BLOCK_LEVELS,
  DOC_AUDIENCE,
  buildDefaultDraft,
  blockLevel,
  blockPlainText,
  docKey,
  editDocCopy,
  groupSections,
  normalizeBlocks,
  sectionBlockIds,
  selectDraft,
  selectSuggestions,
  stripHtml,
} from "./docHelpers";
import {
  aiAnalyze,
  aiSection,
  createSuggestion,
  rewriteDocumentSelection,
  updateSuggestion,
  type AiBlock,
  type AiFinding,
  type NewSuggestion,
  type RewriteRequest,
} from "./documentsApi";
import { nowISO, uid } from "../../lib/format";
import { SalaryModal } from "./SalaryModal";
import {
  REQ_ITEMS,
  detectLanguage,
  filledBlocks,
  findSection,
  isFilled,
  sectionRank,
  type Evaluation,
  type ReqItem,
  type ReqRow,
} from "./completeness";
import type { BlockKind, BlockLevel, DocBlock, DocumentDraft, Suggestion } from "../../data/types";
import type { SideTab } from "../../store/types";

export function useDocActions(jobId: string) {
  const { state, t, set, mutate, say, openModal, closeModal } = useStore();
  const key = docKey(jobId);

  return useMemo(() => {
    const pushThreadMsg = (kind: "user" | "text", text: string) =>
      mutate((draft) => {
        draft.wsCopilotThread = [...draft.wsCopilotThread, { kind, text }];
      });

    /** Applies a structural change to the document and marks it unsaved. */
    const editDoc = (fn: (doc: DocumentDraft) => void) =>
      mutate((draft) => {
        editDocCopy(draft, jobId, (doc) => {
          fn(doc);
          doc.revision++;
          if (doc.saveState !== "saving") doc.saveState = "dirty";
        });
      });

    /** Writes a suggestion's status change to the backend first, then mirrors it into the store. */
    const persistSuggestion = async (id: string, patch: Parameters<typeof updateSuggestion>[3]) => {
      // Seeded demo suggestions (fixture ids like "sug-seed-1") were never stored server-side.
      if (isLocalOnlyId(id)) return true;
      try {
        await updateSuggestion(jobId, DOC_AUDIENCE, id, patch);
        return true;
      } catch (error) {
        say(error instanceof Error ? error.message : t("Couldn't update this suggestion. Please try again."), { type: "error" });
        return false;
      }
    };

    const setStoredSuggestion = (id: string, patch: Partial<Suggestion>) =>
      mutate((draft) => {
        draft.suggestions = {
          ...draft.suggestions,
          [key]: (draft.suggestions[key] ?? []).map((x) => (x.id === id ? { ...x, ...patch } : x)),
        };
      });

    const addSuggestion = async (body: NewSuggestion) => {
      const created = await createSuggestion(jobId, DOC_AUDIENCE, body);
      mutate((draft) => {
        draft.suggestions = { ...draft.suggestions, [key]: [...(draft.suggestions[key] ?? []), created] };
      });
      return created;
    };

    const setBusy = (what: string, busy: boolean) =>
      mutate((draft) => {
        draft.wsAiBusy = { ...draft.wsAiBusy, [`${jobId}:${what}`]: busy };
      });

    /** Applies an AI edit to the document; `undo` keeps the version before it for "Undo". */
    const applyAi = (label: string, fn: (doc: DocumentDraft) => void, undo = true) =>
      mutate((draft) => {
        if (undo) {
          const before = draft.drafts[key] ?? buildDefaultDraft(draft, jobId);
          draft.wsAiUndo = { jobId, blocks: before.blocks, label };
        }
        editDocCopy(draft, jobId, (doc) => {
          fn(doc);
          doc.blocks = normalizeBlocks(doc.blocks);
          doc.revision++;
          if (doc.saveState !== "saving") doc.saveState = "dirty";
        });
      });

    const aiContextOf = (blocks: DocBlock[]) => {
      const j = state.jobs[jobId];
      const val = (v: unknown) => (v == null || String(v).trim() === "" || String(v).trim() === "—" ? undefined : String(v));
      return {
        jobTitle: val(j?.title),
        level: val(j?.level),
        location: val(j?.location),
        department: val(j?.department),
        headcount: j?.headcount,
        language: detectLanguage(blocks) ?? undefined,
      };
    };

    /** AI draft for a missing (or suggested) section: replaces its empty blocks / creates the section. */
    const aiDraft = async (item: ReqItem, undo = true) => {
      if (!item.heading || item.noAi || state.wsAiBusy[`${jobId}:${item.id}`]) return false;
      const blocks = selectDraft(state, jobId).blocks;
      setBusy(item.id, true);
      try {
        const res = await aiSection(jobId, DOC_AUDIENCE, {
          mode: "draft",
          itemId: item.id,
          label: item.label,
          hint: item.hint,
          list: !!item.list,
          context: aiContextOf(blocks),
          blocks: aiBlocks(blocks),
        });
        const kind = item.list ? "ul" : "p";
        const level = item.level ?? "internal";
        const fresh = res.items.map((text) => ({ ...mkBlock(uid("nb"), kind, kind === "ul" ? [text] : text, { level }), aiDraft: true }));
        applyAi(
          item.label,
          (doc) => {
            const { sec } = findSection(groupSections(doc.blocks), item, doc.blocks);
            if (!sec) return insertSectionOrdered(doc, item, fresh);
            const empty = new Set(sec.blocks.filter((b) => !isFilled(blockPlainText(b).trim())).map((b) => b.id));
            doc.blocks = doc.blocks.filter((b) => !empty.has(b.id));
            const last = sec.blocks.filter((b) => !empty.has(b.id)).pop() ?? sec.head;
            const at = last ? doc.blocks.findIndex((b) => b.id === last.id) + 1 : 0;
            doc.blocks.splice(at, 0, ...fresh);
          },
          undo,
        );
        return true;
      } catch (error) {
        say(error instanceof Error ? error.message : t("Copilot couldn’t complete this. Please try again."), { type: "error" });
        return false;
      } finally {
        setBusy(item.id, false);
      }
    };

    /** AI fix for a section that fails a "Needs revision" rule: rewrites its content in place. */
    const aiFix = async (row: ReqRow, undo = true) => {
      const item = row.item;
      if (!item.heading || item.noAi || state.wsAiBusy[`${jobId}:${item.id}`]) return false;
      const blocks = selectDraft(state, jobId).blocks;
      const { sec } = findSection(groupSections(blocks), item, blocks);
      const current = filledBlocks(sec, item);
      if (!current.length) return aiDraft(item, undo);
      setBusy(item.id, true);
      try {
        const res = await aiSection(jobId, DOC_AUDIENCE, {
          mode: "fix",
          itemId: item.id,
          label: item.label,
          hint: item.hint,
          issue: row.weak,
          list: !!item.list,
          current: current.map((b) => blockPlainText(b)),
          context: aiContextOf(blocks),
          blocks: aiBlocks(blocks),
        });
        const ids = new Set(current.map((b) => b.id));
        const level = blockLevel(current[0]);
        const kind = item.list ? "ul" : "p";
        const fresh = res.items.map((text) => ({ ...mkBlock(uid("nb"), kind, kind === "ul" ? [text] : text, { level }), aiDraft: true }));
        applyAi(
          item.label,
          (doc) => {
            const at = doc.blocks.findIndex((b) => ids.has(b.id));
            if (at < 0) return;
            doc.blocks = doc.blocks.filter((b) => !ids.has(b.id));
            doc.blocks.splice(at, 0, ...fresh);
          },
          undo,
        );
        return true;
      } catch (error) {
        say(error instanceof Error ? error.message : t("Copilot couldn’t complete this. Please try again."), { type: "error" });
        return false;
      } finally {
        setBusy(item.id, false);
      }
    };

    const runAiAnalysis = async () => {
      if (state.wsAiBusy[`${jobId}:analyze`]) return;
      const doc = selectDraft(state, jobId);
      setBusy("analyze", true);
      try {
        const result = await aiAnalyze(jobId, DOC_AUDIENCE, { context: aiContextOf(doc.blocks), blocks: aiBlocks(doc.blocks) });
        mutate((draft) => {
          draft.wsAiAnalysis = { ...draft.wsAiAnalysis, [jobId]: { at: Date.now(), revision: doc.revision, result } };
        });
      } catch (error) {
        say(error instanceof Error ? error.message : t("Copilot couldn’t complete this. Please try again."), { type: "error" });
      } finally {
        setBusy("analyze", false);
      }
    };

    const generate = async (
      blockId: string | null,
      selText: string,
      action: RewriteRequest["action"],
      instruction?: string,
      supersedes?: string,
    ) => {
      const doc = selectDraft(state, jobId);
      const block = blockId ? doc.blocks.find((b) => b.id === blockId) : undefined;
      if (!block || !selText.trim()) {
        pushThreadMsg(
          "text",
          t("I don’t have anything to work on yet — select some text, or click into the paragraph or list you want changed, then ask again."),
        );
        return;
      }
      // Completeness standard V5: confidential content is never sent to AI.
      if (blockLevel(block) === "confidential") {
        pushThreadMsg("text", t("This block is Confidential — Copilot can’t read or rewrite it. Change its visibility first if that’s intended."));
        return;
      }
      if (state.wsCopilotBusy) return;

      const items = Array.isArray(block.text) ? block.text.map(stripHtml) : null;
      const selected = selText.trim();
      const scope: RewriteRequest["scope"] = items && !items.some((x) => x.includes(selected)) ? "items" : "fragment";
      const job = state.jobs[jobId];

      set({ wsCopilotBusy: true, wsSideTab: "copilot" });
      try {
        const result = await rewriteDocumentSelection(jobId, DOC_AUDIENCE, {
          selectedText: selected,
          instruction,
          action,
          target: items ? { kind: block.kind, items } : { kind: block.kind, text: stripHtml(block.text as string) },
          scope,
          context: {
            jobTitle: job?.title,
            department: job?.department,
            documentText: doc.blocks
              .filter((b) => blockLevel(b) !== "confidential")
              .map((b) => (b.kind === "ul" ? `- ${blockPlainText(b)}` : blockPlainText(b)))
              .join("\n"),
          },
        });
        const suggestion = await addSuggestion({
          anchorBlock: block.id,
          author: "ai",
          initiatedBy: state.currentUserId,
          instruction: instruction || action,
          oldText: scope === "items" ? items!.join("\n") : selected,
          newText: result.text,
          newItems: result.items,
          reason: result.reason,
          supersedes: supersedes ?? null,
        });
        mutate((draft) => {
          draft.wsCopilotThread = [...draft.wsCopilotThread, { kind: "suggestion", suggestion, explain: result.explain }];
          draft.wsSelection = null;
          draft.wsSideTab = "copilot";
        });
      } catch (error) {
        pushThreadMsg("text", error instanceof Error ? error.message : t("Copilot couldn’t generate a suggestion. Please try again."));
      } finally {
        set({ wsCopilotBusy: false });
      }
    };

    return {
      setSideTab(tab: SideTab) {
        set({ wsSideTab: tab });
      },

      clearSelection() {
        set({ wsSelection: null });
      },

      askCopilotFromSelection(blockId: string | null, text: string) {
        set({ wsSelection: { blockId, text, scopeLabel: "Selected text" }, wsSideTab: "copilot" });
      },

      quickAction(blockId: string | null, text: string, kind: "rewrite" | "shorten" | "clarify") {
        const label = { rewrite: "Rewrite this", shorten: "Shorten this", clarify: "Clarify this" }[kind];
        pushThreadMsg("user", t(label));
        void generate(blockId, text, kind);
      },

      sendCopilot(instruction: string) {
        if (!instruction.trim()) return;
        pushThreadMsg("user", instruction);
        const sel = state.wsSelection;
        if (sel) return void generate(sel.blockId, sel.text, "custom", instruction);
        // No selection: work on the whole block the cursor is in.
        const focused = state.wsFocusBlockId
          ? selectDraft(state, jobId).blocks.find((b) => b.id === state.wsFocusBlockId)
          : undefined;
        const text = focused ? (Array.isArray(focused.text) ? focused.text.map(stripHtml).join("\n") : stripHtml(focused.text)) : "";
        void generate(focused?.id ?? null, text, "custom", instruction);
      },

      /* ---------------- block structure ---------------- */

      setBlockLevel(blockId: string, level: BlockLevel) {
        const b = selectDraft(state, jobId).blocks.find((x) => x.id === blockId);
        if (!b || blockLevel(b) === level) return;
        editDoc((doc) => {
          const target = doc.blocks.find((x) => x.id === blockId);
          if (target) target.level = level;
        });
        say(`${t("Marked as")} ${t(BLOCK_LEVELS[level].label)}`);
      },

      /** Adds a paragraph or bullet at the end of a section (or the document); returns the new block's id. */
      addBlock(headId: string | null, kind: Extract<BlockKind, "p" | "ul">): string {
        const id = uid("nb");
        editDoc((doc) => {
          let at = doc.blocks.length;
          if (headId) {
            const i = doc.blocks.findIndex((b) => b.id === headId);
            if (i >= 0) {
              at = i + 1;
              while (at < doc.blocks.length && doc.blocks[at].kind !== "h2") at++;
            }
          }
          // New content inherits the section's visibility.
          const head = headId ? doc.blocks.find((b) => b.id === headId) : undefined;
          doc.blocks.splice(at, 0, mkBlock(id, kind, kind === "ul" ? [""] : "", { level: head ? blockLevel(head) : "internal" }));
        });
        return id;
      },

      /** Appends a new section (heading + empty paragraph); returns the heading's id. */
      addSection(): string {
        const id = uid("ns");
        editDoc((doc) => {
          doc.blocks.push(mkBlock(id, "h2", "", { level: "internal" }), mkBlock(uid("nb"), "p", "", { level: "internal" }));
        });
        return id;
      },

      deleteBlock(blockId: string) {
        editDoc((doc) => {
          doc.blocks = doc.blocks.filter((b) => b.id !== blockId);
        });
      },

      deleteSection(headId: string) {
        const ids = sectionBlockIds(selectDraft(state, jobId).blocks, headId);
        const n = ids.length - 1;
        openModal(
          <ConfirmDialog
            title={t("Delete this section?")}
            body={
              n
                ? `${t("This removes the section and its blocks from the draft.")} (${n})`
                : t("This removes the section from the draft.")
            }
            confirmLabel={t("Delete")}
            danger
            onConfirm={() =>
              editDoc((doc) => {
                doc.blocks = doc.blocks.filter((b) => !ids.includes(b.id));
              })
            }
          />,
        );
      },

      /** Moves blocks (one block, or a whole section) to just before / after `targetId`. */
      moveBlocks(ids: string[], targetId: string, after: boolean) {
        editDoc((doc) => {
          const moving = ids.map((id) => doc.blocks.find((b) => b.id === id)).filter((b): b is DocBlock => !!b);
          const rest = doc.blocks.filter((b) => !ids.includes(b.id));
          let at = rest.findIndex((b) => b.id === targetId);
          if (at < 0 || !moving.length) return;
          if (after) at++;
          rest.splice(at, 0, ...moving);
          doc.blocks = rest;
        });
      },

      /** Enter inside a bullet: the text after the cursor becomes a new bullet below; returns its id. */
      splitBullet(blockId: string, before: string, after: string): string {
        const id = uid("nb");
        editDoc((doc) => {
          const i = doc.blocks.findIndex((b) => b.id === blockId);
          if (i < 0) return;
          const b = doc.blocks[i];
          b.text = [before];
          doc.blocks.splice(i + 1, 0, mkBlock(id, "ul", [after], { level: blockLevel(b) }));
        });
        return id;
      },

      /** Backspace in an empty block: removes it; returns the id of the block above (to move focus there). */
      removeEmptyBlock(blockId: string): string | null {
        const blocks = selectDraft(state, jobId).blocks;
        const i = blocks.findIndex((b) => b.id === blockId);
        if (i <= 0) return null;
        editDoc((doc) => {
          doc.blocks = doc.blocks.filter((b) => b.id !== blockId);
        });
        return blocks[i - 1].id;
      },

      /* ---------------- completeness ---------------- */

      /** Analyze: refreshes the rule check, opens the Analysis tab and runs the AI review. */
      analyze() {
        set({ wsAnalyzedAt: { ...state.wsAnalyzedAt, [jobId]: Date.now() }, wsSideTab: "analysis" });
        void runAiAnalysis();
      },

      aiDraft(item: ReqItem) {
        void aiDraft(item).then((ok) => ok && say(`${t("Copilot drafted")} “${t(item.label)}” — ${t("review and edit.")}`, { type: "success" }));
      },

      aiFix(row: ReqRow) {
        void aiFix(row).then((ok) => ok && say(`${t("Copilot revised")} “${t(row.item.label)}” — ${t("review the change.")}`, { type: "success" }));
      },

      /** Drafts every missing content item and fixes every weak one, as one undoable change. */
      async aiFixAll(ev: Evaluation) {
        const todo = ev.rows.filter((r) => r.item.heading && !r.item.noAi && (!r.ok || r.weak));
        if (!todo.length || state.wsAiBusy[`${jobId}:all`]) return;
        setBusy("all", true);
        mutate((draft) => {
          const before = draft.drafts[key] ?? buildDefaultDraft(draft, jobId);
          draft.wsAiUndo = { jobId, blocks: before.blocks, label: t("Required items") };
        });
        let done = 0;
        // One at a time, so each result is written into the document as it stands after the previous one.
        for (const r of todo) if (await (r.ok ? aiFix(r, false) : aiDraft(r.item, false))) done++;
        setBusy("all", false);
        if (done) say(`${t("Copilot updated")} ${done} ${t("item(s) — review the changes.")}`, { type: "success" });
      },

      /** Replaces an AI finding's evidence with its suggested text. */
      applyFinding(f: AiFinding) {
        if (!f.blockId || !f.suggestion) return;
        // The review may predate later edits: only apply when the quoted text is still there.
        const target = selectDraft(state, jobId).blocks.find((x) => x.id === f.blockId);
        const stillThere = !!target && blockLevel(target) !== "confidential" && (!f.evidence || blockPlainText(target).includes(f.evidence));
        if (!stillThere) {
          return say(t("That text has changed since the review — run Analyze again."), { type: "error" });
        }
        applyAi(t("AI suggestion"), (doc) => {
          const b = doc.blocks.find((x) => x.id === f.blockId);
          if (!b) return;
          const current = blockPlainText(b);
          const next = f.evidence ? current.replace(f.evidence, f.suggestion) : f.suggestion;
          // A multi-line suggestion in a bullet becomes several bullets (normalizeBlocks splits them).
          b.text = b.kind === "ul" ? next.split(/\n+/).map((x) => x.trim()).filter(Boolean) : next.replace(/\s*\n+\s*/g, " ");
          b.aiDraft = true;
        });
        mutate((draft) => {
          const a = draft.wsAiAnalysis[jobId];
          if (!a) return;
          draft.wsAiAnalysis = { ...draft.wsAiAnalysis, [jobId]: { ...a, result: { ...a.result, items: a.result.items.filter((x) => x !== f) } } };
        });
      },

      /** Restores the document as it was before the last AI edit. */
      undoAi() {
        const snap = state.wsAiUndo;
        if (!snap || snap.jobId !== jobId) return;
        mutate((draft) => {
          editDocCopy(draft, jobId, (doc) => {
            doc.blocks = snap.blocks;
            doc.revision++;
            doc.saveState = "dirty";
          });
          draft.wsAiUndo = null;
        });
      },

      dismissAiUndo() {
        set({ wsAiUndo: null });
      },

      /** Accepts an AI-written block as is (removes its "AI draft" tag). */
      keepAiDraft(blockId: string) {
        editDoc((doc) => {
          const b = doc.blocks.find((x) => x.id === blockId);
          if (b) b.aiDraft = false;
        });
      },

      /** Puts the cursor on a title field (Location / Headcount / Level). */
      focusField(field: string) {
        const input = document.querySelector<HTMLInputElement>(`.jw-field[data-field="${field}"] input`);
        input?.scrollIntoView({ block: "center" });
        input?.focus();
      },

      /** Puts the cursor in a block (via the open document). */
      focusBlock(blockId: string) {
        set({ wsFocusRequest: { blockId, n: Date.now() } });
      },

      /** Scrolls to the section holding a content item. */
      goToSection(headId: string | null) {
        const el = document.querySelector(headId ? `.doc-block[data-block-id="${headId}"]` : ".jw-doc .doc-block");
        el?.scrollIntoView({ block: "start", behavior: "smooth" });
      },

      /**
       * "Fill in" for a missing content item: focuses an empty block in its section, adds one, or —
       * when the section doesn't exist — inserts it at its default position in the section order.
       */
      fillRequired(item: ReqItem) {
        if (!item.heading) return;
        const blocks = selectDraft(state, jobId).blocks;
        const { sec } = findSection(groupSections(blocks), item, blocks);
        const kind = item.list ? "ul" : "p";
        const level = item.level ?? "internal";
        let focusId = sec?.blocks.find((b) => !isFilled(blockPlainText(b).trim()))?.id;
        if (!focusId) {
          focusId = uid("nb");
          const newId = focusId;
          editDoc((doc) => {
            const body = mkBlock(newId, kind, kind === "ul" ? [""] : "", { level });
            if (sec) {
              const last = sec.blocks[sec.blocks.length - 1] ?? sec.head;
              const at = last ? doc.blocks.findIndex((b) => b.id === last.id) + 1 : 0;
              doc.blocks.splice(at, 0, body);
              return;
            }
            insertSectionOrdered(doc, item, [body]);
          });
        }
        set({ wsFocusRequest: { blockId: focusId, n: Date.now() } });
      },

      /**
       * Writes the public salary line (F1): replaces the first Public salary block in the
       * Compensation section, or adds one — creating the section if needed.
       */
      setSalaryLine(line: string) {
        const f1 = REQ_ITEMS.find((i) => i.id === "F1")!;
        const newId = uid("nb");
        editDoc((doc) => {
          const { sec } = findSection(groupSections(doc.blocks), f1, doc.blocks);
          const target = sec?.blocks.find((b) => blockLevel(b) === "public" && b.kind !== "h2");
          if (target) {
            target.text = target.kind === "ul" ? [line] : line;
            return;
          }
          const block = mkBlock(newId, "p", line, { level: "public" });
          if (!sec) return insertSectionOrdered(doc, f1, [block]);
          const last = sec.blocks[sec.blocks.length - 1] ?? sec.head;
          const at = last ? doc.blocks.findIndex((b) => b.id === last.id) + 1 : 0;
          doc.blocks.splice(at, 0, block);
        });
        say(t("Salary range updated"), { type: "success" });
      },

      openSalaryForm() {
        openModal(<SalaryModal jobId={jobId} />);
      },

      /** Moves a block to the visibility a compliance rule asks for (V1/V2). */
      fixVisibility(blockId: string, level: BlockLevel) {
        editDoc((doc) => {
          const b = doc.blocks.find((x) => x.id === blockId);
          if (b) b.level = level;
        });
        say(`${t("Marked as")} ${t(BLOCK_LEVELS[level].label)}`);
      },

      /* ---------------- suggestions ---------------- */

      async acceptSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId).find((x) => x.id === suggestionId);
        if (!s) return;
        if (s.status === "stale") return say(t("This suggestion needs a refresh before it can be accepted."), { type: "error" });
        if (s.status !== "proposed") return say(`${t("This suggestion was already")} ${t(s.status)}.`);

        // Dry-run on a copy first: the text may have been edited since the suggestion was generated.
        const current = selectDraft(state, jobId).blocks.find((b) => b.id === s.anchorBlock);
        const probe = current ? { ...current, text: Array.isArray(current.text) ? [...current.text] : current.text } : null;
        if (!probe || !applySuggestionToBlock(probe, s)) {
          const staleReason = "The selected text changed after this suggestion was generated.";
          if (await persistSuggestion(s.id, { status: "stale", staleReason })) setStoredSuggestion(s.id, { status: "stale", staleReason });
          return say(t("The text changed since this suggestion was generated — select it again and ask Copilot."), { type: "error" });
        }

        if (!(await persistSuggestion(s.id, { status: "accepted" }))) return;
        mutate((draft) => {
          editDocCopy(draft, jobId, (doc) => {
            const block = doc.blocks.find((b) => b.id === s.anchorBlock);
            if (!block || !applySuggestionToBlock(block, s)) return;
            // A list rewrite may return several bullets — each becomes its own block.
            doc.blocks = normalizeBlocks(doc.blocks);
            doc.revision++;
            doc.saveState = "dirty";
          });
          draft.suggestions = {
            ...draft.suggestions,
            [key]: (draft.suggestions[key] ?? []).map((x) => (x.id === suggestionId ? { ...x, status: "accepted" as const } : x)),
          };
          draft.activity = {
            ...draft.activity,
            [jobId]: [
              { at: nowISO(), actor: draft.currentUserId, text: "Accepted a document suggestion." },
              ...(draft.activity[jobId] ?? []),
            ],
          };
          // The suggestion is already recorded as accepted server-side, so save the document right away
          // rather than leaving the accepted text only in this browser.
          draft.wsSaveRequest++;
        });
        say(t("Suggestion accepted"));
      },

      async rejectSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId).find((x) => x.id === suggestionId);
        if (!s || s.status !== "proposed") return say(t("Nothing to reject."));
        if (!(await persistSuggestion(s.id, { status: "rejected" }))) return;
        setStoredSuggestion(s.id, { status: "rejected" });
        say(t("Suggestion rejected"));
      },

      /** Regenerates a proposal with the user's follow-up note; the old proposal is marked superseded. */
      async refineWith(suggestionId: string, note: string) {
        const old = selectSuggestions(state, jobId).find((x) => x.id === suggestionId);
        if (!old) return;
        if (old.status === "proposed") {
          if (!(await persistSuggestion(old.id, { status: "rejected" }))) return;
          setStoredSuggestion(old.id, { status: "rejected" });
        }
        pushThreadMsg("user", `${t("Refine")}: ${note || t("Refine")}`);
        void generate(
          old.anchorBlock,
          old.oldText,
          "custom",
          `${t("Previous proposal")}: ${old.newText}\n${note ? `${t("Adjust it as follows")}: ${note}` : t("Improve the previous proposal.")}`,
          old.id,
        );
      },

      refineSuggestion(suggestionId: string) {
        openModal(<RefineModal jobId={jobId} suggestionId={suggestionId} />);
      },

      reviewLatest(suggestionId: string) {
        openModal(<ReviewLatestModal jobId={jobId} suggestionId={suggestionId} />);
      },

      async dismissStale(suggestionId: string) {
        if (!(await persistSuggestion(suggestionId, { status: "cancelled" }))) return;
        setStoredSuggestion(suggestionId, { status: "cancelled" });
        closeModal();
        say(t("Outdated suggestion dismissed"));
      },
    };
  }, [jobId, key, state, t, set, mutate, say, openModal, closeModal]);
}

/** Inserts a new section for `item` (heading + `body`) at its place in the default section order. */
function insertSectionOrdered(doc: DocumentDraft, item: ReqItem, body: DocBlock[]) {
  const heading = detectLanguage(doc.blocks) === "zh" ? item.heading!.zh : item.heading!.en;
  const rank = sectionRank(item.heading!.en);
  // Before the first later section in the default order (the title section stays first).
  let at = doc.blocks.length;
  for (let i = 1; i < doc.blocks.length; i++) {
    const b = doc.blocks[i];
    if (b.kind === "h2" && sectionRank(blockPlainText(b)) > rank) {
      at = i;
      break;
    }
  }
  doc.blocks.splice(at, 0, mkBlock(uid("ns"), "h2", heading, { level: item.level ?? "internal" }), ...body);
}

/** The document as sent to the completeness AI — Confidential blocks go without their text (standard V5). */
function aiBlocks(blocks: DocBlock[]): AiBlock[] {
  let section = "";
  return blocks.map((b) => {
    if (b.kind === "h2") section = blockPlainText(b);
    const level = blockLevel(b);
    return { id: b.id, kind: b.kind, level, section, text: level === "confidential" ? undefined : blockPlainText(b) };
  });
}

/** Server-stored suggestions have UUID ids; anything else is a seeded demo suggestion held only locally. */
function isLocalOnlyId(id: string) {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Writes an accepted suggestion into its block: a whole-list rewrite replaces every item; otherwise
 * the selected fragment is swapped inside the item / paragraph that contains it (returning false when
 * the fragment can no longer be found — the text changed since the suggestion).
 */
function applySuggestionToBlock(block: DocBlock, s: Suggestion): boolean {
  const swap = (text: string) =>
    text.includes(s.oldText)
      ? text.replace(s.oldText, s.newText)
      : stripHtml(text).includes(s.oldText)
        ? stripHtml(text).replace(s.oldText, s.newText)
        : null;
  if (Array.isArray(block.text)) {
    if (s.newItems?.length) {
      block.text = [...s.newItems];
      return true;
    }
    for (let i = 0; i < block.text.length; i++) {
      const next = swap(block.text[i]);
      if (next !== null) {
        block.text[i] = next;
        return true;
      }
    }
    return false;
  }
  const next = swap(block.text);
  if (next === null) return false;
  block.text = next;
  return true;
}

/* ---------------------------------------------------------------
   Modals used by the actions above
   --------------------------------------------------------------- */
function RefineModal({ jobId, suggestionId }: { jobId: string; suggestionId: string }) {
  const { state, t, closeModal } = useStore();
  const actions = useDocActions(jobId);
  const [note, setNote] = useState("");
  const old = selectSuggestions(state, jobId).find((x) => x.id === suggestionId);
  if (!old) return null;

  const submit = () => {
    actions.refineWith(suggestionId, note.trim());
    closeModal();
  };

  return (
    <>
      <ModalHeader title={t("Refine suggestion")} />
      <ModalBody>
        <div className="tiny" style={{ marginBottom: 8 }}>
          {t("Current proposal")}: “{old.newText}”
        </div>
        <Input.TextArea
          placeholder={t("e.g. This role is mostly internal-team facing")}
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={submit}>
          {t("Refine")}
        </Button>
      </ModalFooter>
    </>
  );
}

function ReviewLatestModal({ jobId, suggestionId }: { jobId: string; suggestionId: string }) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId);
  const s = selectSuggestions(state, jobId).find((x) => x.id === suggestionId);
  const block = s ? selectDraft(state, jobId).blocks.find((b) => b.id === s.anchorBlock) : null;
  return (
    <>
      <ModalHeader title={t("Review latest text")} />
      <ModalBody>
        <p className="tiny">{t("The document changed after this suggestion was generated. Current text:")}</p>
        <div className="card card-pad" style={{ background: "var(--surface-alt)", border: "none" }}>
          {block ? blockPlainText(block) : "—"}
        </div>
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={() => actions.dismissStale(suggestionId)}>
          {t("Dismiss outdated suggestion")}
        </Button>
      </ModalFooter>
    </>
  );
}
