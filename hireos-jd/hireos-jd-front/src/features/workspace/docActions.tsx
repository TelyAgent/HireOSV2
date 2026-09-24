/**
 * Document editing actions, ported from the prototype's `A.*` handlers for
 * the Copilot / Comments / Changes side panel.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Primitives";
import { CancelButton, ModalBody, ModalFooter, ModalHeader } from "../../components/ui/Overlays";
import { useStore } from "../../store/StoreContext";
import { blockPlainText, ensureDraft, makeSuggestion, selectDraft, selectSuggestions } from "./docHelpers";
import { nowISO, uid } from "../../lib/format";
import type { Audience } from "../../data/types";

export function useDocActions(jobId: string, audience: Audience) {
  const { state, t, set, mutate, say, openModal, closeModal } = useStore();
  const navigate = useNavigate();
  const key = `${jobId}:${audience}`;

  return useMemo(() => {
    const pushThreadMsg = (kind: "user" | "text", text: string) =>
      mutate((draft) => {
        draft.wsCopilotThread = [...draft.wsCopilotThread, { kind, text }];
      });

    const generate = (blockId: string | null, selText: string, instruction?: string) => {
      if (!blockId) {
        pushThreadMsg(
          "text",
          t(
            'I don’t have a selection to work from yet — select a sentence, list item or paragraph in the document first, or tell me "whole document" to widen the scope.',
          ),
        );
        return;
      }
      const { suggestion, explain } = makeSuggestion(state.currentUserId, blockId, selText, instruction);
      mutate((draft) => {
        draft.suggestions[key] = [...(draft.suggestions[key] ?? []), suggestion];
        draft.wsCopilotThread = [...draft.wsCopilotThread, { kind: "suggestion", suggestion, explain }];
        draft.wsSelection = null;
        draft.wsSideTab = "copilot";
      });
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
        generate(blockId, text, kind);
      },

      sendCopilot(instruction: string) {
        if (!instruction.trim()) return;
        pushThreadMsg("user", instruction);
        const sel = state.wsSelection;
        if (!sel) return generate(null, "");
        generate(sel.blockId, sel.text, instruction);
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

      acceptSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
        if (!s) return;
        if (s.status === "stale") return say(t("This suggestion needs a refresh before it can be accepted."), { type: "error" });
        if (s.status !== "proposed") return say(`${t("This suggestion was already")} ${t(s.status)}.`);

        mutate((draft) => {
          const doc = ensureDraft(draft, jobId, audience);
          const block = doc.blocks.find((b) => b.id === s.anchorBlock);
          if (block) {
            if (Array.isArray(block.text)) block.text = block.text.map((x) => (x === s.oldText ? s.newText : x));
            else if (block.text === s.oldText) block.text = s.newText;
          }
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
        });
        say(t("Suggestion accepted — working draft updated (not yet approved)"));
      },

      rejectSuggestion(suggestionId: string) {
        const s = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
        if (!s || s.status !== "proposed") return say(t("Nothing to reject."));
        mutate((draft) => {
          const stored = draft.suggestions[key]?.find((x) => x.id === suggestionId);
          if (stored) stored.status = "rejected";
        });
        say(t("Suggestion rejected"));
      },

      refineSuggestion(suggestionId: string) {
        openModal(<RefineModal jobId={jobId} audience={audience} suggestionId={suggestionId} />);
      },

      reviewLatest(suggestionId: string) {
        openModal(<ReviewLatestModal jobId={jobId} audience={audience} suggestionId={suggestionId} />);
      },

      dismissStale(suggestionId: string) {
        mutate((draft) => {
          const stored = draft.suggestions[key]?.find((x) => x.id === suggestionId);
          if (stored) stored.status = "cancelled";
        });
        closeModal();
        say(t("Outdated suggestion dismissed"));
      },
    };
  }, [jobId, audience, key, state, t, set, mutate, say, openModal, closeModal, navigate]);
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
        <textarea placeholder={t("Add a comment…")} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
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
        <textarea placeholder={t("Write a reply…")} value={body} onChange={(e) => setBody(e.target.value)} autoFocus />
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
  const { state, t, mutate, closeModal } = useStore();
  const [note, setNote] = useState("");
  const key = `${jobId}:${audience}`;
  const old = selectSuggestions(state, jobId, audience).find((x) => x.id === suggestionId);
  if (!old) return null;

  const submit = () => {
    const refined = {
      id: uid("sug"),
      anchorBlock: old.anchorBlock,
      status: "proposed" as const,
      author: "ai" as const,
      initiatedBy: state.currentUserId,
      createdAt: nowISO(),
      instruction: "Refine",
      oldText: old.oldText,
      newText: old.newText.replace(/\.$/, "") + (note.trim() ? ` (${note.trim()})` : " (refined)"),
      reason: `Refined based on: ${note.trim() || "follow-up context"}. Supersedes the previous proposal.`,
      supersedes: old.id,
    };
    mutate((draft) => {
      const stored = draft.suggestions[key]?.find((x) => x.id === suggestionId);
      if (stored) stored.status = "rejected";
      draft.suggestions[key] = [...(draft.suggestions[key] ?? []), refined];
      draft.wsCopilotThread = [
        ...draft.wsCopilotThread,
        {
          kind: "suggestion",
          suggestion: refined,
          explain: "Here’s a refined version based on your note. The previous proposal is kept in history as superseded.",
        },
      ];
    });
    closeModal();
  };

  return (
    <>
      <ModalHeader title={t("Refine suggestion")} />
      <ModalBody>
        <div className="tiny" style={{ marginBottom: 8 }}>
          {t("Current proposal")}: “{old.newText}”
        </div>
        <textarea
          placeholder={t("e.g. This role is mostly internal-team facing")}
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
