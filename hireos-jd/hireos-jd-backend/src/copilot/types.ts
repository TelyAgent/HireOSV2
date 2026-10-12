import { z } from 'zod';

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
  })
  .strict();

export type JdFields = z.infer<typeof jdFieldsSchema>;

export const llmTurnResultSchema = z
  .object({
    reply: z.string().trim().min(1),
    phase: z.enum(['intake', 'ready_to_confirm']),
    fields: jdFieldsSchema,
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
    title: z.string().trim().min(1).max(120),
  })
  .strict();

/** Fields the user authored or picked directly (manual form, a chosen title variant) — no LLM turn. */
export const setFieldsInputSchema = z
  .object({
    fields: jdFieldsSchema,
    label: z.string().trim().min(1).max(200),
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
