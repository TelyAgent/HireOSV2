import { API_BASE_URL } from '../../utils/apiBase';

export type MaterialKind = 'resume' | 'screening' | 'assessment' | 'other';
export type Material = { id: string; name: string; text: string; readStatus: string; errorCode: string | null; segments: { id: string; text: string; page?: number }[] };
export type Fact = { value: string; segmentId: string; quote: string; category?: string };
export type ParseResult = { title: Fact | null; name: Fact | null; email: Fact | null; facts: Fact[]; warnings: string[]; missingFields: string[]; sourceId: string };
export type ParseJob = { id: string; type: string; materialId: string | null; inputVersion: number; status: string; errorCode: string | null; result: ParseResult | null };

export type RecruitingStatus = 'open' | 'paused' | 'closed' | 'unknown';
export type CandidateRef = { id: string; name: string; email: string | null };

// GET /interviewers — directory of people who can own/lead a plan round.
export type Interviewer = { id: string; name: string; title: string | null; email: string | null };

// GET /tasks/:id/rounds — a task's interview plan. Two are created automatically for
// every task (see backend RoundsService.createDefaultRounds); more can be added.
export type Round = {
  id: string; sequence: number; name: string; format: string; duration: number;
  competencies: string; questions: number; mandatory: number; notes: string;
  status: 'Planned' | 'completed'; version: number; createdAt: string;
  scheduledAt: string | null; timezone: string | null; meetingLink: string | null;
  transcriptStatus: string; transcriptError: string | null;
  completedAt: string | null; recommendation: Recommendation | null;
  interviewer: { id: string; name: string; title: string | null } | null;
};

// GET /jobs — the JD side. A Job with zero tasks is still a valid JD-only draft.
export type JobSummary = { id: string; title: string; department: string | null; location: string | null; level: string | null; recruitingStatus: RecruitingStatus; jdVersion: number; createdAt: string };
export type Job = JobSummary & {
  jdText: string;
  tasks: { id: string; status: string; matchScore: number | null; matchRecommendation: string | null; createdAt: string; candidate: CandidateRef }[];
};

// GET /tasks — the flat, candidate-centric side. Each row is a unique (Job, Candidate) pair.
export type TaskSummary = {
  id: string; jobId: string; status: string; reviewed: boolean; version: number;
  matchScore: number | null; matchRecommendation: string | null; createdAt: string;
  job: { title: string }; candidate: CandidateRef;
  rounds: { status: 'Planned' | 'completed' }[];
};
export type Task = {
  id: string; status: string; reviewed: boolean; version: number;
  matchScore: number | null; matchRecommendation: string | null; createdAt: string;
  job: { id: string; title: string; department: string | null; location: string | null; level: string | null; jdText: string; jdVersion: number };
  candidate: CandidateRef & { phone: string | null };
  resume: { material: Material; parseJobs: { status: string; result: ParseResult | null }[] } | null;
  materials: { kind: string; material: Material }[];
  parseJobs: ParseJob[];
  rounds: Round[];
};

// Requirements & Rubric (see job-Interview-front/docs/prod-plan/HireOS_Interview_Capability_Verification_Card_Implementation_Plan_v1.0.md).
export type ResponsibilityType = 'lead' | 'collaborate' | 'support';
export type CardPriority = 'P0' | 'P1' | 'P2';
export type LevelAnchors = { l1: string; l2: string; l3: string; l4: string; l5: string };
export type CapabilityCard = {
  id: string; requirement: string; responsibilityType: ResponsibilityType; cardPriority: CardPriority;
  competencyTags: string; expectedEvidence: string; levelAnchors: LevelAnchors; weight: number;
  sourceRefs: { segmentId: string; quote: string }[];
};
export type CardInput = {
  id?: string; requirement: string; responsibilityType: ResponsibilityType; cardPriority: CardPriority;
  competencyTags: string[]; expectedEvidence: string; levelAnchors: LevelAnchors; weight: number;
};
export type RubricVersion = {
  id: string; jobId: string; versionNumber: number; status: 'draft' | 'confirmed'; version: number;
  confirmedBy: string | null; confirmedAt: string | null; createdAt: string; cards: CapabilityCard[];
};
// GET /jobs/:id/rubric — `generation` is the in-flight or most recent AI draft job for the
// current JD version; `rubric` is the latest materialized version (draft or confirmed), or
// null before anything has been generated yet.
export type RubricState = {
  jobId: string; jdVersion: number;
  generation: { id: string; status: 'queued' | 'parsing' | 'needs_review' | 'failed'; errorCode: string | null } | null;
  rubric: RubricVersion | null;
};

