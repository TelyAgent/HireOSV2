import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../persistence/prisma.service';
import { CoreRecordClient } from '../core-record/core-record.client';
import { JdContentFacade } from '../core-record/jd-content.facade';
import { quickStartSchema, validate } from './contracts';
import { JobsService } from './jobs.service';
import { TasksService } from './tasks.service';
import type { Identity } from './workspace.guard';

/**
 * The "New interview project" entry. New JD text goes to the JD subsystem (which creates
 * the job in Core Record and dedupes identical JDs -- `duplicate` tells the UI to say so);
 * an existing job is picked from Core Record. Either way the job is then synced locally
 * through JobsService.attach, and the résumé, if any, becomes a task via TasksService.create
 * (which registers the Core candidate + application). Nothing here creates a Job locally
 * without a Core Record id.
 */
@Injectable()
export class QuickStartService {
  constructor(
    private readonly db: PrismaService,
    private readonly jdContent: JdContentFacade,
    private readonly coreRecord: CoreRecordClient,
    private readonly jobs: JobsService,
    private readonly tasks: TasksService,
  ) {}

  async start(identity: Identity, raw: unknown, idempotencyKey?: string) {
    const input = validate(quickStartSchema, raw);
    // Check the résumé before anything is created upstream, so a bad file doesn't leave a JD behind.
    if (input.resumeMaterialId) {
      const resume = await this.db.material.findFirst({ where: { id: input.resumeMaterialId, workspaceId: identity.workspaceId } });
      if (!resume) throw new NotFoundException({ code: 'NOT_FOUND' });
      if (resume.readStatus !== 'available') throw new BadRequestException({ code: 'MATERIAL_NOT_AVAILABLE' });
    }

    let coreJobId: string;
    let duplicate = false;
    if ('coreJobId' in input.jd) {
      coreJobId = input.jd.coreJobId;
      // Only a published job can be picked; a draft is still being written in JD.
      const picked = await this.coreRecord.getJob(identity, coreJobId);
      if (picked.status !== 'open') throw new ConflictException({ code: 'JOB_NOT_PUBLISHED', status: picked.status });
    } else {
      let coreMaterialId: string | undefined;
      if (input.jd.materialId) {
        const file = await this.db.material.findFirst({ where: { id: input.jd.materialId, workspaceId: identity.workspaceId } });
        if (!file) throw new NotFoundException({ code: 'NOT_FOUND' });
        coreMaterialId = file.coreMaterialId ?? undefined;
      }
      const key = idempotencyKey?.trim() || randomUUID();
      const created = await this.jdContent.createFromText(identity, { text: input.jd.text, coreMaterialId }, `interview.quick-start:${key}`);
      coreJobId = created.coreJobId;
      duplicate = created.duplicate;
    }

    const job = await this.jobs.attach(identity, { coreJobId });
    const task = input.resumeMaterialId
      ? await this.tasks.create(identity, job.id, { materialId: input.resumeMaterialId }, 'quick_start')
      : null;
    return { job, duplicate, task };
  }
}
