import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { describe, guardedPoll } from '../shared/guarded-poll';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 10;
// After this many failed attempts, stop retrying automatically -- a human can requeue
// (reset status to 'pending') once whatever was wrong with Interview is fixed.
const MAX_ATTEMPTS = 10;
// One delivery may take this long before it counts as a failed attempt (#384); HANDOFF_DISPATCH_TIMEOUT_MS overrides.
const DEFAULT_TIMEOUT_MS = 10_000;
// A failed event waits 5 s, 10 s, 20 s ... (at most 10 minutes) before its next attempt (#384).
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 10 * 60_000;
// How long a claimed event is this dispatcher's (#385): longer than a delivery's deadline, so it only lapses when
// the dispatcher died mid-send, and then another dispatcher sends it again (receivers are idempotent).
const LEASE_MS = 60_000;

type Target = { baseUrlEnvKey: string; baseUrlDefault: string; endpoint: string };
// Each destination is dispatched on its own, so a slow one holds up only its own events (#384).
const TARGETS: Record<string, Target> = {
  'candidate.advanced_to_interview': { baseUrlEnvKey: 'INTERVIEW_BASE_URL', baseUrlDefault: 'http://127.0.0.1:3001/api', endpoint: '/screening-handoff' },
  'candidate.assessment_requested': { baseUrlEnvKey: 'WRITTEN_BASE_URL', baseUrlDefault: 'http://127.0.0.1:3008/api', endpoint: '/intake/screening-handoff' },
};

/** Events a dispatcher may claim: pending and due, or left `sending` by a dispatcher whose lease ran out. */
function claimable(now: Date): Prisma.ScreeningOutboxEventWhereInput {
  return {
    OR: [
      { status: 'pending', OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
      { status: 'sending', leaseUntil: { lt: now } },
    ],
  };
}

export function retryDelayMs(attempt: number) {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempt - 1), BACKOFF_MAX_MS);
}

/**
 * Delivers ScreeningOutboxEvent rows to whichever subsystem needs to know about them --
 * despite the class name (kept to avoid an unrelated rename churning this file), it now
 * routes more than one event type/destination via `TARGETS`: "advanced_to_interview"
 * goes to hireos-interview, "assessment_requested" goes to hireos-written. This is the
 * "transport" half of the outbox pattern described in
 * docs/HireOS-Database-Architecture-Decision.md §7/§9 -- plain HTTP today because no
 * real event bus (Redis Streams etc.) is deployed yet. The event envelope this writes
 * (stable ids + a summary) is the same one a real event bus would carry, so swapping
 * the delivery mechanism later never requires changing DecisionsService or the
 * receiving endpoints, only this dispatcher.
 *
 * Polling with a lease, like DiscoveryService/ImportsService: an event is claimed (pending -> sending, with a
 * lease token) before it is sent and settled only by the claim's holder, so two dispatchers -- two instances --
 * never both send it, and one that died mid-send leaves it to be claimed again when the lease runs out (#385).
 */
@Injectable()
export class InterviewHandoffDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InterviewHandoffDispatcherService.name);
  private timer?: ReturnType<typeof globalThis.setInterval>;
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.timer = globalThis.setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) globalThis.clearInterval(this.timer);
  }

  /** One round; never rejects, so a failing database can't end the process (#116). */
  tick() {
    return guardedPoll(this.logger, 'Interview/assessment handoff', () => this.dispatchPending());
  }

  private async dispatchPending() {
    if (this.running) return;
    this.running = true;
    try {
      const eventTypes = Object.keys(TARGETS);
      // One queue per destination, plus the events nothing subscribes to; the queues run side by side.
      await Promise.all([...eventTypes.map((type) => ({ eventType: type })), { eventType: { notIn: eventTypes } }].map((where) => this.dispatchQueue(where)));
    } finally {
      this.running = false;
    }
  }

  private async dispatchQueue(where: { eventType: string | { notIn: string[] } }) {
    const now = new Date();
    const events = await this.db.screeningOutboxEvent.findMany({
      where: { ...where, attempt: { lt: MAX_ATTEMPTS }, ...claimable(now) },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });
    for (const event of events) {
      // One event's failure — even failing to record that it failed — doesn't stop the others (#116).
      try {
        // Claimed first (#385): of two dispatchers that read the same event, only one sends it.
        const leaseToken = randomUUID();
        const { count } = await this.db.screeningOutboxEvent.updateMany({
          where: { id: event.id, ...claimable(new Date()) },
          data: { status: 'sending', leaseToken, leaseUntil: new Date(Date.now() + LEASE_MS) },
        });
        if (count !== 1) continue;
        await this.dispatchOne(event, leaseToken);
      } catch (error) {
        this.logger.error(`Handoff event ${event.id} (${event.eventType}) could not be dispatched or its failure recorded: ${describe(error)}`);
      }
    }
  }

  private async dispatchOne(event: { id: string; workspaceId: string; eventType: string; payload: unknown; attempt: number }, leaseToken: string) {
    const settle = (data: Prisma.ScreeningOutboxEventUpdateManyMutationInput) =>
      this.db.screeningOutboxEvent.updateMany({ where: { id: event.id, leaseToken }, data: { ...data, leaseToken: null, leaseUntil: null } });
    const target = TARGETS[event.eventType];
    if (!target) {
      // No receiver registered for this event type -- not a delivery failure, just
      // nothing subscribes to it (yet). Mark dispatched so it stops being polled.
      await settle({ status: 'dispatched', dispatchedAt: new Date() });
      return;
    }
    const baseUrl = this.config.get<string>(target.baseUrlEnvKey, target.baseUrlDefault).replace(/\/$/, '');
    try {
      const response = await globalThis.fetch(`${baseUrl}${target.endpoint}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-source-service': 'screening',
          'x-workspace-id': event.workspaceId,
          ...(process.env.SERVICE_TOKEN ? { 'x-hireos-service-token': process.env.SERVICE_TOKEN } : {}),
        },
        body: JSON.stringify(event.payload),
        signal: AbortSignal.timeout(Number(this.config.get<string>('HANDOFF_DISPATCH_TIMEOUT_MS', String(DEFAULT_TIMEOUT_MS)))),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await settle({ status: 'dispatched', dispatchedAt: new Date() });
    } catch (error) {
      const attempt = event.attempt + 1;
      const message = error instanceof Error ? error.message.slice(0, 500) : 'DISPATCH_FAILED';
      this.logger.warn(`Failed to dispatch ${event.eventType} (${event.id}), attempt ${attempt}: ${message}`);
      await settle({ attempt, status: attempt >= MAX_ATTEMPTS ? 'failed' : 'pending', lastError: message, nextAttemptAt: new Date(Date.now() + retryDelayMs(attempt)) });
    }
  }
}
