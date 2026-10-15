import { z } from 'zod';
import { invalidSchemaFromZod } from '../http/invalid-schema';

export const criteriaSchema = z.object({
  requirements: z.array(z.object({
    id: z.string().min(1),
    label: z.string().trim().min(1).max(500),
    dimension: z.string().min(1),
    priority: z.enum(['must_have', 'nice_to_have']),
    hard: z.boolean(),
    kind: z.enum(['authorization', 'experience', 'skill', 'other']),
  })).max(100),
  dimensions: z.array(z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1).max(200),
    weight: z.number().min(0).max(1),
    rubric: z.string().trim().min(1).max(2000),
  })).min(3).max(8),
}).strict();

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw invalidSchemaFromZod(parsed.error);
  }
  return parsed.data;
}

export type CriteriaInput = z.infer<typeof criteriaSchema>;
