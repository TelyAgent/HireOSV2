import { z } from 'zod';
import { invalidSchemaFromZod } from '../http/invalid-schema';

export const importChannelSchema = z.enum(['manual_upload', 'email', 'folder', 'api']);

export const pasteCandidateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().email().max(320).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional(),
  notes: z.string().max(5000).optional(),
  // Added from a job's screening workspace: auto-match only against this job.
  jobId: z.string().trim().min(1).max(100).optional(),
}).strict();

export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw invalidSchemaFromZod(parsed.error);
  }
  return parsed.data;
}
