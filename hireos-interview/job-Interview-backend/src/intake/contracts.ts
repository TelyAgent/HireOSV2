import { z } from 'zod';
import { invalidSchemaFromZod } from '../http/invalid-schema';

export const kindSchema = z.enum(['resume', 'screening', 'assessment', 'other']);
export const taskMaterialKindSchema = z.enum(['screening', 'assessment', 'other']);
export const taskStatusSchema = z.enum([
  'draft', 'requirements_ready', 'planning', 'ready_to_schedule', 'interview_in_progress',
  'evidence_requested', 'awaiting_confirmation', 'package_published', 'on_hold', 'not_proceeding',
]);

// Syncs a Core Record job locally (JobsService.attach) — used by the new-task entry for
// both "pick an existing job" and freshly created JDs, and by nothing else besides a
// Screening hand-off.
export const attachJobSchema = z.object({ coreJobId: z.string().trim().min(1).max(200) }).strict();

// The new-task entry (QuickStartService): a job -- either new JD text (optionally with the
// uploaded JD file it was read from) or an existing Core Record job -- plus at most one
// résumé. One job + one résumé is one interview task.
export const quickStartSchema = z.object({
  jd: z.union([
    z.object({ text: z.string().trim().min(1).max(150000), materialId: z.string().uuid().optional() }).strict(),
    z.object({ coreJobId: z.string().trim().min(1).max(200) }).strict(),
  ]),
  resumeMaterialId: z.string().uuid().optional(),
}).strict();

// Links one more résumé to an existing Job (the "link candidate" action).
export const createTaskSchema = z.object({ materialId: z.string().uuid() }).strict();

// Attaches a task-specific material (screening report, assessment result, other) —
// résumés are attached via createTaskSchema instead, since they always create a task.
export const attachTaskMaterialSchema = z.object({ materialId: z.string().uuid(), kind: taskMaterialKindSchema }).strict();
export const resolveScreeningSchema = z.object({ materialId: z.string().uuid(), expectedRevision: z.number().int().min(0) }).strict();
export const triageMaterialSchema = z.object({ materialId: z.string().uuid(), kind: z.enum(['screening', 'assessment']) }).strict();

// Received from Screening's outbox dispatcher when a decision's next step is
// "move to interview". Carries only stable Core Record ids and a display summary —
// never primary content itself — matching the event-envelope rule (see arch docs:
// events carry stable IDs + a change summary, not the underlying file/document). Job/
// Candidate are upserted by their Core Record id so a retried delivery never creates
// duplicates; coreMaterialId (also a stable id, not a file) lets Interview pull the
// same résumé Core Record already holds instead of waiting on a manual re-upload.
export const screeningHandoffSchema = z.object({
  coreJobId: z.string().trim().min(1).max(200),
  coreCandidateId: z.string().trim().min(1).max(200),
  jobTitle: z.string().trim().min(1).max(200),
  jobDepartment: z.string().trim().max(200).optional(),
  jobLocation: z.string().trim().max(200).optional(),
  jobLevel: z.string().trim().max(100).optional(),
  jdText: z.string().trim().max(150000).optional(),
  candidateName: z.string().trim().min(1).max(200),
  candidateEmail: z.string().trim().email().max(320).optional(),
  candidatePhone: z.string().trim().max(50).optional(),
  coreMaterialId: z.string().trim().min(1).max(200).optional(),
  matchScore: z.number().int().min(0).max(100).optional(),
  matchRecommendation: z.string().trim().max(50).optional(),
}).strict();

export const reviewTaskSchema = z.object({
  version: z.number().int().positive(), status: taskStatusSchema,
}).strict();

