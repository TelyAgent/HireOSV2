import { useRef } from "react";
import { useStore } from "../../store/StoreContext";
import { DOC_AUDIENCE, ensureDraft, selectDraft } from "./docHelpers";
import { saveJobDocument } from "./documentsApi";
import { COMMIT_DEBOUNCE_MS } from "./RichBlockEditor";

/**
 * Saves the job document. Shared by the document toolbar (Save / ⌘S) and Publish, which must publish
 * exactly what is saved. Resolves to the saved server revision, or null when the save failed.
 */
export function useDocumentSaver(jobId: string) {
  const { state, t, mutate, say } = useStore();
  const latest = useRef(selectDraft(state, jobId));
  latest.current = selectDraft(state, jobId);

  return async (opts: { quiet?: boolean } = {}): Promise<number | null> => {
    if (latest.current.saveState === "saving") return null;
    mutate((d) => void (ensureDraft(d, jobId).saveState = "saving"));
    // Editors commit keystrokes on a short debounce — wait it out so the last edit is included.
    await new Promise((resolve) => window.setTimeout(resolve, COMMIT_DEBOUNCE_MS + 50));
    const doc = latest.current;
    const sentRevision = doc.revision;
    try {
      const saved = await saveJobDocument(jobId, DOC_AUDIENCE, doc.blocks, doc.serverRevision, doc.meta);
      mutate((d) => {
        const target = ensureDraft(d, jobId);
        target.serverRevision = saved.revision;
        // Edits made while the request was in flight stay unsaved.
        target.saveState = target.revision === sentRevision ? "saved" : "dirty";
      });
      if (!opts.quiet) say(t("Document saved"), { type: "success" });
      return saved.revision;
    } catch (error) {
      mutate((d) => void (ensureDraft(d, jobId).saveState = "dirty"));
      say(error instanceof Error ? error.message : t("Couldn't save the document. Please try again."), { type: "error" });
      return null;
    }
  };
}
