import { PrismaService } from '../persistence/prisma.service';

// The project flow, in order. A stage is unlocked only once every stage before it is done,
// so each page can rely on its predecessors instead of re-checking their conditions.
export const STAGE_ORDER = ['overview', 'rubric', 'plan', 'schedule', 'brief', 'live', 'review', 'debrief', 'decision', 'package'] as const;
export type Stage = (typeof STAGE_ORDER)[number];
export type StageState = { stage: Stage; done: boolean; unlocked: boolean; needsRepair?: boolean; repairCode?: string };

/**
 * What finishes each stage:
 * - rubric:   the job has a confirmed rubric version
 * - plan:     "Confirm interview plan" (task.planConfirmedAt) with a confirmed rubric
 * - schedule: at least one round has a meeting time after plan confirmation
 * - brief:    interview questions exist for the confirmed rubric
 * - live:     at least one round is completed
 * - review:   "Continue to debrief" (task.reviewConfirmedAt)
 * - debrief:  "Continue to decision" (task.debriefConfirmedAt)
 * - decision: a decision is recorded
 * A stage also counts as done when any later stage is — work already past it never
 * gets locked again (e.g. rounds completed before brief questions were ever generated).
 */
export async function taskStages(db: PrismaService, workspaceId: string, taskId: string): Promise<StageState[]> {
  const task = await db.interviewTask.findFirstOrThrow({ where: { id: taskId, workspaceId },
    select: { jobId: true, planConfirmedAt: true, reviewConfirmedAt: true, debriefConfirmedAt: true, decision: true,
      rounds: { select: { scheduledAt: true, status: true } } } });
  const rubric = await db.rubricVersion.findFirst({ where: { workspaceId, jobId: task.jobId, status: 'confirmed' },
    orderBy: { versionNumber: 'desc' }, select: { id: true, versionNumber: true } });
  const rubricConfirmed = !!rubric;
  const hasScheduledRound = task.rounds.some((r) => r.scheduledAt != null);
  const hasCompletedRound = task.rounds.some((r) => r.status === 'completed');
  // Older records can contain plan/schedule timestamps without a confirmed rubric. Keep
  // those records visible, but stop presenting them as a healthy completed flow.
  const needsRepair = !rubricConfirmed && (task.planConfirmedAt != null || hasScheduledRound || hasCompletedRound);
  const briefReady = rubricConfirmed && (
    await db.interviewQuestion.count({ where: { rubricVersionId: rubric.id } }) > 0
    || await db.parseJob.count({ where: { workspaceId, jobId: task.jobId, type: 'brief_questions', inputVersion: rubric.versionNumber, status: 'needs_review' } }) > 0
  );

  const own: Record<Stage, boolean> = {
    overview: true,
    rubric: rubricConfirmed,
    plan: rubricConfirmed && task.planConfirmedAt != null,
    // A completed round is evidence that scheduling happened even for older records
    // whose meeting timestamp was not backfilled. Brief questions alone are not.
    schedule: rubricConfirmed && task.planConfirmedAt != null && (hasScheduledRound || hasCompletedRound),
    brief: briefReady,
    live: rubricConfirmed && task.planConfirmedAt != null && hasCompletedRound,
    review: task.reviewConfirmedAt != null,
    debrief: task.debriefConfirmedAt != null,
    decision: task.decision != null,
    package: false,
  };
  const done = STAGE_ORDER.map((s) => own[s]);
  if (!needsRepair) {
    for (let i = done.length - 2; i >= 0; i--) {
      // Do not infer that a round was scheduled merely because brief questions
      // exist. Live must remain locked until an actual round is scheduled.
      if (STAGE_ORDER[i] === 'schedule') continue;
      done[i] = done[i] || done[i + 1];
    }
  }
  return STAGE_ORDER.map((stage, i) => ({
    stage,
    done: done[i],
    // Package is a read-only preview and remains reachable before a decision or both sign-offs;
    // publication is still controlled by the package API.
    unlocked: stage === 'package' ? done.slice(0, i - 1).every(Boolean) : done.slice(0, i).every(Boolean),
    ...(needsRepair ? { needsRepair: true, repairCode: 'RUBRIC_NOT_CONFIRMED' } : {}),
  }));
}
