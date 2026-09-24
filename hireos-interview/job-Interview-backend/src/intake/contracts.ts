import { z } from 'zod';
import { BadRequestException } from '@nestjs/common';

export const kindSchema = z.enum(['resume', 'screening', 'assessment', 'other']);
export const taskMaterialKindSchema = z.enum(['screening', 'assessment', 'other']);
export const taskStatusSchema = z.enum([
  'draft', 'requirements_ready', 'planning', 'ready_to_schedule', 'interview_in_progress',
  'evidence_requested', 'awaiting_confirmation', 'package_published', 'on_hold', 'not_proceeding',
]);

// The "pick an existing job" entry point (JobsService.attach) — Interview has no JD
// authoring of its own, so this is the only way a Job comes to exist locally besides
// a Screening hand-off.
export const attachJobSchema = z.object({ coreJobId: z.string().trim().min(1).max(200) }).strict();

// Links one more résumé to an existing Job (the "link candidate" action).
export const createTaskSchema = z.object({ materialId: z.string().uuid() }).strict();

// Attaches a task-specific material (screening report, assessment result, other) —
// résumés are attached via createTaskSchema instead, since they always create a task.
export const attachTaskMaterialSchema = z.object({ materialId: z.string().uuid(), kind: taskMaterialKindSchema }).strict();

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
// Schedule in the product flow); scheduledAt is an ISO datetime, always paired with the
// timezone label it was picked in (display-only — no timezone math happens server-side).
export const scheduleRoundSchema = z.object({
  version: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(64),
  // Pasted by the scheduler (Google Meet/Zoom/etc.) — an empty string clears it. No real
  // calendar or meeting-provider integration is wired to this field; that's out of scope
  // for the scheduling step itself (see meetings/ for the separate, real Zoom host flow).
  meetingLink: z.string().trim().max(2000),
}).strict();
// Review: one human score for one capability card in one round. `score` null means
// explicitly marked Unknown (distinct from never having been touched).
export const setCardScoreSchema = z.object({
  score: z.number().int().min(1).max(5).nullable(),
  note: z.string().max(5000),
}).strict();
export const recommendationSchema = z.enum(['strong_advance', 'advance', 'hold', 'do_not_advance', 'request_info']);
export const setRecommendationSchema = z.object({ recommendation: recommendationSchema.nullable() }).strict();
// Decision & Next Steps: the human's final call on the whole task. The AI draft only ever
// suggests one of these (see rubric/decision-contracts.ts) — this endpoint records a human's.
export const decisionSchema = z.enum(['continue_next_round', 'hold', 'request_more_evidence', 'do_not_proceed', 'recommend_offer']);
export const setDecisionSchema = z.object({ decision: decisionSchema.nullable() }).strict();
// Evaluation Package sign-off: HR and Hiring Manager confirm independently of each other —
// see TasksService.confirmPackage.
export const confirmPackageSchema = z.object({ role: z.enum(['hr', 'hm']), confirmed: z.boolean() }).strict();

export type Segment = { id: string; text: string; page?: number };
// `cards` is only used by the `round_scores` extraction type (see rubric/score-contracts.ts)
// — the capability cards being scored against, alongside the segments (transcript lines)
// carrying the evidence. Every other extraction type ignores it.
export type ParseInput = { segments: Segment[]; sourceId: string; cards?: { id: string; requirement: string; cardPriority: string; levelAnchors: unknown }[] };
const fact = z.object({ value: z.string().max(5000), segmentId: z.string(), quote: z.string().min(1).max(5000) }).strict();
export const extractionSchema = z.object({
  title: fact.nullable(), name: fact.nullable(), email: fact.nullable(),
  facts: z.array(z.object({ category: z.enum(['responsibility', 'requirement', 'experience', 'education', 'skill', 'claim']), ...fact.shape }).strict()).max(100),
  missingFields: z.array(z.string()).max(30), warnings: z.array(z.string()).max(30),
}).strict();

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException({ code: 'INVALID_INPUT', fieldErrors: parsed.error.flatten() });
  return parsed.data;
}
