import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../persistence/prisma.service';

/**
 * Which claimable background job to run next, taking workspaces in turn (#389). Each worker used to take the
 * oldest job of any workspace, so one workspace's bulk import made every other workspace wait for all of it.
 * Now the workspace served longest ago goes first, and its oldest job is taken: another workspace's job waits
 * for at most one job of each workspace ahead of it. Turns are kept per worker in this process, which is the
 * deployment today (one instance); a restart just starts the turns afresh.
 */
export class FairQueue {
  private readonly lastServed = new Map<string, number>();
  private turn = 0;

  async next(db: Pick<PrismaService, 'processingJob'>, where: Prisma.ProcessingJobWhereInput) {
    const heads = await db.processingJob.groupBy({ by: ['workspaceId'], where, _min: { createdAt: true } });
    if (!heads.length) return null;
    const served = (workspaceId: string) => this.lastServed.get(workspaceId) ?? -1;
    const [head] = heads.sort(
      (a, b) => served(a.workspaceId) - served(b.workspaceId) || (a._min.createdAt?.getTime() ?? 0) - (b._min.createdAt?.getTime() ?? 0),
    );
    const job = await db.processingJob.findFirst({ where: { ...where, workspaceId: head.workspaceId }, orderBy: { createdAt: 'asc' } });
    if (job) this.lastServed.set(head.workspaceId, ++this.turn);
    return job;
  }
}
