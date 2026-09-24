/**
 * Domain types for the JD Management module.
 *
 * These describe the prototype's fixture shapes (ported verbatim from
 * `HireOS_Command_JD_Management_Prototype.html`). Optional fields are the
 * ones that only some fixture rows carry — e.g. `qualityNote` on the real
 * Sending Labs postings, or `lifecycleReason` on paused/closed jobs.
 */
import type { MoneyRange } from "../lib/format";

export type PersonId = "maya" | "linh" | "alex" | "sam" | "jamie" | (string & {});

export interface Person {
  id: string;
  name: string;
  role: string;
  title: string;
  email: string;
  color: string;
  initials: string;
}

/** Simplified to two states by design — the Job Library only ever needs to distinguish a job that's
 * still being drafted from one that's been published; the richer open/paused/closed/archived lifecycle
 * this replaced is deferred (see the Workflow & Approval / Publication tabs, currently hidden). */
export type HiringStatus = "draft" | "published";
export type ApprovalStatus =
  | "not_submitted"
  | "pending"
  | "changes_requested"
  | "rejected"
  | "approved"
  | "cancelled"
  | "superseded";
export type ActivationStatus = "not_requested" | "pending" | "succeeded" | "failed" | "outcome_unknown";
export type PublicationStatus =
  | "not_published"
  | "queued"
  | "publishing"
  | "published"
  | "failed"
  | "outcome_unknown"
  | "withdrawal_pending"
  | "withdrawn";
export type Priority = "low" | "normal" | "high" | "urgent";
export type ConnectionStatus = "not_connected" | "connected" | "paused" | "disconnected" | "authorization_required";
export type FileConsumption = "unassigned" | "pending" | "accepted" | "needs_review" | "rejected" | "failed";
export type Audience = "internal" | "external";

export interface SourceRef {
  /** `null` where the source PDF recorded a posting with no platform/link. */
  platform: string | null;
  jobId?: string | null;
  url?: string | null;
  note?: string;
}

export interface Job {
  id: string;
  title: string;
  department: string;
  team: string;
  location: string;
  employmentType: string;
  workplaceType: string;
  level: string;
  priority: Priority;
  headcount: number;
  hiringManager: PersonId;
  recruiter: PersonId;
  owner: PersonId;
  hiringStatus: HiringStatus;
  activeRoleVersionRef: string | null;
  collaborationStatus: "solo" | "in_collaboration" | "ready" | (string & {});
  draftRevision: number;
  createdAt: string;
  updatedAt: string;
  approvalStatus: ApprovalStatus;
  activationStatus: ActivationStatus;
  publicationStatus: PublicationStatus;
  story?: string;
  lifecycleReason?: string;
  qualityNote?: string;
  duplicateOf?: string;
  /** Softer than `duplicateOf`: flagged for review, not confirmed. */
  possibleDuplicateOf?: string;
  sourceRef?: SourceRef;
}

export interface Dimension {
  id: string;
  name: string;
  weight: number;
  rubric: string;
}

export interface SuccessCriterion {
  period: string;
  statement: string;
}

export interface RoleVersion {
  id: string;
  jobId: string;
  versionNo: number;
  status: "confirmed" | "draft" | "withdrawn" | (string & {});
  origin: string;
  roleSummary: string;
  responsibilities: string[];
  confirmedBy: PersonId;
  confirmedAt: string;
  dimensions: Dimension[];
  evaluationReadiness: string;
  internalCompensation: MoneyRange | null;
  publicCompensation: MoneyRange | null;
  successCriteria: SuccessCriterion[];
}

export interface Requirement {
  id: string;
  statement: string;
  category: string;
  priority: "must_have" | "preferred" | (string & {});
  evaluationType: string;
  dimensionId: string | null;
  criterionWeight?: number;
  evidenceStandard: string;
  dataStatus: "known" | "disputed" | (string & {});
  flagVague?: boolean;
  conflict?: boolean;
}

export interface RestrictedItem {
  id: string;
  jobId: string;
  type: string;
  value: string;
  businessReason: string;
  policyBasisRef: string | null;
  jurisdiction: string;
  reviewStatus: string;
  createdBy: PersonId;
  createdAt: string;
  externalPublish: boolean;
  aiScreeningUsage: boolean;
  aiAssessmentUsage: boolean;
  aiInterviewScoringUsage: boolean;
  allowedDownstreamUsage: string[];
}

export type BlockKind = "h2" | "h3" | "p" | "ul";

