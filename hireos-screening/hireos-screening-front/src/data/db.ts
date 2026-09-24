import { PEOPLE, getPerson, type PersonId } from "./fixtures/people";
import { JOBS } from "./fixtures/jobs";
import { CANDIDATES } from "./fixtures/candidates";
import { RESUME_VERSIONS } from "./fixtures/resumeVersions";
import { JOB_DISCOVERY } from "./fixtures/jobDiscovery";
import { RECOMMENDATIONS } from "./fixtures/recommendations";
import { APPLICATIONS } from "./fixtures/applications";
import { EVALUATIONS } from "./fixtures/evaluations";
import { EVIDENCE } from "./fixtures/evidence";
import { CONCERNS } from "./fixtures/concerns";
import { VERIFICATION_ITEMS } from "./fixtures/verificationItems";
import { ASSESSMENTS } from "./fixtures/assessments";
import { DECISIONS } from "./fixtures/decisions";
import { COMPARISONS } from "./fixtures/comparisons";
import { TASKS, type Task } from "./fixtures/tasks";
import { DUPLICATE_REVIEWS } from "./fixtures/duplicateReviews";
import { DELIVERIES } from "./fixtures/deliveries";
import { FILES } from "./fixtures/files";
import { CONNECTIONS } from "./fixtures/connections";
import { ACTIVITY } from "./fixtures/activity";
import { AI_MODELS } from "./fixtures/aiModels";
import { PREFERENCES } from "./fixtures/preferences";
import { AUDIT } from "./fixtures/audit";
import { HUMAN_ASSESSMENTS } from "./fixtures/humanAssessments";
import { CORPORATE_MAILBOXES } from "./fixtures/corporateMailbox";

/**
 * Single in-memory "backend" for the whole app session, mirroring the
 * prototype's `state.db`. Mock API modules (src/data/api/*) mutate these
 * collections directly (push/splice/reassign in place) so every module
 * shares one source of truth for the lifetime of the page session. This is
 * intentionally NOT React state — pages read through feature hooks that call
 * the API layer and hold their own loading/data state; db is the "table"
 * underneath, not the view layer.
 */
export const db = {
  people: PEOPLE,
  jobs: JOBS,
  candidates: CANDIDATES,
  resumeVersions: RESUME_VERSIONS,
  jobDiscovery: JOB_DISCOVERY,
  recommendations: RECOMMENDATIONS,
  applications: APPLICATIONS,
  evaluations: EVALUATIONS,
  evidence: EVIDENCE,
  concerns: CONCERNS,
  verificationItems: VERIFICATION_ITEMS,
  assessments: ASSESSMENTS,
  decisions: DECISIONS,
  comparisons: COMPARISONS,
  tasks: TASKS,
  duplicateReviews: DUPLICATE_REVIEWS,
  deliveries: DELIVERIES,
  files: FILES,
  connections: CONNECTIONS,
  activity: ACTIVITY,
  aiModels: AI_MODELS,
  preferences: PREFERENCES,
  audit: AUDIT,
  humanAssessments: HUMAN_ASSESSMENTS,
  corporateMailboxes: CORPORATE_MAILBOXES,
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
export function getConcerns(applicationId: string) {
  return db.concerns[applicationId] || [];
}
export function getEvidenceById(id: string) {
  return db.evidence[id];
}
export function myTasks(userId: PersonId): Task[] {
  return db.tasks.filter((t) => t.assignee === userId);
}
export function queueTasks(): Task[] {
  return db.tasks.filter((t) => !t.assignee && t.status === "open");
}
