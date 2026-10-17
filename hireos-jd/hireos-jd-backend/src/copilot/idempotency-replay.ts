import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { requestHash, type RequestMeta } from '../records';

/**
 * Copilot idempotency (#142). A request's row used to hold the whole conversation as it was then, so every turn
 * stored every earlier message again and storage grew with the square of the conversation's length. A row now
 * holds a reference: a replay returns the conversation as it is now. Rows are kept 24 hours -- enough for a
 * client's retries -- and an expired key is a new request.
 */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
// The Quick Start reads its earlier runs to collect the answers so far, so its rows stay until it is done.
const KEPT_OPERATION_PREFIX = 'copilot.quick-start:';

type Db = Prisma.TransactionClient | PrismaService;
type Row = { id: string; requestHash: string; responseBody: unknown; createdAt: Date };

export function isExpired(row: { createdAt: Date }, now = Date.now()) {
  return now - row.createdAt.getTime() > IDEMPOTENCY_TTL_MS;
}

/** The stored row for this key, or null when there is none or it has expired (the expired one is removed). */
export async function liveRun(db: Db, identity: Identity, operation: string, key: string): Promise<Row | null> {
  const row = await db.idempotencyKey.findUnique({ where: { workspaceId_operation_key: { workspaceId: identity.workspaceId, operation, key } } });
  if (!row) return null;
  if (isExpired(row) && !operation.startsWith(KEPT_OPERATION_PREFIX)) {
    await db.idempotencyKey.deleteMany({ where: { id: row.id } });
    return null;
  }
  return row;
}

/** `findIdempotent` from records.ts, with expired rows treated as absent. */
export async function findLiveIdempotent(tx: Prisma.TransactionClient, identity: Identity, operation: string, meta: RequestMeta, input: unknown) {
  const key = meta.idempotencyKey?.trim();
  if (!key) throw new ConflictException({ code: 'IDEMPOTENCY_KEY_REQUIRED' });
  const hash = requestHash(input);
  const prior = await liveRun(tx, identity, operation, key);
  if (prior && prior.requestHash !== hash) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT' });
  return { key, hash, prior };
}

/** What a request stores in place of its response: which conversation, its phase then, and a refine's answer. */
export function replayRef(result: { id: string; phase: string; answer?: unknown }) {
  return { replay: 'conversation', id: result.id, phase: result.phase, ...(result.answer ? { answer: result.answer } : {}) };
}

/** Removes Copilot rows past their 24 hours, once an hour. */
@Injectable()
export class CopilotIdempotencyRetention implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CopilotIdempotencyRetention.name);
  private timer?: ReturnType<typeof globalThis.setInterval>;

  constructor(private readonly db: PrismaService) {}

  onModuleInit() {
    this.timer = globalThis.setInterval(() => void this.purge(), 60 * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) globalThis.clearInterval(this.timer);
  }

  /** Never rejects: a failed clean-up is retried within the hour. */
  async purge(now = Date.now()): Promise<number> {
    try {
      const { count } = await this.db.idempotencyKey.deleteMany({
        where: {
          operation: { startsWith: 'copilot.' },
          NOT: { operation: { startsWith: KEPT_OPERATION_PREFIX } },
          createdAt: { lt: new Date(now - IDEMPOTENCY_TTL_MS) },
        },
      });
      return count;
    } catch (error) {
      this.logger.warn(`Copilot idempotency clean-up failed: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }
}
