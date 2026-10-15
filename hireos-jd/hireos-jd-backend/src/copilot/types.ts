import { z } from 'zod';

/** Public salary range, same shape as the JD editor's `MoneyRange` (e.g. 15000–25000 CNY / month, gross). */
export const compensationSchema = z
  .object({
    min: z.number().nonnegative().nullable(),
    max: z.number().nonnegative().nullable(),
    currency: z.string().trim().min(1).max(8),
    period: z.enum(['hour', 'month', 'year']),
    basis: z.enum(['gross', 'net']).optional(),
  })
  .strict()
  .refine((range) => range.min !== null || range.max !== null, { message: 'Provide min or max.' });

export const jdFieldsSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
    location: z.string().trim().min(1).optional(),
    employmentType: z.string().trim().min(1).optional(),
    headcount: z.number().int().positive().optional(),
    roleSummary: z.string().trim().min(1).optional(),
    responsibilities: z.array(z.string().trim().min(1)).optional(),
    mustHave: z.array(z.string().trim().min(1)).optional(),
    niceToHave: z.array(z.string().trim().min(1)).optional(),
    publicCompensation: compensationSchema.optional(),
    // Optional internal sections of the editor template (business problem, expected outcomes, success criteria).
    businessProblem: z.string().trim().min(1).optional(),
    expectedOutcomes: z.array(z.string().trim().min(1)).optional(),
    successCriteria: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export type JdFields = z.infer<typeof jdFieldsSchema>;

/**
 * What the model returns is not trusted to match the schema exactly: unknown keys (e.g. a made-up `salary`)
 * are dropped and a malformed salary range is ignored, instead of failing the whole turn.
 */
const llmListSchema = z.preprocess(
  // Models sometimes return a list field as one string; split it into items instead of failing the turn.
  (value) =>
    typeof value === 'string'
      ? value.split(/\r?\n/).map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)、])\s*/, '').trim()).filter(Boolean)
      : value,
  z.array(z.string().trim().min(1)).optional(),
);

const llmFieldsSchema = jdFieldsSchema
  .extend({
    responsibilities: llmListSchema,
    mustHave: llmListSchema,
    niceToHave: llmListSchema,
    expectedOutcomes: llmListSchema,
    successCriteria: llmListSchema,
    publicCompensation: compensationSchema.optional().catch(undefined),
  })
  .strip()
  // A caught (dropped) value must not leave an explicit `undefined` that would overwrite a saved field on merge.
  .transform((fields) => Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as JdFields);

export const llmTurnResultSchema = z
  .object({
    reply: z.string().trim().min(1),
    phase: z.enum(['intake', 'ready_to_confirm']),
    fields: llmFieldsSchema,
    missingFields: z.array(z.string()),
  })
  .strict();

export type LlmTurnResult = z.infer<typeof llmTurnResultSchema>;

export const sendMessageInputSchema = z
  .object({
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export function computeMissingFields(fields: JdFields): string[] {
  const missing: string[] = [];
  if (!fields.title) missing.push('title');
  if (!fields.roleSummary) missing.push('roleSummary');
  if (!fields.responsibilities || fields.responsibilities.length < 2) missing.push('responsibilities');
  if (!fields.mustHave || fields.mustHave.length < 2) missing.push('mustHave');
  return missing;
}

/** Optional user turn for auto-complete — e.g. the Quick Start answers — instead of the bare "自动补全" trigger. */
/** Quick Start (M1): everything the user has answered so far for the three questions. */
export const quickStartInputSchema = z
  .object({
    answers: z.string().trim().min(1).max(4000),
  })
  .strict();

export const autoCompleteInputSchema = z
  .object({
    text: z.string().trim().min(1).max(4000).optional(),
  })
  .strict();

/** "Paste a link or text": exactly one of a job posting URL or the full JD text. */
export const importSourceInputSchema = z
  .object({
    url: z.string().trim().url().max(2000).optional(),
    text: z.string().trim().min(20).max(20000).optional(),
  })
  .strict()
  .refine((input) => Boolean(input.url) !== Boolean(input.text), { message: 'Provide either url or text.' });

export const refineDraftInputSchema = z
  .object({
    note: z.string().trim().min(1).max(2000),
  })
  .strict();

export const refineVariantsInputSchema = z
  .object({
    note: z.string().trim().min(1).max(2000),
    variants: z
      .array(
        z
          .object({
            key: z.string().trim().min(1).max(40),
            label: z.string().trim().min(1).max(40),
            description: z.string().trim().max(200),
            fields: jdFieldsSchema,
          })
          .strict(),
      )
      .min(1)
      .max(3),
  })
  .strict();

export const titleVariantsInputSchema = z
  .object({
    // Digits or symbols alone (`123`, `???`) are not a job title; `CFO`, `3D 设计师` are (#75).
    title: z.string().trim().min(1).max(120).regex(/\p{L}/u, 'A job title needs at least one letter.'),
  })
  .strict();

/** Fields the user authored or picked directly (manual form, a chosen title variant) — no LLM turn. */
export const MAX_JOB_TITLE_LENGTH = 200;

export const setFieldsInputSchema = z
  .object({
    // Core Record caps a job title at 200 characters; refuse a longer one here as a field error (#90).
    fields: jdFieldsSchema.refine((fields) => !fields.title || fields.title.length <= MAX_JOB_TITLE_LENGTH, {
      message: `Job title can be at most ${MAX_JOB_TITLE_LENGTH} characters.`,
      path: ['title'],
    }),
    // The label echoes the title ("Create Manually: <title>"), so it must fit a full-length title.
    label: z.string().trim().min(1).max(MAX_JOB_TITLE_LENGTH + 200),
  })
  .strict();

/** The bar for user-authored fields: a manual JD can skip the summary and ship with a single bullet. */
export function computeMissingAuthoredFields(fields: JdFields): string[] {
  const missing: string[] = [];
  if (!fields.title) missing.push('title');
  if (!fields.responsibilities || fields.responsibilities.length < 1) missing.push('responsibilities');
  if (!fields.mustHave || fields.mustHave.length < 1) missing.push('mustHave');
  return missing;
}