export const roundStatusSchema = z.enum(['Planned', 'completed']);
const roundFieldsShape = {
  name: z.string().trim().min(1).max(200),
  format: z.string().trim().min(1).max(100),
  duration: z.number().int().min(5).max(480),
  competencies: z.string().max(2000),
  questions: z.number().int().min(1).max(20),
  mandatory: z.number().int().min(0).max(20),
  notes: z.string().max(5000),
  interviewerId: z.string().uuid().nullable(),
};
export const createRoundSchema = z.object(roundFieldsShape).partial().strict();
export const updateRoundSchema = z.object({ version: z.number().int().positive(), status: roundStatusSchema, ...roundFieldsShape }).strict();
// Setting the meeting time is a distinct action from editing round content (Plan vs
// Schedule in the product flow); scheduledAt is the instant (UTC), and timezone the IANA zone
// it was picked in (#231) — the client reads the wall time in that zone, and shows it back in it.
// Rounds scheduled earlier may still carry a free-text label; only new schedules must name a zone.
const isIanaZone = (zone: string) => {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};
export const scheduleRoundSchema = z.object({
  version: z.number().int().positive(),
  interviewerId: z.string().uuid().optional(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(64).refine(isIanaZone, { message: 'Choose a time zone such as Asia/Shanghai.' }),
  // Pasted by the scheduler (Google Meet/Zoom/etc.) — an empty string clears it. No real
  // calendar or meeting-provider integration is wired to this field; that's out of scope
  // for the scheduling step itself (see meetings/ for the separate, real Zoom host flow).
  meetingLink: z.string().trim().max(2000),
  /** The language the interview is held in, for its transcript (#230); left out, the round keeps its own. */
  interviewLanguage: z.enum(['zh', 'en', 'auto']).optional(),
}).strict();
// Review: one human score for one capability card in one round. `score` null means
// explicitly marked Unknown (distinct from never having been touched).
export const setCardScoreSchema = z.object({
  score: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(5000),
}).strict().refine((input) => input.score === null || input.note.trim().length > 0, {
  path: ['note'], message: 'A reason is required for a human score.',
});
export const recommendationSchema = z.enum(['strong_advance', 'advance', 'hold', 'do_not_advance', 'request_info']);
export const setRecommendationSchema = z.object({ recommendation: recommendationSchema.nullable(), reason: z.string().trim().max(4000).optional() }).strict()
  .refine(input => input.recommendation === null || !!input.reason, { message: 'Recommendation reason is required', path: ['reason'] });
// Decision & Next Steps: the human's final call on the whole task. The AI draft only ever
// suggests one of these (see rubric/decision-contracts.ts) — this endpoint records a human's.
export const decisionSchema = z.enum(['continue_next_round', 'hold', 'request_more_evidence', 'do_not_proceed', 'recommend_offer']);
export const setDecisionSchema = z.object({ decision: decisionSchema.nullable(), reason: z.string().trim().max(4000).optional(), version: z.number().int().min(0).optional() }).strict();
// Evaluation Package sign-off: HR and Hiring Manager confirm independently of each other —
// see TasksService.confirmPackage.
export const confirmPlanSchema = z.object({ confirmed: z.boolean() }).strict();
export const confirmPackageSchema = z.object({ role: z.enum(['hr', 'hm']), confirmed: z.boolean(), note: z.string().trim().max(2000).optional() }).strict();
export const offerAckSchema = z.object({ attemptId: z.string().uuid(), acknowledged: z.boolean(), error: z.string().trim().max(1000).optional() }).strict();

export type Segment = { id: string; text: string; page?: number };
// `cards` is only used by the `round_scores` and `debrief_scores` extraction types (see
// rubric/score-contracts.ts, rubric/debrief-contracts.ts)
// — the capability cards being scored against, alongside the segments (transcript lines)
// carrying the evidence. Every other extraction type ignores it.
export type ParseInput = { segments: Segment[]; sourceId: string; requirements?: { id: string; label: string; requiredLevel: number | null }[]; cards?: { id: string; requirement: string; cardPriority: string; levelAnchors: unknown }[] };
const fact = z.object({ value: z.string().max(5000), segmentId: z.string(), quote: z.string().min(1).max(5000) }).strict();
export const extractionSchema = z.object({
  title: fact.nullable(), name: fact.nullable(), email: fact.nullable(),
  facts: z.array(z.object({ category: z.enum(['responsibility', 'requirement', 'experience', 'education', 'skill', 'claim']), ...fact.shape }).strict()).max(100),
  missingFields: z.array(z.string()).max(30), warnings: z.array(z.string()).max(30),
}).strict();

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
  return parsed.data;
}
