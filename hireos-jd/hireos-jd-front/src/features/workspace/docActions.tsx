/**
 * Document editing actions, ported from the prototype's `A.*` handlers for
 * the Copilot / Comments / Changes side panel.
 */
import { useMemo, useState } from "react";
import { Input } from "antd";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { blockPlainText, ensureDraft, selectDraft, selectSuggestions, stripHtml } from "./docHelpers";
import {
  createSuggestion,
  rewriteDocumentSelection,
  updateSuggestion,
  type NewSuggestion,
  type RewriteRequest,
} from "./documentsApi";
import { nowISO, uid } from "../../lib/format";
import type { Audience, DocBlock, Suggestion } from "../../data/types";

export function useDocActions(jobId: string, audience: Audience) {
  const { state, t, set, mutate, say, openModal, closeModal } = useStore();
  const navigate = useNavigate();
  const key = `${jobId}:${audience}`;

  return useMemo(() => {
    const pushThreadMsg = (kind: "user" | "text", text: string) =>
      mutate((draft) => {
        draft.wsCopilotThread = [...draft.wsCopilotThread, { kind, text }];
      });

    /** Writes a suggestion's status change to the backend first, then mirrors it into the store. */
    const persistSuggestion = async (id: string, patch: Parameters<typeof updateSuggestion>[3]) => {
      // Seeded demo suggestions (fixture ids like "sug-seed-1") were never stored server-side.
      if (isLocalOnlyId(id)) return true;
      try {
        await updateSuggestion(jobId, audience, id, patch);
        return true;
      } catch (error) {
        say(error instanceof Error ? error.message : t("Couldn't update this suggestion. Please try again."), { type: "error" });
        return false;
      }
    };

    const setStoredSuggestion = (id: string, patch: Partial<Suggestion>) =>
      mutate((draft) => {
        const stored = draft.suggestions[key]?.find((x) => x.id === id);
        if (stored) Object.assign(stored, patch);
      });

    const addSuggestion = async (body: NewSuggestion) => {
      const created = await createSuggestion(jobId, audience, body);
      mutate((draft) => {
        draft.suggestions[key] = [...(draft.suggestions[key] ?? []), created];
      });
      return created;
    };

    const generate = async (
      blockId: string | null,
      selText: string,
      action: RewriteRequest["action"],
      instruction?: string,
      supersedes?: string,
    ) => {
      const doc = selectDraft(state, jobId, audience);
      const block = blockId ? doc.blocks.find((b) => b.id === blockId) : undefined;
      if (!block || !selText.trim()) {
        pushThreadMsg(
          "text",
          t("I don’t have anything to work on yet — select some text, or click into the paragraph or list you want changed, then ask again."),
        );
        return;
      }
      if (state.wsCopilotBusy) return;

      const items = Array.isArray(block.text) ? block.text.map(stripHtml) : null;
      const selected = selText.trim();
      // A selection inside one list item / paragraph is rewritten in place; one spanning several
      // list items rewrites the whole list.
      const scope: RewriteRequest["scope"] = items && !items.some((x) => x.includes(selected)) ? "items" : "fragment";
      const job = state.jobs[jobId];

      set({ wsCopilotBusy: true, wsSideTab: "copilot" });
      try {
        const result = await rewriteDocumentSelection(jobId, audience, {
          selectedText: selected,
          instruction,
          action,
          target: items ? { kind: block.kind, items } : { kind: block.kind, text: stripHtml(block.text as string) },
          scope,
          context: {
            jobTitle: job?.title,
            department: job?.department,
            documentText: doc.blocks.map((b) => (Array.isArray(b.text) ? b.text.map((x) => `- ${stripHtml(x)}`).join("\n") : stripHtml(b.text))).join("\n\n"),
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
      setAudience(next: Audience) {
        set({ wsAudience: next, wsSelection: null });
        navigate(`/jobs/${jobId}/document?audience=${next}`);
      },

      setSideTab(tab: "copilot" | "comments" | "changes") {
        set({ wsSideTab: tab });
      },

      clearSelection() {
        set({ wsSelection: null });
      },

      openCommentsFor(blockId: string) {
        set({ wsSideTab: "comments", wsSelection: null });
        const el = document.querySelector(`.doc-block[data-block-id="${blockId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
          ? selectDraft(state, jobId, audience).blocks.find((b) => b.id === state.wsFocusBlockId)
          : undefined;
        const text = focused ? (Array.isArray(focused.text) ? focused.text.map(stripHtml).join("\n") : stripHtml(focused.text)) : "";
        void generate(focused?.id ?? null, text, "custom", instruction);
      },

      addCommentFromSelection(blockId: string | null, text: string) {
        openModal(<AddCommentModal jobId={jobId} audience={audience} blockId={blockId} onText={text} />);
      },

      replyThread(threadId: string) {
        openModal(<ReplyModal jobId={jobId} audience={audience} threadId={threadId} />);
      },

      resolveThread(threadId: string) {
        mutate((draft) => {
          const th = draft.comments[key]?.find((x) => x.id === threadId);
          if (!th) return;
          th.status = "resolved";
          th.resolvedBy = draft.currentUserId;
          th.resolvedAt = nowISO();
        });
        say(t("Comment resolved — requirement standard unchanged"));
      },

      reopenThread(threadId: string) {
        mutate((draft) => {
          const th = draft.comments[key]?.find((x) => x.id === threadId);
          if (th) th.status = "open";
        });
      },

      async acceptSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
        if (!s) return;
        if (s.status === "stale") return say(t("This suggestion needs a refresh before it can be accepted."), { type: "error" });
        if (s.status !== "proposed") return say(`${t("This suggestion was already")} ${t(s.status)}.`);

        // Dry-run on a copy first: the text may have been edited since the suggestion was generated.
        const current = selectDraft(state, jobId, audience).blocks.find((b) => b.id === s.anchorBlock);
        const probe = current ? { ...current, text: Array.isArray(current.text) ? [...current.text] : current.text } : null;
        if (!probe || !applySuggestionToBlock(probe, s)) {
          const staleReason = "The selected text changed after this suggestion was generated.";
          if (await persistSuggestion(s.id, { status: "stale", staleReason })) setStoredSuggestion(s.id, { status: "stale", staleReason });
          return say(t("The text changed since this suggestion was generated — select it again and ask Copilot."), { type: "error" });
        }

        if (!(await persistSuggestion(s.id, { status: "accepted" }))) return;
        mutate((draft) => {
          const doc = ensureDraft(draft, jobId, audience);
          const block = doc.blocks.find((b) => b.id === s.anchorBlock);
          if (!block || !applySuggestionToBlock(block, s)) return;
          const stored = draft.suggestions[key]?.find((x) => x.id === suggestionId);
          if (stored) stored.status = "accepted";
          doc.revision++;
          doc.saveState = "dirty";
          if (s.requirementRef) {
            const req = draft.requirements[jobId]?.find((r) => r.id === s.requirementRef);
            if (req) {
              req.statement = s.newText;
              req.dataStatus = "known";
              req.flagVague = false;
            }
          }
          (draft.activity[jobId] = draft.activity[jobId] || []).unshift({
            at: nowISO(),
            actor: draft.currentUserId,
            text: "Accepted a document suggestion — text and requirement draft updated together.",
          });
          // The suggestion is already recorded as accepted server-side, so save the document right away
          // rather than leaving the accepted text only in this browser.
          draft.wsSaveRequest++;
        });
        say(t("Suggestion accepted — working draft updated (not yet approved)"));
      },

      async rejectSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
        if (!s || s.status !== "proposed") return say(t("Nothing to reject."));
        if (!(await persistSuggestion(s.id, { status: "rejected" }))) return;
        setStoredSuggestion(s.id, { status: "rejected" });
        say(t("Suggestion rejected"));
      },

      /**
       * Suggesting mode: records what the current user typed into a block as a proposal instead of
       * editing the document. Re-editing a block that already has your own pending proposal updates
       * that proposal; editing it back to the original withdraws it.
       */
      async proposeEdit(blockId: string, text: string | string[]) {
        const block = selectDraft(state, jobId, audience).blocks.find((b) => b.id === blockId);
        if (!block) return;
        const own = selectSuggestions(state, jobId, audience).find(
          (x) => x.status === "proposed" && x.author === "human" && x.initiatedBy === state.currentUserId && x.anchorBlock === blockId,
        );
        const isList = Array.isArray(text);
        const plainNew = isList ? text.map(stripHtml).filter((x) => x.trim()) : stripHtml(text);
        const plainOld = Array.isArray(block.text) ? block.text.map(stripHtml) : stripHtml(block.text);
        const unchanged = JSON.stringify(plainNew) === JSON.stringify(plainOld);
        const newItems = isList ? text.filter((x) => stripHtml(x).trim()) : null;
        const newText = isList ? (plainNew as string[]).join("\n") : (text as string);
        try {
          if (own) {
            if (unchanged) {
              await updateSuggestion(jobId, audience, own.id, { status: "cancelled" });
              setStoredSuggestion(own.id, { status: "cancelled" });
            } else if (own.newText !== newText || JSON.stringify(own.newItems ?? null) !== JSON.stringify(newItems)) {
              await updateSuggestion(jobId, audience, own.id, { newText, newItems });
              setStoredSuggestion(own.id, { newText, newItems });
            }
            return;
          }
          if (unchanged) return;
          await addSuggestion({
            anchorBlock: blockId,
            author: "human",
            initiatedBy: state.currentUserId,
            instruction: "Suggested edit",
            oldText: Array.isArray(plainOld) ? plainOld.join("\n") : plainOld,
            newText,
            newItems,
            reason: "",
          });
          set({ wsSideTab: "changes" });
        } catch (error) {
          say(error instanceof Error ? error.message : t("Couldn't save your suggestion. Please try again."), { type: "error" });
        }
      },

      /** Regenerates a proposal with the user's follow-up note; the old proposal is marked superseded. */
      async refineWith(suggestionId: string, note: string) {
        const old = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
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
        openModal(<RefineModal jobId={jobId} audience={audience} suggestionId={suggestionId} />);
      },

      reviewLatest(suggestionId: string) {
        openModal(<ReviewLatestModal jobId={jobId} audience={audience} suggestionId={suggestionId} />);
      },

      async dismissStale(suggestionId: string) {
        if (!(await persistSuggestion(suggestionId, { status: "cancelled" }))) return;
        setStoredSuggestion(suggestionId, { status: "cancelled" });
        closeModal();
        say(t("Outdated suggestion dismissed"));
      },
    };
  }, [jobId, audience, key, state, t, set, mutate, say, openModal, closeModal, navigate]);
}

/** Server-stored suggestions have UUID ids; anything else is a seeded demo suggestion held only locally. */
function isLocalOnlyId(id: string) {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Writes an accepted suggestion into its block: a whole-list rewrite replaces every item; otherwise
 * the selected fragment is swapped inside the item / paragraph that contains it (falling back to
 * returning false when the fragment can no longer be found — the text changed since the suggestion).
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
function AddCommentModal({
  jobId,
  audience,
  blockId,
  onText,
}: {
  jobId: string;
  audience: Audience;
  blockId: string | null;
  onText: string;
}) {
  const { t, mutate, say, closeModal } = useStore();
  const [body, setBody] = useState("");
  const key = `${jobId}:${audience}`;

  const submit = () => {
    if (!body.trim()) return closeModal();
    mutate((draft) => {
      draft.comments[key] = [
        ...(draft.comments[key] ?? []),
        {
          id: uid("thr"),
          anchorBlock: blockId ?? "",
          status: "open",
          author: draft.currentUserId,
          createdAt: nowISO(),
          body: body.trim(),
          replies: [],
        },
      ];
      draft.wsSideTab = "comments";
    });
    closeModal();
    say(t("Comment added"));
  };

  return (
    <>
      <ModalHeader title={t("Add comment")} />
      <ModalBody>
        <div className="tiny" style={{ marginBottom: 8 }}>
          {t("On")}: “{onText.slice(0, 80)}”
        </div>
        <Input.TextArea
          placeholder={t("Add a comment…")}
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={submit}>
          {t("Comment")}
        </Button>
      </ModalFooter>
    </>
  );
}

function ReplyModal({ jobId, audience, threadId }: { jobId: string; audience: Audience; threadId: string }) {
  const { t, mutate, say, closeModal } = useStore();
  const [body, setBody] = useState("");
  const key = `${jobId}:${audience}`;

  const submit = () => {
    if (body.trim()) {
      mutate((draft) => {
        const th = draft.comments[key]?.find((x) => x.id === threadId);
        th?.replies.push({ author: draft.currentUserId, createdAt: nowISO(), body: body.trim() });
      });
    }
    closeModal();
    say(t("Reply posted"));
  };

  return (
    <>
      <ModalHeader title={t("Reply")} />
      <ModalBody>
        <Input.TextArea
          placeholder={t("Write a reply…")}
          autoSize={{ minRows: 3, maxRows: 8 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          autoFocus
        />
      </ModalBody>
      <ModalFooter>
        <CancelButton />
        <Button variant="primary" onClick={submit}>
          {t("Reply")}
        </Button>
      </ModalFooter>
    </>
  );
}

function RefineModal({ jobId, audience, suggestionId }: { jobId: string; audience: Audience; suggestionId: string }) {
  const { state, t, closeModal } = useStore();
  const actions = useDocActions(jobId, audience);
  const [note, setNote] = useState("");
  const old = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
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

function ReviewLatestModal({
  jobId,
  audience,
  suggestionId,
}: {
  jobId: string;
  audience: Audience;
  suggestionId: string;
}) {
  const { state, t } = useStore();
  const actions = useDocActions(jobId, audience);
  const s = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
  const block = s ? selectDraft(state, jobId, audience).blocks.find((b) => b.id === s.anchorBlock) : null;
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
