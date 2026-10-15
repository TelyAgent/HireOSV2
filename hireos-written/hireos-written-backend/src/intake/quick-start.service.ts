import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core-record/core-record.client';
import { JdContentFacade, formatJdText } from '../core-record/jd-content.facade';
import { PrismaService } from '../persistence/prisma.service';
import { upsertCaseWithTask } from './case-intake';
import { checkUpload, extractText, type UploadedFile } from './text-extraction';
import { invalidSchemaFromZod } from '../http/invalid-schema';

// One job (new JD text -- optionally with the Core material it was read from -- or an existing
// Core Record job) + one résumé = one written-test case. Unlike Interview, the résumé is required:
// a case is a (candidate, job) pair, so a job alone has nothing to show in Written.
const quickStartSchema = z.object({
  jd: z.union([
    z.object({ text: z.string().trim().min(1).max(150000), materialId: z.string().trim().min(1).max(200).optional() }).strict(),
    z.object({ coreJobId: z.string().trim().min(1).max(200) }).strict(),
  ]),
  resumeMaterialId: z.string().trim().min(1).max(200),
}).strict();

/**
 * The "New written test" entry. New JD text goes to the JD subsystem (which creates the job in
 * Core Record and dedupes identical JDs -- `duplicate` tells the UI to say so); an existing job is
 * picked from Core Record. The résumé's Core candidate + application are registered, and the case
 * lands in the same starting state a screening hand-off gives it. Mirrors hireos-interview's
 * QuickStartService.
 */
@Injectable()
export class QuickStartService {
  constructor(
    private readonly db: PrismaService,
    private readonly coreRecord: CoreRecordClient,
    private readonly jdContent: JdContentFacade,
  ) {}

  /** Stores the file in Core Record and returns its text, so the UI can preview a JD or check a résumé. */
  async upload(identity: Identity, file?: UploadedFile) {
    const { name, mime } = checkUpload(file);
    const core = await this.coreRecord.uploadMaterial(identity, { buffer: file!.buffer, originalname: name, mimetype: mime });
    const { text, errorCode } = await extractText(name, file!.buffer);
    return { id: core.id, name, text, readStatus: errorCode ? 'failed' : 'available', errorCode };
  }

  /** Published jobs only for "choose an existing job" -- a draft is still being written in JD. */
  searchJobs(identity: Identity, query?: string) {
    return this.coreRecord.listJobs(identity, query, 'open');
  }

  async start(identity: Identity, raw: unknown, idempotencyKey?: string) {
    const parsed = quickStartSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const input = parsed.data;

    // Read the résumé before anything is created upstream, so a bad file doesn't leave a JD behind.
    const resumeMeta = await this.coreRecord.getMaterial(identity, input.resumeMaterialId);
    const resume = await extractText(resumeMeta.name, await this.coreRecord.downloadMaterialContent(identity, input.resumeMaterialId));
    if (resume.errorCode) throw new BadRequestException({ code: 'MATERIAL_NOT_AVAILABLE' });

    let coreJobId: string;
    let duplicate = false;
    if ('coreJobId' in input.jd) {
      coreJobId = input.jd.coreJobId;
      // Only a published job can be picked; a draft is still being written in JD.
      const picked = await this.coreRecord.getJob(identity, coreJobId);
      if (picked.status !== 'open') throw new ConflictException({ code: 'JOB_NOT_PUBLISHED', status: picked.status });
    } else {
      const key = idempotencyKey?.trim() || randomUUID();
      const created = await this.jdContent.createFromText(identity, { text: input.jd.text, coreMaterialId: input.jd.materialId }, `written.quick-start:${key}`);
      coreJobId = created.coreJobId;
      duplicate = created.duplicate;
    }

    const coreJob = await this.coreRecord.getJob(identity, coreJobId);
    const content = await this.jdContent.get(identity, coreJobId);
    const jdText = content ? formatJdText(content, coreJob.title) : coreJob.title;
    const placeholderName = resumeMeta.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().slice(0, 200) || 'Unnamed candidate';
    // Resolved by the résumé file, so a résumé Interview or Screening already saw keeps its candidate.
    const coreCandidate = await this.coreRecord.resolveCandidateForMaterial(identity, { materialId: input.resumeMaterialId, displayName: placeholderName, source: 'written' });
    const application = await this.coreRecord.createApplication(identity, {
      candidateId: coreCandidate.id, jobId: coreJobId, origin: 'written_quick_start', linkReason: 'Résumé linked to the job in Written',
    }, `written:application:${coreCandidate.id}:${coreJobId}`);

    const result = await this.db.$transaction(async (tx) => {
      const job = await tx.job.upsert({
        where: { workspaceId_coreJobId: { workspaceId: identity.workspaceId, coreJobId } },
        create: { workspaceId: identity.workspaceId, coreJobId, title: coreJob.title, department: coreJob.team, location: coreJob.location, level: coreJob.seniority, jdText },
        update: { title: coreJob.title, department: coreJob.team, location: coreJob.location, level: coreJob.seniority, jdText },
      });
      const candidate = await tx.candidate.upsert({
        where: { workspaceId_coreCandidateId: { workspaceId: identity.workspaceId, coreCandidateId: coreCandidate.id } },
        create: { workspaceId: identity.workspaceId, coreCandidateId: coreCandidate.id, name: coreCandidate.displayName },
        update: {},
      });
      const ids = await upsertCaseWithTask(tx, {
        workspaceId: identity.workspaceId, candidateId: candidate.id, jobId: job.id, candidateName: candidate.name,
        create: { coreMaterialId: input.resumeMaterialId, resumeText: resume.text, coreApplicationId: application.id, origin: 'quick_start' },
        update: { coreApplicationId: application.id },
      });
      return { ...ids, jobTitle: job.title, candidateName: candidate.name };
    });
    return { ...result, duplicate };
  }
}
