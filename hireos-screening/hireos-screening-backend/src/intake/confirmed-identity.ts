import { z } from 'zod';

/**
 * What the user confirmed when pasting a résumé (#160 #167): the name is required, email and location are as
 * the user left them. Stored on the Material, it wins over what parsing reads from the text — for the
 * candidate, duplicate checks and the profile — so a name is never taken from an email address.
 */
export type ConfirmedIdentity = { displayName: string; email?: string | null; location?: string | null };

const confirmedIdentitySchema = z.object({
  displayName: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320).nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
});

/** The paste request: the text, and what the user confirmed in the preview. */
export const pasteImportSchema = z
  .object({
    text: z.string().trim().min(20, 'Paste the full resume text.').max(150_000),
    displayName: z.string().trim().min(1, 'Name is required.').max(200),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(320)]).optional(),
    location: z.string().trim().max(200).optional(),
  })
  .strict();

export const pastePreviewSchema = z.object({ text: z.string().trim().min(1).max(150_000) }).strict();

export function confirmedIdentityOf(material: { confirmedIdentity?: unknown } | null | undefined): ConfirmedIdentity | null {
  const parsed = confirmedIdentitySchema.safeParse(material?.confirmedIdentity);
  return parsed.success ? parsed.data : null;
}
