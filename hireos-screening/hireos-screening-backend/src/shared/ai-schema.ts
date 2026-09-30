import { z } from 'zod';

// Length limits on AI output are storage/display budgets, not correctness checks: a resume
// that lists 50 skills is still a valid parse. Rejecting the whole response over one
// over-long field threw away every other field with it (a failed parse leaves the
// candidate with a blank profile), so these trim to the limit instead of failing.

export function cappedString(max: number) {
  return z.string().transform((value) => (value.length > max ? value.slice(0, max) : value));
}

export function cappedArray<T extends z.ZodType>(item: T, max: number) {
  return z.array(item).transform((items) => items.slice(0, max));
}