// Review: a round's human score against one of the job's confirmed capability cards.
// Every round can score every card independently — see backend CardScore.
export type Recommendation = 'strong_advance' | 'advance' | 'hold' | 'do_not_advance' | 'request_info';
export type CardScoreEntry = {
  card: CapabilityCard; score: number | null; note: string;
  aiScore: number | null; aiRationale: string | null; aiQuote: string | null;
};
// GET /rounds/:id/scores — `generation` is the in-flight or most recent `round_scores` AI
// job for this round (null before "Generate AI scores" is ever clicked).
export type RoundScoresState = {
  generation: { id: string; status: 'queued' | 'parsing' | 'needs_review' | 'failed'; errorCode: string | null } | null;
  entries: CardScoreEntry[];
};
// GET /tasks/:id/decision — the human's final call plus the AI-drafted conclusion that
// "Continue to decision" generates (see backend TasksService.generateDecisionDraft).
export type Decision = 'continue_next_round' | 'hold' | 'request_more_evidence' | 'do_not_proceed' | 'recommend_offer';
export type DecisionState = {
  decision: Decision | null; decisionAt: string | null;
  conclusion: string | null; suggestedDecision: Decision | null;
  generation: { id: string; status: 'queued' | 'parsing' | 'needs_review' | 'failed'; errorCode: string | null } | null;
};
// GET /tasks/:id/debrief — aggregate roll-up across the task's rounds, taking each card's
// most recently updated score (see backend TasksService.debrief).
export type DebriefSummary = {
  totalCards: number; scoredCount: number;
  mustHaveTotal: number; mustHaveMet: number;
  evaluatedWeightPct: number;
  overall: 'pass' | 'fail' | null;
  unknownCards: { id: string; requirement: string }[];
  cards: { id: string; requirement: string; cardPriority: CardPriority; weight: number; score: number | null }[];
};

// GET /tasks/:id/package — the Evaluation Package: decision + debrief roll-up + evidence
// derived from real card scores + HR/Hiring Manager sign-off + Offer handoff state (see
// backend TasksService.package). No manual evidence curation exists — `evidence` is computed
// from CardScore, not a separately-authored list.
export type PackageEvidenceItem = {
  cardId: string; requirement: string; cardPriority: CardPriority; weight: number;
  roundName: string | null; score: number | null; note: string;
  aiScore: number | null; aiRationale: string | null;
  tag: 'strong' | 'medium' | 'weak' | 'unknown';
};
export type PackageState = {
  candidateName: string; jobTitle: string;
  decision: Decision | null; decisionAt: string | null; conclusion: string | null;
  debrief: DebriefSummary;
  evidence: PackageEvidenceItem[];
  hrConfirmedAt: string | null; hmConfirmedAt: string | null;
  published: boolean;
  offerState: 'none' | 'sent'; offerSentAt: string | null;
};

// GET/POST /jobs/:id/brief-questions — one STAR (Situation/Task/Action/Result) follow-up
// set per confirmed capability card, generated once per rubric version. No candidate
// resume matching exists yet, so every card in the job's latest confirmed rubric shows up
// here regardless of round — see the implementation plan's Phase D/E split.
export type InterviewQuestion = {
  id: string; cardId: string;
  situationPrompt: string; taskPrompt: string; actionPrompt: string; resultPrompt: string;
  mandatory: boolean; createdAt: string;
  card: { id: string; requirement: string; responsibilityType: ResponsibilityType; cardPriority: CardPriority; competencyTags: string; expectedEvidence: string };
};
export type BriefState = {
  jobId: string; rubricVersionId: string | null; versionNumber: number | null;
  generation: { id: string; status: 'queued' | 'parsing' | 'needs_review' | 'failed'; errorCode: string | null } | null;
  questions: InterviewQuestion[];
};

export class ApiError extends Error { constructor(public code: string) { super(code); } }
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`${API_BASE_URL}api${path}`, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...init?.headers } }); }
  catch { throw new ApiError('NETWORK_ERROR'); }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new ApiError(error.code || (response.status === 413 ? 'FILE_TOO_LARGE' : 'REQUEST_FAILED'));
  }
  return response.json();
}
export async function uploadMaterial(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new ApiError('FILE_TOO_LARGE');
  if (!/\.(pdf|docx|txt)$/i.test(file.name)) throw new ApiError('UNSUPPORTED_FILE_TYPE');
  const data = new FormData(); data.append('file', file);
  return api<Material>('/materials', { method: 'POST', body: data });
}