export interface DocBlock {
  id: string;
  kind: BlockKind;
  /** `string` for headings/paragraphs, `string[]` for list blocks. */
  text: string | string[];
  requirementRefs: string[];
  semanticRole: string;
  comment: string | null;
  stale: boolean;
  role?: string;
  req?: string;
}

export interface DocumentDraft {
  id: string;
  jobId: string;
  audience: Audience;
  language: string;
  revision: number;
  /** "dirty" = edited locally but not yet saved to the backend (see DocumentTab's Save button). */
  saveState: "saved" | "saving" | "dirty";
  /** Backend `JobDocument` revision this copy was loaded from / last saved as; absent until first save. */
  serverRevision?: number;
  reviewStatus?: string;
  blocks: DocBlock[];
}

export interface CommentReply {
  author: PersonId;
  createdAt: string;
  body: string;
}

export interface CommentThread {
  id: string;
  anchorBlock: string;
  status: "open" | "resolved";
  author: PersonId;
  createdAt: string;
  body: string;
  replies: CommentReply[];
  resolvedBy?: PersonId;
  resolvedAt?: string;
}

export type SuggestionStatus = "proposed" | "accepted" | "rejected" | "stale" | "cancelled";

export interface Suggestion {
  id: string;
  anchorBlock: string;
  status: SuggestionStatus;
  author: "ai" | "human" | (string & {});
  initiatedBy: PersonId;
  createdAt: string;
  instruction: string;
  oldText: string;
  newText: string;
  reason: string;
  staleReason?: string;
  requirementRef?: string | null;
  supersedes?: string;
}

export interface ApprovalStep {
  id: string;
  order: number;
  role: string;
  assignee: PersonId;
  status: "waiting" | "active" | "approved" | "rejected" | "changes_requested";
  decidedAt: string | null;
  reason?: string | null;
}

export interface Approval {
  id: string;
  jobId: string;
  status: ApprovalStatus;
  policy: string;
  candidateRevision: number;
  submittedBy: PersonId;
  submittedAt: string;
  steps: ApprovalStep[];
  materialChanges?: string[];
}

export interface Publication {
  id: string;
  channel: string;
  status: PublicationStatus;
  publishedAt?: string | null;
  withdrawnAt?: string | null;
  versionRef: string;
  url?: string | null;
}

export interface ImpactCount {
  count: number | null;
  asOf?: string | null;
  availability?: string;
}

export interface Impact {
  screening: ImpactCount;
  assessment: ImpactCount;
  interview: ImpactCount;
}

export interface ActivityItem {
  at: string;
  actor: PersonId | "system" | "ai";
  text: string;
  tag?: string;
}

export interface FileItem {
  id: string;
  name: string;
  jobId: string | null;
  size: string;
  kind: string;
  source: string;
  uploadedBy: PersonId | null;
  uploadedAt: string;
  consumption: FileConsumption;
  error?: string;
}

export interface Connection {
  id: string;
  kind: "email" | "folder" | (string & {});
  name: string;
  scope: string;
  owner: PersonId;
  mode: string;
  status: ConnectionStatus;
  lastReadAt: string | null;
  nextReadAt?: string | null;
}

export interface OpActivity {
  id: string;
  type: "read_run" | "upload" | "download" | "consumption_failed" | (string & {});
  status: string;
  at: string;
  actor: string;
  connection?: string;
  file?: string;
  counts?: { discovered: number; matched: number; succeeded: number; skipped: number; failed: number };
  error?: string;
}

export interface AiModel {
  id: string;
  provider: string;
  name: string;
  region: string;
  capabilities: string[];
  priceKnown: boolean;
  priceIn: string;
  priceOut: string;
  p50: string;
  p95: string;
  accuracy: string;
  status: "enabled" | "disabled";
  disabledReason?: string;
}

export interface TaskPolicy {
  primary: string;
  fallback: string | null;
  preference: string;
  budget: string;
  notes: string;
}

export interface ModelEval {
  id: string;
  taskType: string;
  model: string;
  sampleSize: number;
  accuracy: string;
  cost: string;
  p50: string;
  p95: string;
  failureRate: string;
  measuredAt: string;
  reviewer: PersonId;
}

export interface UsageRow {
  taskType: string;
  estimated: string;
  reserved: string;
  actual: string;
  pending: string;
  period: string;
}

export interface ModelActivityItem {
  at: string;
  text: string;
}

export interface Template {
  id: string;
  name: string;
  updatedAt: string;
  usedBy: number;
}
