import type { AppState } from "../../store/types";
import { listJobs } from "./jobsApi";
import { coreJobToLocalJob } from "./jobsMapping";

/**
 * Loads the real jobs into the store and records how that went (#35), so the Job Library can tell
 * "still loading" and "failed — retry" apart from "there really are no jobs".
 */
export async function loadJobsIntoStore(mutate: (fn: (draft: AppState) => void) => void): Promise<void> {
  mutate((draft) => {
    draft.jobsLoad = { status: "loading" };
  });
  try {
    const coreJobs = await listJobs();
    mutate((draft) => {
      for (const cj of coreJobs) draft.jobs[cj.id] = coreJobToLocalJob(cj, draft.jobs[cj.id]);
      draft.jobsLoad = { status: "loaded" };
    });
  } catch (error) {
    console.warn("Failed to load real jobs from the backend:", error);
    mutate((draft) => {
      draft.jobsLoad = { status: "failed", error: error instanceof Error ? error.message : String(error) };
    });
  }
}
