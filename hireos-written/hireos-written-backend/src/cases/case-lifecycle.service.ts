import { BadGatewayException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
 */
export const TERMINAL_STATUSES = ['handed_off', 'closed'];
export const CLOSE_REASONS = ['passed', 'rejected', 'withdrawn'] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

@Injectable()
export class CaseLifecycleService {
  private readonly logger = new Logger(CaseLifecycleService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** A progress event (invite sent / opened / submitted / finalized / released). */
  async advance(caseId: string, next: string) {
    const kase = await this.db.case.findUnique({ where: { id: caseId } });
    if (!kase || TERMINAL_STATUSES.includes(kase.status)) return;
    const data = kase.status === 'on_hold' ? { statusBeforeHold: next } : { status: next };
    await this.db.case.update({ where: { id: caseId }, data });
  }

  private async completeTask(caseId: string) {
    await this.db.task.updateMany({ where: { caseId, status: { not: 'completed' } }, data: { status: 'completed' } });
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

  async hold(identity: Identity, caseId: string) {
    const kase = await this.findCase(identity, caseId);
    if (kase.status === 'on_hold' || TERMINAL_STATUSES.includes(kase.status)) throw new ConflictException({ code: 'CANNOT_HOLD', status: kase.status });
    const updated = await this.db.case.update({ where: { id: caseId }, data: { status: 'on_hold', statusBeforeHold: kase.status } });
    return this.serialize(updated);
  }

  async resume(identity: Identity, caseId: string) {
    const kase = await this.findCase(identity, caseId);
    if (kase.status !== 'on_hold') throw new ConflictException({ code: 'NOT_ON_HOLD', status: kase.status });
    const updated = await this.db.case.update({ where: { id: caseId }, data: { status: kase.statusBeforeHold ?? 'linked', statusBeforeHold: null } });
    return this.serialize(updated);
  }

  async close(identity: Identity, caseId: string, reason: CloseReason) {
    const kase = await this.findCase(identity, caseId);
    if (TERMINAL_STATUSES.includes(kase.status)) throw new ConflictException({ code: 'ALREADY_ENDED', status: kase.status });
    const updated = await this.db.case.update({
      where: { id: caseId },
      data: { status: 'closed', statusBeforeHold: null, closeReason: reason, closedAt: new Date() },
    });
    await this.completeTask(caseId);
    return this.serialize(updated);
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
        headers: { 'content-type': 'application/json' },
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

    const updated = await this.db.case.update({
      where: { id: caseId },
      data: { status: 'handed_off', statusBeforeHold: null, handedOffAt: new Date(), interviewTaskId },
    });
    await this.completeTask(caseId);
    return this.serialize(updated);
  }
}
