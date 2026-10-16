import { BadGatewayException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';

/**
 * Case.status state machine -- the one place every transition is written:
 *
 *   linked (待测试)
 *     -> invited (已发送测试)              invitation sent
 *     -> awaiting_submission (待提交)      candidate opened the link
 *     -> review_pending (待审核结果)       candidate submitted
 *     -> finalized (待发布结果)            reviewer finalized the scoring
 *     -> released (待处理后续)             result published; HR still has to decide what's next
 *     -> handed_off (已转面试)             interview task created in hireos-interview   [terminal]
 *     -> closed (已结束)                   testing ended: passed / rejected / withdrawn [terminal]
 *   any non-terminal <-> on_hold (已暂缓)  statusBeforeHold remembers where to resume
 *
 * Progress events that arrive while a case is on hold (e.g. the candidate submits) move
 * statusBeforeHold instead, so resuming lands on the up-to-date status. Terminal cases ignore them.
 * The case's Task is only completed on a terminal status -- a released result still needs a decision.
 *
 * Every write here is conditional on the status it moves from (#119 #131): a progress event moves the case only
 * from the statuses listed in ADVANCES_FROM, in one UPDATE, so a case that was closed or handed off meanwhile is
 * never written back to an earlier status, and an event that arrives late (an invitation opened after the answers
 * came in) never moves it backwards. Closing and handing off complete the Task in the same transaction (#118).
 */
export const TERMINAL_STATUSES = ['handed_off', 'closed'];

/** The statuses each progress event may move a case from. A new round's invitation may follow any open status. */
export const ADVANCES_FROM: Record<string, string[]> = {
  invited: ['linked', 'invited', 'awaiting_submission', 'review_pending', 'finalized', 'released'],
  awaiting_submission: ['invited'],
  review_pending: ['invited', 'awaiting_submission'],
  finalized: ['review_pending'],
  released: ['finalized'],
};

/** The database, or the transaction a progress event is part of. */
type Db = PrismaService | Prisma.TransactionClient;
export const CLOSE_REASONS = ['passed', 'rejected', 'withdrawn'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

@Injectable()
export class CaseLifecycleService {
  private readonly logger = new Logger(CaseLifecycleService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * A progress event (invite sent / opened / submitted / finalized / released), part of the caller's transaction
   * when given one. Moves the case only from the statuses this event may follow — on hold, its remembered status
   * moves instead — and does nothing otherwise (terminal, or already further along). Returns whether it moved.
   */
  async advance(caseId: string, next: string, db: Db = this.db): Promise<boolean> {
    const from = ADVANCES_FROM[next] ?? [];
    const moved = await db.case.updateMany({ where: { id: caseId, status: { in: from } }, data: { status: next } });
    if (moved.count) return true;
    const held = await db.case.updateMany({
      where: { id: caseId, status: 'on_hold', OR: [{ statusBeforeHold: { in: from } }, ...(from.includes('linked') ? [{ statusBeforeHold: null }] : [])] },
      data: { statusBeforeHold: next },
    });
    return held.count > 0;
  }

  /**
   * Locks the case row until the transaction ends, so a submission or a new round and a close of the same case
   * take turns: whichever commits first is what the other one sees (#130).
   */
  async lockCase(tx: Prisma.TransactionClient, caseId: string): Promise<{ status: string } | null> {
    const rows = await tx.$queryRaw<{ status: string }[]>`SELECT status FROM "Case" WHERE id = ${caseId} FOR UPDATE`;
    return rows[0] ?? null;
  }

  private async completeTask(caseId: string, db: Db = this.db) {
    await db.task.updateMany({ where: { caseId, status: { not: 'completed' } }, data: { status: 'completed' } });
  }

  /** The case as it is now, for a response after a conditional write. */
  private async current(caseId: string) {
    return this.db.case.findUniqueOrThrow({ where: { id: caseId } });
  }

  private async findCase(identity: Identity, caseId: string) {
    const kase = await this.db.case.findFirst({
      where: { id: caseId, workspaceId: identity.workspaceId },
      include: { candidate: true, job: true },
    });
    if (!kase) throw new NotFoundException({ code: 'CASE_NOT_FOUND' });
    return kase;
  }

  private serialize(kase: { status: string; statusBeforeHold: string | null; closeReason: string | null; closedAt: Date | null; handedOffAt: Date | null; interviewTaskId: string | null }) {
    return {
      status: kase.status,
      statusBeforeHold: kase.statusBeforeHold,
      closeReason: kase.closeReason,
      closedAt: kase.closedAt?.toISOString() ?? null,
      handedOffAt: kase.handedOffAt?.toISOString() ?? null,
      interviewTaskId: kase.interviewTaskId,
    };
  }

  /** Round state of a case (#48): how many rounds were sent and whether a draft round is open. */
  async roundState(identity: Identity, caseId: string) {
    const kase = await this.findCase(identity, caseId);
    const [roundsSent, draftItems, latest] = await Promise.all([
      this.db.invitation.count({ where: { caseId, workspaceId: identity.workspaceId } }),
      this.db.planItem.count({ where: { caseId, workspaceId: identity.workspaceId, invitationId: null } }),
      this.db.invitation.findFirst({ where: { caseId, workspaceId: identity.workspaceId }, orderBy: { round: 'desc' }, include: { submission: true } }),
    ]);
    const hasDraft = roundsSent === 0 || kase.draftRoundOpen || draftItems > 0;
    // A supplemental round follows a finished one: the previous round must be scored and finalized.
    const latestFinalized = !latest || !!latest.submission?.finalizedAt;
    return {
      roundsSent,
      draftRound: hasDraft ? { round: roundsSent + 1, items: draftItems } : null,
      canOpenRound: !TERMINAL_STATUSES.includes(kase.status) && !hasDraft && latestFinalized,
    };
  }

  /**
   * "Add supplemental test": opens the next round as a draft (#48). Idempotent -- with a draft
   * already open it just returns it, so there is never more than one (AC-3).
   */
  async openDraftRound(identity: Identity, caseId: string) {
    const kase = await this.findCase(identity, caseId);
    if (TERMINAL_STATUSES.includes(kase.status)) throw new ConflictException({ code: 'CASE_ENDED', status: kase.status });
    const state = await this.roundState(identity, caseId);
    if (state.draftRound) return state; // already open -- never a second draft
    if (!state.canOpenRound) throw new ConflictException({ code: 'ROUND_IN_PROGRESS', message: 'Finalize the current round before adding a supplemental test.' });
    await this.db.case.update({ where: { id: caseId }, data: { draftRoundOpen: true } });
    return this.roundState(identity, caseId);
  }

  /** Cancels an opened supplemental round that has no questions yet. */
  async discardDraftRound(identity: Identity, caseId: string) {
    await this.findCase(identity, caseId);
    const draftItems = await this.db.planItem.count({ where: { caseId, workspaceId: identity.workspaceId, invitationId: null } });
    if (draftItems > 0) throw new ConflictException({ code: 'DRAFT_ROUND_NOT_EMPTY', message: 'Remove its questions first.' });
    await this.db.case.update({ where: { id: caseId }, data: { draftRoundOpen: false } });
    return this.roundState(identity, caseId);
  }

  // Hold and resume read and write the status in one UPDATE (#131): a progress event landing in between can't be
  // lost, and the status remembered for resuming is the one the case actually had.
  async hold(identity: Identity, caseId: string) {
    await this.findCase(identity, caseId);
    const held = await this.db.$executeRaw`
      UPDATE "Case" SET "statusBeforeHold" = status, status = 'on_hold', "updatedAt" = now()
      WHERE id = ${caseId} AND status NOT IN ('on_hold', 'handed_off', 'closed')`;
    const kase = await this.current(caseId);
    if (!held) throw new ConflictException({ code: 'CANNOT_HOLD', status: kase.status });
    return this.serialize(kase);
  }

  async resume(identity: Identity, caseId: string) {
    await this.findCase(identity, caseId);
    const resumed = await this.db.$executeRaw`
      UPDATE "Case" SET status = COALESCE("statusBeforeHold", 'linked'), "statusBeforeHold" = NULL, "updatedAt" = now()
      WHERE id = ${caseId} AND status = 'on_hold'`;
    const kase = await this.current(caseId);
    if (!resumed) throw new ConflictException({ code: 'NOT_ON_HOLD', status: kase.status });
    return this.serialize(kase);
  }

  async close(identity: Identity, caseId: string, reason: CloseReason) {
    await this.findCase(identity, caseId);
    // Closing and completing the task are one step (#118), and only an open case closes (#131).
    const closed = await this.db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: { notIn: TERMINAL_STATUSES } },
        data: { status: 'closed', statusBeforeHold: null, closeReason: reason, closedAt: new Date() },
      });
      if (count) await this.completeTask(caseId, tx);
      return count > 0;
    });
    const kase = await this.current(caseId);
    if (!closed) throw new ConflictException({ code: 'ALREADY_ENDED', status: kase.status });
    return this.serialize(kase);
  }

  /**
   * Creates (or, idempotently, re-finds) the candidate's interview task in hireos-interview via its
   * existing hand-off intake -- the same endpoint Screening's "move to interview" decision is
   * delivered to, which upserts Job/Candidate/InterviewTask by their Core Record ids. Called
   * synchronously so HR sees right away whether it worked; nothing changes here if it fails.
   */
  async handoffToInterview(identity: Identity, caseId: string) {
    const kase = await this.findCase(identity, caseId);
    if (kase.status !== 'released') throw new ConflictException({ code: 'NOT_RELEASED', status: kase.status });

    const baseUrl = this.config.get<string>('INTERVIEW_BASE_URL', 'http://127.0.0.1:3001/api').replace(/\/$/, '');
    const payload = {
      coreJobId: kase.job.coreJobId,
      coreCandidateId: kase.candidate.coreCandidateId,
      jobTitle: kase.job.title,
      jobDepartment: kase.job.department ?? undefined,
      jobLocation: kase.job.location ?? undefined,
      jobLevel: kase.job.level ?? undefined,
      jdText: kase.job.jdText ?? undefined,
      candidateName: kase.candidate.name,
      candidateEmail: kase.candidate.email ?? undefined,
      candidatePhone: kase.candidate.phone ?? undefined,
      coreMaterialId: kase.coreMaterialId ?? undefined,
      matchScore: kase.matchScore ?? undefined,
      matchRecommendation: kase.matchRecommendation ?? undefined,
    };

    let interviewTaskId: string;
    try {
      const response = await globalThis.fetch(`${baseUrl}/screening-handoff`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-source-service': 'written',
          'x-workspace-id': identity.workspaceId,
          'x-actor-id': identity.actorId,
          ...(this.config.get<string>('SERVICE_TOKEN') ? { 'x-hireos-service-token': this.config.get<string>('SERVICE_TOKEN') as string } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      const body = (await response.json()) as { taskId?: string };
      if (!body.taskId) throw new Error('Interview did not return a taskId');
      interviewTaskId = body.taskId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'INTERVIEW_HANDOFF_FAILED';
      this.logger.warn(`Interview handoff failed for case ${caseId}: ${message}`);
      throw new BadGatewayException({ code: 'INTERVIEW_HANDOFF_FAILED', message });
    }

    // Only a case still released is handed off, together with completing its task (#118 #131). If it changed
    // meanwhile the interview task already exists; Interview's intake is idempotent, so a retry finds it again.
    const handedOff = await this.db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: 'released' },
        data: { status: 'handed_off', statusBeforeHold: null, handedOffAt: new Date(), interviewTaskId },
      });
      if (count) await this.completeTask(caseId, tx);
      return count > 0;
    });
    const after = await this.current(caseId);
    if (!handedOff) throw new ConflictException({ code: 'CASE_CHANGED', status: after.status, message: 'This case changed while it was being handed off. Refresh and try again.' });
    return this.serialize(after);
  }
}
