import type { Logger } from '@nestjs/common';

/**
 * Runs one round of a background poll so that nothing it throws leaves it (#116). A database or network error in
 * a timer callback would otherwise be an unhandled rejection, which ends the whole process under Node's default
 * policy. The error is logged — its name and a short message, never the event or job data — and the next round
 * runs as usual.
 */
export async function guardedPoll(logger: Pick<Logger, 'error'>, poll: string, round: () => Promise<unknown>): Promise<void> {
  try {
    await round();
  } catch (error) {
    logger.error(`${poll} poll failed: ${describe(error)}`);
  }
}

/** "PrismaClientKnownRequestError: Can't reach database server…" — the kind of error and the start of its message. */
export function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message.replace(/\s+/g, ' ').slice(0, 300)}`;
  return String(error).slice(0, 300);
}
