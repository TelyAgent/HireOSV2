import { useMemo } from "react";
import { useStore } from "../../store/StoreContext";
import { evaluateJob, type Evaluation } from "./completeness";
import { selectDraft } from "./docHelpers";

/** Live completeness evaluation of a job's document (recomputed when the job or document changes). */
export function useCompleteness(jobId: string): Evaluation | null {
  const { state } = useStore();
  const job = state.jobs[jobId];
  const draft = job ? selectDraft(state, jobId) : null;
  const lang = state.lang === "zh" ? "zh" : "en";
  const loaded = state.wsVersions[jobId];
  const jdCode = loaded ? loaded.jdCode || null : undefined;
  return useMemo(() => (job && draft ? evaluateJob(job, draft, lang, jdCode) : null), [job, draft, lang, jdCode]);
}
