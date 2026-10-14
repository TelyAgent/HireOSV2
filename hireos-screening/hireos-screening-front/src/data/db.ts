import { getPerson, PEOPLE } from "./fixtures/people";
import type { Job } from "./fixtures/jobs";
import type { Candidate } from "./fixtures/candidates";
import type { ResumeVersion } from "./fixtures/resumeVersions";
import type { JobDiscoveryRun } from "./fixtures/jobDiscovery";
import type { CandidateJobRecommendation } from "./fixtures/recommendations";
import type { Application } from "./fixtures/applications";
import type { Evaluation } from "./fixtures/evaluations";
import type { Evidence } from "./fixtures/evidence";
import type { Concern } from "./fixtures/concerns";
import type { VerificationItem } from "./fixtures/verificationItems";
import type { Decision } from "./fixtures/decisions";
import type { ComparisonSet } from "./fixtures/comparisons";
import type { Task } from "./fixtures/tasks";
import type { DuplicateReview } from "./fixtures/duplicateReviews";
import type { FileRecord } from "./fixtures/files";
import type { Connection } from "./fixtures/connections";
import type { ActivityEntry } from "./fixtures/activity";
import type { HumanAssessment } from "./fixtures/humanAssessments";
import type { CorporateMailbox } from "./fixtures/corporateMailbox";

/**
 * Runtime client-side cache for data fetched from the real backend. Every
 * collection here starts empty — `src/data/api/*` functions populate it as a
 * side effect of each real fetch (see e.g. `listJobs()`), so pages that read
 * through `getJob`/`getCandidate`/etc. see data once it's been fetched at
 * least once elsewhere. Never seed this with fixture/demo data — that's what
 * caused candidates, jobs, etc. from the old mock layer to show up mixed in
 * with real records.
 */
export const db = {
  people: PEOPLE,
  jobs: {} as Record<string, Job>,
  candidates: {} as Record<string, Candidate>,
  resumeVersions: {} as Record<string, ResumeVersion[]>,
  jobDiscovery: {} as Record<string, JobDiscoveryRun>,
  recommendations: [] as CandidateJobRecommendation[],
  applications: [] as Application[],
  evaluations: {} as Record<string, Evaluation>,
  evidence: {} as Record<string, Evidence>,
  concerns: {} as Record<string, Concern[]>,
  verificationItems: {} as Record<string, VerificationItem>,
  decisions: {} as Record<string, Decision>,
  comparisons: {} as Record<string, ComparisonSet>,
  tasks: [] as Task[],
  duplicateReviews: {} as Record<string, DuplicateReview>,
  files: [] as FileRecord[],
  connections: [] as Connection[],
  activity: [] as ActivityEntry[],
  humanAssessments: {} as Record<string, HumanAssessment[]>,
  corporateMailboxes: [] as CorporateMailbox[],
};

export { getPerson };

export function getJob(id: string) {
  return db.jobs[id];
}
export function getCandidate(id: string) {
  return db.candidates[id];
}
export function getApplication(id: string) {
  return db.applications.find((a) => a.id === id);
}
export function getApplicationsForJob(jobId: string) {
  return db.applications.filter((a) => a.jobId === jobId);
}
export function getApplicationsForCandidate(candidateId: string) {
  return db.applications.filter((a) => a.candidateId === candidateId);
}
export function getEvaluation(applicationId: string) {
  return db.evaluations[applicationId];
}
export function getRecsForCandidate(candidateId: string) {
  return db.recommendations.filter((r) => r.candidateId === candidateId);
}
export function getRecsForJob(jobId: string) {
  return db.recommendations.filter((r) => r.jobId === jobId);
}
/**
 * Writes what a mutation's response says into the shared cache, so every page that reads it (detail,
 * decision, comparison) agrees without a refetch (#27 AC-8). Every screening mutation goes through here.
 */
export function applyServerState(update: {
  applicationId: string;
  concern?: Concern;
  verificationItem?: VerificationItem;
  /** `null` = no decision in effect any more (withdrawn). */
  decision?: Decision | null;
  screeningStatus?: Application["screeningStatus"];
}) {
  const { applicationId, concern, verificationItem, decision, screeningStatus } = update;
  if (concern) {
    const list = db.concerns[applicationId] || [];
    const index = list.findIndex((c) => c.id === concern.id);
    db.concerns[applicationId] = index >= 0 ? list.map((c, i) => (i === index ? concern : c)) : [...list, concern];
  }
  if (verificationItem) db.verificationItems[verificationItem.id] = verificationItem;
  if (decision === null) delete db.decisions[applicationId];
  else if (decision) db.decisions[applicationId] = decision;
  if (screeningStatus) {
    const application = db.applications.find((a) => a.id === applicationId);
    if (application) application.screeningStatus = screeningStatus;
  }
}

export function getConcerns(applicationId: string) {
  return db.concerns[applicationId] || [];
}
export function getEvidenceById(id: string) {
  return db.evidence[id];
}
