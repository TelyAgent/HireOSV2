/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { jobRequiresAssessment } from '../jobs/jobs.service';
import type { Identity } from '../auth/workspace.guard';

const OUTCOMES = ['strong_advance', 'advance', 'hold', 'do_not_advance', 'request_information'];
const TARGETS = ['record_only', 'send_assessment', 'move_to_interview'];

@Injectable()
export class DecisionsService {
  constructor(private readonly db: PrismaService) {}

  async record(identity: Identity, applicationId: string, raw: {
    outcome?: string;
    reason?: string;
    nextStepTarget?: string;
    overrideAi?: boolean;
    exceptionApproved?: boolean;
  }) {
    if (!OUTCOMES.includes(raw.outcome || '') || !TARGETS.includes(raw.nextStepTarget || '') || !raw.reason?.trim()) {
      throw new BadRequestException({ code: 'INVALID_DECISION' });
    }
    const application = await this.db.application.findFirst({
      where: { id: applicationId, workspaceId: identity.workspaceId },
      include: {
        job: true,
        candidate: { include: { resumeVersions: { where: { isLatest: true }, take: 1, include: { material: true } } } },
      },
    });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    const currentEvaluation = await this.db.screeningEvaluation.findFirst({
      where: { applicationId, workspaceId: identity.workspaceId, freshness: 'current' },
      orderBy: { version: 'desc' },
    });
    if (raw.nextStepTarget === 'move_to_interview' && application.job.criteriaStatus !== 'confirmed') {
      throw new ConflictException({ code: 'CRITERIA_NOT_CONFIRMED' });
    }
    const requiresAssessment = jobRequiresAssessment(application.job);
    if (
      requiresAssessment &&
      raw.nextStepTarget === 'move_to_interview' &&
      application.assessmentStatus !== 'completed' &&
      !raw.exceptionApproved
    ) {
      throw new ConflictException({ code: 'ASSESSMENT_REQUIRED', message: 'Required assessment is missing — request an exception to proceed' });
    }
    const existing = await this.db.screeningDecision.findFirst({
      where: { applicationId, workspaceId: identity.workspaceId, status: 'approved' },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      // Belt-and-suspenders: if an earlier run recorded the decision but this
      // step never ran (e.g. deployed after the decision was made), close the
      // task now rather than leaving it stuck open forever.
      await this.completeScreeningTask(identity, applicationId, existing.id);
      return { decision: serializeDecision(existing) };
    }
    const decision = await this.db.$transaction(async (tx) => {
      const created = await tx.screeningDecision.create({
        data: {
          workspaceId: identity.workspaceId,
          applicationId,
          jobId: application.jobId,
          evaluationId: currentEvaluation?.id,
          outcome: raw.outcome!,
          reason: raw.reason!.trim(),
          actorId: identity.actorId,
          overrideAi: Boolean(raw.overrideAi),
          nextStepTarget: raw.nextStepTarget!,
          exceptionRef: raw.exceptionApproved ? `exception:${applicationId}:${Date.now()}` : null,
          policyRef: `job:${application.jobId}:criteria:${application.job.criteriaVersion}`,
        },
      });
      if (raw.exceptionApproved) {
        await tx.decisionExceptionApproval.createMany({
          data: [
            { workspaceId: identity.workspaceId, decisionId: created.id, role: 'hr', actorId: identity.actorId, reason: 'Local development exception approval.' },
            { workspaceId: identity.workspaceId, decisionId: created.id, role: 'hiring_manager', actorId: identity.actorId, reason: 'Local development exception approval.' },
          ],
        });
      }
      await tx.application.update({
        where: { id: applicationId },
        data: { screeningStatus: 'decided' },
      });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'screening_decision_recorded',
          objectType: 'ScreeningDecision',
          objectId: created.id,
          payload: json({ applicationId, evaluationId: currentEvaluation?.id || null, outcome: raw.outcome, nextStepTarget: raw.nextStepTarget }),
        },
      });
      // Recording a decision *is* what "screening_review" was waiting on -- close the loop
      // here so the task never has to be marked done by hand. A still-open
      // "screening_evaluation_issue" task is closed the same way: recording a decision
      // despite an AI hiccup is still a human resolving the situation, not a system
      // superseding it, so it counts as completed too.
      await tx.humanTask.updateMany({
        where: { workspaceId: identity.workspaceId, applicationId, taskType: { in: ['screening_review', 'screening_evaluation_issue'] }, status: { notIn: ['completed', 'cancelled'] } },
        data: { status: 'completed', completedAt: new Date(), completionRef: created.id },
      });
      // "Move to interview" is a fact Interview needs to know about. Written in this
      // same transaction so the decision and the announcement of it can never disagree
      // (see docs/HireOS-Database-Architecture-Decision.md §7/§9 -- Screening owns this
      // event, a background dispatcher delivers it, Interview upserts by Core Record id).
      if (raw.nextStepTarget === 'move_to_interview') {
        await tx.screeningOutboxEvent.create({
          data: {
            workspaceId: identity.workspaceId,
            eventType: 'candidate.advanced_to_interview',
            aggregateId: applicationId,
            payload: json({
              coreJobId: application.jobId,
              coreCandidateId: application.candidateId,
              jobTitle: application.job.title,
              jobDepartment: application.job.team || undefined,
              jobLocation: application.job.location || undefined,
              jobLevel: application.job.seniority || undefined,
              jdText: application.job.jdText || undefined,
              candidateName: application.candidate.displayName,
              candidateEmail: application.candidate.email || undefined,
              candidatePhone: application.candidate.phone || undefined,
              // A stable reference, not the file itself (see screeningHandoffSchema's
              // comment on the receiving end) -- only set once that résumé's own Material
              // has been registered with Core Record (CORE_RECORD_MODE=remote); in mock
              // mode Interview just won't get a résumé automatically, same as before.
              coreMaterialId: application.candidate.resumeVersions[0]?.material.coreMaterialId || undefined,
              matchScore: currentEvaluation?.overallScore != null ? Math.round(currentEvaluation.overallScore) : undefined,
              matchRecommendation: mapMatchRecommendation(raw.outcome!),
            }),
          },
        });
      }
      // "Send assessment" is the same kind of fact for Written Test as "move to interview" is
      // for Interview — same outbox table, same payload shape, just a different eventType and
      // downstream consumer (see WrittenHandoffDispatcherService / hireos-written-backend's
      // /api/intake/screening-handoff, which upserts a Candidate/Job/Case/Task by these ids).
      if (raw.nextStepTarget === 'send_assessment') {
        await tx.screeningOutboxEvent.create({
          data: {
            workspaceId: identity.workspaceId,
            eventType: 'candidate.assessment_requested',
            aggregateId: applicationId,
            payload: json({
              coreJobId: application.jobId,
              coreCandidateId: application.candidateId,
              jobTitle: application.job.title,
              jobDepartment: application.job.team || undefined,
              jobLocation: application.job.location || undefined,
              jobLevel: application.job.seniority || undefined,
              jdText: application.job.jdText || undefined,
              candidateName: application.candidate.displayName,
              candidateEmail: application.candidate.email || undefined,
              candidatePhone: application.candidate.phone || undefined,
              coreMaterialId: application.candidate.resumeVersions[0]?.material.coreMaterialId || undefined,
              // Written Test's AI question generator needs the actual resume text (unlike
              // Interview, which only needs a pointer to the file) -- Screening already has it
              // extracted locally (see MaterialsService.saveUpload), so it rides along in this
              // one-time handoff rather than requiring Written to fetch it back from Screening.
              resumeText: application.candidate.resumeVersions[0]?.material.text?.slice(0, 12000) || undefined,
              matchScore: currentEvaluation?.overallScore != null ? Math.round(currentEvaluation.overallScore) : undefined,
              matchRecommendation: mapMatchRecommendation(raw.outcome!),
            }),
          },
        });
      }
      return created;
    });
    // The handoff itself is the outbox event above; there is no separate "delivery package" any more.
    return { decision: serializeDecision(decision) };
  }

  /**
   * Withdraws the active decision so a new one can be made (issue #23). Only possible while its
   * handoff hasn't reached Interview / Written yet: once that event is dispatched the candidate and
   * task already exist downstream and have to be handled there. The withdrawn decision is kept
   * (status `withdrawn` + who / when / why) as history; the screening task reopens.
   */
  async withdraw(identity: Identity, applicationId: string, decisionId: string, raw: { reason?: string }) {
    const reason = (raw.reason || '').trim();
    if (!reason) throw new BadRequestException({ code: 'WITHDRAW_REASON_REQUIRED', message: 'Explain why the decision is being withdrawn.' });
    if (reason.length > 2000) throw new BadRequestException({ code: 'WITHDRAW_REASON_TOO_LONG' });

    const decision = await this.db.screeningDecision.findFirst({ where: { id: decisionId, applicationId, workspaceId: identity.workspaceId } });
    if (!decision) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (decision.status !== 'approved') throw new ConflictException({ code: 'DECISION_NOT_ACTIVE', message: 'This decision is no longer in effect.' });

    // The handoff for this decision was written in the same transaction as the decision itself.
    const handoffs = await this.db.screeningOutboxEvent.findMany({
      where: {
        workspaceId: identity.workspaceId,
        aggregateId: applicationId,
        eventType: { in: ['candidate.advanced_to_interview', 'candidate.assessment_requested'] },
        createdAt: { gte: decision.createdAt },
      },
    });
    const sent = handoffs.find((event) => event.status === 'dispatched');
    if (sent) {
      throw new ConflictException({
        code: 'HANDOFF_ALREADY_SENT',
        target: sent.eventType === 'candidate.assessment_requested' ? 'written' : 'interview',
        message: 'This decision has already been handed off and can only be handled in the receiving subsystem.',
      });
    }

    const application = await this.db.application.findFirst({ where: { id: applicationId, workspaceId: identity.workspaceId } });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    const hasEvaluation = await this.db.screeningEvaluation.count({ where: { workspaceId: identity.workspaceId, applicationId } });
    const now = new Date();

    const withdrawn = await this.db.$transaction(async (tx) => {
      // Conditional: a concurrent withdraw (or a second click) can't apply twice.
      const updated = await tx.screeningDecision.updateMany({
        where: { id: decision.id, status: 'approved' },
        data: { status: 'withdrawn', withdrawnAt: now, withdrawnBy: identity.actorId, withdrawReason: reason },
      });
      if (updated.count !== 1) throw new ConflictException({ code: 'DECISION_NOT_ACTIVE', message: 'This decision is no longer in effect.' });
      // Only undelivered handoffs are cancelled; the dispatcher only picks up `pending` ones.
      const cancelled = await tx.screeningOutboxEvent.updateMany({
        where: { id: { in: handoffs.map((event) => event.id) }, status: { in: ['pending', 'failed'] } },
        data: { status: 'cancelled', lastError: 'Decision withdrawn before handoff' },
      });
      if (cancelled.count !== handoffs.length) {
        throw new ConflictException({ code: 'HANDOFF_IN_PROGRESS', message: 'The handoff is being sent right now — try again in a moment.' });
      }
      await tx.application.update({ where: { id: applicationId }, data: { screeningStatus: hasEvaluation ? 'review_pending' : 'not_started' } });
      await tx.humanTask.updateMany({
        where: { workspaceId: identity.workspaceId, applicationId, completionRef: decision.id, taskType: { in: ['screening_review', 'screening_evaluation_issue'] } },
        data: { status: 'open', completedAt: null, completionRef: null },
      });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'screening_decision_withdrawn',
          objectType: 'ScreeningDecision',
          objectId: decision.id,
          payload: json({ applicationId, reason, outcome: decision.outcome, nextStepTarget: decision.nextStepTarget, cancelledHandoffs: cancelled.count }),
        },
      });
      return tx.screeningDecision.findUniqueOrThrow({ where: { id: decision.id } });
    });
    return { decision: serializeDecision(withdrawn) };
  }

  async sendDeclineNotice(identity: Identity, applicationId: string) {
    const application = await this.db.application.findFirst({ where: { id: applicationId, workspaceId: identity.workspaceId } });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.auditRecord.create({
      data: {
        workspaceId: identity.workspaceId,
        actorId: identity.actorId,
        action: 'candidate_decline_notice_requested',
        objectType: 'Application',
        objectId: applicationId,
        payload: json({ communication: 'decline_notice', explicit: true }),
      },
    });
    return { status: 'succeeded', applicationId };
  }

  async completeAssessment(identity: Identity, applicationId: string) {
    const application = await this.db.application.findFirst({
      where: { id: applicationId, workspaceId: identity.workspaceId },
    });
    if (!application) throw new NotFoundException({ code: 'NOT_FOUND' });
    const updated = await this.db.application.update({
      where: { id: applicationId },
      data: { assessmentStatus: 'completed' },
    });
    return { applicationId: updated.id, assessmentStatus: updated.assessmentStatus };
  }

  private async completeScreeningTask(identity: Identity, applicationId: string, decisionId: string) {
    await this.db.humanTask.updateMany({
      where: { workspaceId: identity.workspaceId, applicationId, taskType: { in: ['screening_review', 'screening_evaluation_issue'] }, status: { notIn: ['completed', 'cancelled'] } },
      data: { status: 'completed', completedAt: new Date(), completionRef: decisionId },
    });
  }
}

export function serializeDecision(decision: any) {
  return {
    id: decision.id,
    applicationId: decision.applicationId,
    outcome: decision.outcome,
    reason: decision.reason,
    decidedBy: decision.actorId,
    decidedAt: decision.createdAt.toISOString(),
    status: decision.status,
    overrideAi: decision.overrideAi,
    nextStepTarget: decision.nextStepTarget,
    exceptionRef: decision.exceptionRef || undefined,
    withdrawnAt: decision.withdrawnAt ? decision.withdrawnAt.toISOString() : undefined,
    withdrawnBy: decision.withdrawnBy || undefined,
    withdrawReason: decision.withdrawReason || undefined,
  };
}

function json(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

// Interview's InterviewTask.matchRecommendation is a free string (comment: strong_match |
// match | weak_match) with no shared enum -- this is Screening's side of that informal
// contract, derived from the human's own decision outcome rather than re-deriving it from
// the AI evaluation, since the human's call is what actually sent the candidate onward.
function mapMatchRecommendation(outcome: string): string {
  if (outcome === 'strong_advance') return 'strong_match';
  if (outcome === 'advance') return 'match';
  return 'weak_match';
}
