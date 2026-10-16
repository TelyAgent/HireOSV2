import { BadRequestException, Injectable, Logger, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { requirementProblem } from './requirement-policy';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { criteriaSchema, validate, type CriteriaInput } from './contracts';
import { CoreRecordClient } from '../core-record/core-record.client';
import { JobCriteriaFacade, type RemoteCriteriaProjection } from './job-criteria.facade';
import { invalidSchemaFromZod } from '../http/invalid-schema';

const DEFAULT_DIMENSIONS = [
  { id: 'dim-skills', name: 'Skills', weight: 0.25, rubric: 'How closely the candidate skills match the role.' },
  { id: 'dim-relexp', name: 'Relevant Experience', weight: 0.25, rubric: 'How closely prior work maps to the role.' },
  { id: 'dim-seniority', name: 'Seniority', weight: 0.25, rubric: 'Whether the candidate level matches the role.' },
  { id: 'dim-complocation', name: 'Compensation & Location Fit', weight: 0.25, rubric: 'Whether the salary expectation and the work location (country + city) fit the role.' },
];

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly coreRecord: CoreRecordClient,
    private readonly criteriaFacade: JobCriteriaFacade,
  ) {}

  async list(identity: Identity) {
    await this.syncPublishedJobs(identity);
    // Jobs are created and published in HireOS JD; Screening only lists the published ones.
    const jobs = await this.db.job.findMany({
      where: { workspaceId: identity.workspaceId, status: 'open' },
      orderBy: { createdAt: 'desc' },
      include: { criteriaVersions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    const funnels = await this.jobFunnels(identity.workspaceId, jobs.map((job) => job.id));
    return jobs.map((job) => ({ ...toFrontendJob(job), funnel: funnels.get(job.id) }));
  }

  /**
   * Per-job funnel for the jobs list, counted in people (not files):
   * Resumes (candidates actually evaluated against the job, plus anyone already matched/linked) → Matched (live AI recommendation, incl. already linked)
   * → Linked (an Application exists). Each stage is a subset of the previous one.
   */
  private async jobFunnels(workspaceId: string, jobIds: string[]) {
    const [evaluations, recs, applications] = await Promise.all([
      this.db.preLinkMatchEvaluation.findMany({
        where: { workspaceId, jobId: { in: jobIds } },
        distinct: ['candidateId', 'jobId'],
        select: { candidateId: true, jobId: true },
      }),
      this.db.candidateJobRecommendation.findMany({
        where: { workspaceId, jobId: { in: jobIds }, status: { in: ['proposed', 'deferred', 'confirmed'] } },
        select: { candidateId: true, jobId: true, status: true },
      }),
      this.db.application.findMany({ where: { workspaceId, jobId: { in: jobIds } }, select: { candidateId: true, jobId: true } }),
    ]);
    const allIds = [...new Set([...evaluations.map((e) => e.candidateId), ...recs.map((r) => r.candidateId), ...applications.map((a) => a.candidateId)])];
    const versions = await this.db.resumeVersion.findMany({
      where: { workspaceId, candidateId: { in: allIds } },
      select: { candidateId: true, isLatest: true, version: true, uploadedAt: true, material: { select: { sourceType: true } } },
    });
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const resumeInfo = new Map<string, { source: string; version: number; isLatest: boolean; today: boolean }>();
    for (const v of versions) {
      const prev = resumeInfo.get(v.candidateId);
      const today = (prev?.today ?? false) || v.uploadedAt >= startOfToday;
      const better = !prev || (v.isLatest && !prev.isLatest) || (v.isLatest === prev.isLatest && v.version > prev.version);
      resumeInfo.set(v.candidateId, better
        ? { source: v.material?.sourceType || 'manual_upload', version: v.version, isLatest: v.isLatest, today }
        : { ...prev, today });
    }

    const result = new Map<string, { resumes: number; matched: number; linked: number; pending: number; today: number; sources: Array<{ source: string; count: number }> }>();
    for (const jobId of jobIds) {
      const linked = new Set(applications.filter((a) => a.jobId === jobId).map((a) => a.candidateId));
      const jobRecs = recs.filter((r) => r.jobId === jobId);
      const matched = new Set([...linked, ...jobRecs.map((r) => r.candidateId)]);
      const pending = new Set(jobRecs.filter((r) => r.status === 'proposed' && !linked.has(r.candidateId)).map((r) => r.candidateId));
      const evaluated = evaluations.filter((e) => e.jobId === jobId).map((e) => e.candidateId);
      const pool = new Set([...evaluated, ...matched]);
      const sources = new Map<string, number>();
      let today = 0;
      for (const id of pool) {
        const info = resumeInfo.get(id);
        if (!info) continue;
        sources.set(info.source, (sources.get(info.source) || 0) + 1);
        if (info.today) today++;
      }
      result.set(jobId, {
        resumes: pool.size,
        matched: matched.size,
        linked: linked.size,
        pending: pending.size,
        today,
        sources: [...sources.entries()].sort((a, b) => b[1] - a[1]).map(([source, count]) => ({ source, count })),
      });
    }
    return result;
  }

  /**
   * Jobs published in HireOS JD live in Core Record (status `open`); Screening keeps its own Job
   * rows (keyed by the Core Record id), so pull in any published job it doesn't have yet and keep
   * already-mirrored jobs' title and status in step with Core Record — an unpublished (draft) or
   * closed job drops out of the list and out of matching. A Core Record outage only skips the sync —
   * the last mirrored state is still returned.
   */
  private async syncPublishedJobs(identity: Identity) {
    let coreJobs: Awaited<ReturnType<CoreRecordClient['listJobs']>>;
    try {
      coreJobs = await this.coreRecord.listJobs(identity);
    } catch (error) {
      this.logger.warn(`Skipping Core Record job sync: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    await this.archiveDeletedJobs(identity, coreJobs.map((job) => job.id));
    if (!coreJobs.length) return;
    const local = await this.db.job.findMany({
      where: { workspaceId: identity.workspaceId, id: { in: coreJobs.map((job) => job.id) } },
      select: { id: true, title: true, status: true, origin: true, team: true, location: true, employmentType: true, seniority: true, openings: true },
    });
    const localById = new Map(local.map((job) => [job.id, job]));

    for (const core of coreJobs) {
      const existing = localById.get(core.id);
      if (existing) {
        await this.syncFromCore(existing, core);
        continue;
      }
      if (core.status !== 'open') continue;

      // Seed the job's JD text and draft criteria from the JD subsystem's content for this job.
      let content: RemoteCriteriaProjection | null = null;
      try {
        content = await this.criteriaFacade.get(identity, core.id);
      } catch (error) {
        this.logger.warn(`No JD content for job ${core.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await this.createLocalJob(identity, {
        id: core.id, title: core.title, team: core.team, location: core.location, employmentType: core.employmentType,
        seniority: core.seniority, openings: core.openings, status: core.status, origin: 'jd_published',
        jdText: content ? formatJdText(core.title, content) : null,
      }, content);
    }
  }

  /**
   * A job deleted in HireOS JD disappears from Core Record entirely, so the status sync above never
   * sees it. Archive any still-listed local job missing from Core Record's directory — checked one by
   * one, since the directory is capped and absence from it alone doesn't prove deletion.
   */
  private async archiveDeletedJobs(identity: Identity, coreIds: string[]) {
    const missing = await this.db.job.findMany({
      where: { workspaceId: identity.workspaceId, status: 'open', id: { notIn: coreIds } },
      select: { id: true, origin: true },
    });
    for (const { id, origin } of missing) {
      try {
        const core = await this.coreRecord.getJob(identity, id);
        await this.db.job.update({ where: { id }, data: { status: core ? screeningStatus(core.status, origin) : 'archived' } });
      } catch (error) {
        this.logger.warn(`Could not check Core Record job ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Screening's "New job" entry: the pasted JD becomes a draft job in HireOS JD + Core Record (JD
   * has AI read it first -- title, location, requirements -- and dedupes an identical JD), and Screening starts using
   * it right away as a quick_start job -- no one has to publish it in JD first, since Screening
   * can be sold and used on its own. Its criteria are reviewed and confirmed here, as for any job.
   */
  /**
   * Step one of "New job" (#178): the model reads the JD and suggests title, team and location for the
   * recruiter to check; nothing is created. A JD already used opens its job instead.
   */
  async quickStartPreview(identity: Identity, raw: unknown) {
    const parsed = z.object({ text: z.string().trim().min(1).max(150000) }).strict().safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    if (!this.criteriaFacade.isRemote()) {
      // Mock mode (no JD service): nothing reads the JD, so the recruiter types title and team.
      return { title: '', team: null, location: null, duplicateOf: null };
    }
    return this.criteriaFacade.previewFromText(identity, parsed.data.text);
  }

  async quickStart(identity: Identity, raw: unknown, idempotencyKey?: string) {
    const parsed = quickStartSchema.safeParse(raw);
    // Title and team are required and checked one by one, before anything is created (#178 AC-1).
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const { text, title: confirmedTitle, team: confirmedTeam } = parsed.data;
    if (!this.criteriaFacade.isRemote()) {
      // Mock mode (no Core Record / JD): a local-only job, as before Core Record existed.
      const id = randomUUID();
      await this.createLocalJob(identity, { id, title: confirmedTitle, team: confirmedTeam, jdText: text, origin: 'quick_start', status: 'open' }, null);
      return { job: await this.get(identity, id), duplicate: false };
    }
    const created = await this.criteriaFacade.createFromText(identity, text, `screening.quick-start:${idempotencyKey?.trim() || randomUUID()}`, { title: confirmedTitle, team: confirmedTeam });
    const existing = await this.db.job.findFirst({ where: { id: created.coreJobId, workspaceId: identity.workspaceId } });
    if (existing) {
      // Already in Screening (published earlier, or created here before). A job that went back to
      // draft in JD is adopted as Screening's own again; paused/closed/archived stay as they are.
      if (existing.status === 'draft') {
        await this.db.job.update({ where: { id: existing.id }, data: { status: 'open', origin: 'quick_start' } });
      }
      return { job: await this.get(identity, existing.id), duplicate: created.duplicate };
    }
    const core = await this.coreRecord.getJob(identity, created.coreJobId);
    if (!core) throw new NotFoundException({ code: 'NOT_FOUND' });
    let content: RemoteCriteriaProjection | null = null;
    try {
      content = await this.criteriaFacade.get(identity, core.id);
    } catch (error) {
      this.logger.warn(`No JD content yet for job ${core.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await this.createLocalJob(identity, {
      id: core.id, title: core.title, team: core.team, location: core.location, employmentType: core.employmentType,
      seniority: core.seniority, openings: core.openings, jdText: created.jdText, origin: 'quick_start',
      status: screeningStatus(core.status, 'quick_start'),
    }, content);
    return { job: await this.get(identity, core.id), duplicate: created.duplicate };
  }

  private async createLocalJob(
    identity: Identity,
    job: { id: string; title: string; team?: string; location?: string; employmentType?: string; seniority?: string; openings?: number; jdText: string | null; origin: string; status: string },
    content: RemoteCriteriaProjection | null,
  ) {
    await this.db.$transaction(async (tx) => {
      await tx.job.create({
        data: {
          id: job.id,
          workspaceId: identity.workspaceId,
          title: job.title,
          team: job.team || 'Unassigned',
          location: job.location || 'Unspecified',
          employmentType: job.employmentType || 'Unspecified',
          seniority: job.seniority || 'Unspecified',
          status: job.status,
          origin: job.origin,
          openings: job.openings || 1,
          jdText: job.jdText,
        },
      });
      await tx.jobCriteriaVersion.create({
        data: {
          workspaceId: identity.workspaceId,
          jobId: job.id,
          version: 0,
          requirements: content ? toScreeningRequirements(content.requirements, DEFAULT_DIMENSIONS) : [],
          dimensions: DEFAULT_DIMENSIONS,
        },
      });
    });
  }

  /** Title, status and the descriptive fields follow Core Record -- e.g. edits made in HireOS JD. */
  private async syncFromCore(
    existing: { id: string; title: string; status: string; origin: string; team: string; location: string; employmentType: string; seniority: string; openings: number },
    core: { title: string; status: string; team?: string; location?: string; employmentType?: string; seniority?: string; openings?: number },
  ) {
    const synced = {
      title: core.title,
      status: screeningStatus(core.status, existing.origin),
      team: core.team || 'Unassigned',
      location: core.location || 'Unspecified',
      employmentType: core.employmentType || 'Unspecified',
      seniority: core.seniority || 'Unspecified',
      openings: core.openings || 1,
    };
    if ((Object.keys(synced) as (keyof typeof synced)[]).some((key) => existing[key] !== synced[key])) {
      await this.db.job.update({ where: { id: existing.id }, data: synced });
      return true;
    }
    return false;
  }

  async get(identity: Identity, id: string) {
    const job = await this.db.job.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { criteriaVersions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    const remoteCriteria = await this.criteriaFacade.get(identity, id);
    return toFrontendJob(job, remoteCriteria ? normalizeRemoteCriteria(remoteCriteria, job.criteriaVersions[0]?.dimensions) : undefined);
  }

  async updateCriteria(identity: Identity, id: string, raw: unknown) {
    const input = validate(criteriaSchema, raw);
    assertAllowedRequirements(input.requirements);
    const job = await this.find(identity.workspaceId, id);
    if (job.criteriaStatus === 'confirmed') {
      throw new BadRequestException({ code: 'CRITERIA_CONFIRMED', message: 'Reopen criteria before editing.' });
    }
    if (this.criteriaFacade.isRemote()) {
      const remote = await this.criteriaFacade.update(identity, id, input);
      await this.syncRemoteCriteria(identity.workspaceId, id, remote);
      return this.get(identity, id);
    }
    await this.db.jobCriteriaVersion.update({
      where: { id: job.criteriaVersions[0].id },
      data: { requirements: input.requirements, dimensions: input.dimensions },
    });
    return this.get(identity, id);
  }

  async confirmCriteria(identity: Identity, id: string, actorId: string) {
    const job = await this.find(identity.workspaceId, id);
    const draft = job.criteriaVersions[0];
    const input = criteriaSchema.parse({
      requirements: asArray(draft.requirements),
      dimensions: asArray(draft.dimensions),
    }) as CriteriaInput;
    // Checked again at confirmation: a draft written before this rule, or by another path, can't be confirmed (#179).
    assertAllowedRequirements(input.requirements);
    const weightSum = input.dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
    if (Math.abs(weightSum - 1) > 0.001) {
      throw new BadRequestException({ code: 'WEIGHTS_NOT_100' });
    }
    if (this.criteriaFacade.isRemote()) {
      const remote = await this.criteriaFacade.confirm(identity, id, input);
      await this.syncRemoteCriteria(identity.workspaceId, id, remote);
      return this.get(identity, id);
    }
    const confirmedAt = new Date();
    const confirmedVersion = draft.version === 0 ? 1 : draft.version;
    await this.db.$transaction([
      this.db.jobCriteriaVersion.update({
        where: { id: draft.id },
        data: { version: confirmedVersion, status: 'confirmed', confirmedBy: actorId, confirmedAt },
      }),
      this.db.job.update({
        where: { id: job.id },
        data: { criteriaStatus: 'confirmed', criteriaVersion: confirmedVersion, confirmedBy: actorId, confirmedAt },
      }),
    ]);
    return this.get(identity, id);
  }

  async reopenCriteria(identity: Identity, id: string) {
    const job = await this.find(identity.workspaceId, id);
    if (job.criteriaStatus !== 'confirmed') return this.get(identity, id);
    if (this.criteriaFacade.isRemote()) {
      const remote = await this.criteriaFacade.reopen(identity, id);
      await this.syncRemoteCriteria(identity.workspaceId, id, remote);
      return this.get(identity, id);
    }
    const current = job.criteriaVersions[0];
    await this.db.$transaction([
      this.db.jobCriteriaVersion.create({
        data: {
          workspaceId: identity.workspaceId,
          jobId: job.id,
          version: job.criteriaVersion + 1,
          status: 'draft',
          requirements: asArray(current.requirements),
          dimensions: asArray(current.dimensions),
        },
      }),
      this.db.job.update({
        where: { id: job.id },
        data: { criteriaStatus: 'draft' },
      }),
    ]);
    return this.get(identity, id);
  }

  private async syncRemoteCriteria(workspaceId: string, jobId: string, projection: RemoteCriteriaProjection) {
    const job = await this.db.job.findFirst({
      where: { id: jobId, workspaceId },
      select: { criteriaVersion: true },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });

    await this.db.$transaction(async (tx) => {
      const draft = await tx.jobCriteriaVersion.findFirst({
        where: { workspaceId, jobId, status: 'draft' },
        orderBy: { version: 'desc' },
      });
      const confirmedVersion = projection.versionNo || Math.max(1, job.criteriaVersion + 1);
      const confirmedAt = projection.confirmedAt ? new Date(projection.confirmedAt) : new Date();

      if (projection.status === 'confirmed') {
        if (draft) {
          await tx.jobCriteriaVersion.update({
            where: { id: draft.id },
            data: {
              version: confirmedVersion,
              status: 'confirmed',
              requirements: projection.requirements,
              dimensions: projection.dimensions,
              confirmedBy: projection.confirmedBy,
              confirmedAt,
            },
          });
        } else {
          await tx.jobCriteriaVersion.upsert({
            where: { jobId_version: { jobId, version: confirmedVersion } },
            update: {
              status: 'confirmed',
              requirements: projection.requirements,
              dimensions: projection.dimensions,
              confirmedBy: projection.confirmedBy,
              confirmedAt,
            },
            create: {
              workspaceId,
              jobId,
              version: confirmedVersion,
              status: 'confirmed',
              requirements: projection.requirements,
              dimensions: projection.dimensions,
              confirmedBy: projection.confirmedBy,
              confirmedAt,
            },
          });
        }
        await tx.job.update({
          where: { id: jobId },
          data: {
            criteriaStatus: 'confirmed',
            criteriaVersion: confirmedVersion,
            confirmedBy: projection.confirmedBy,
            confirmedAt,
          },
        });
        return;
      }

      const draftVersion = draft?.version ?? (job.criteriaVersion > 0 ? job.criteriaVersion + 1 : 0);
      if (draft) {
        await tx.jobCriteriaVersion.update({
          where: { id: draft.id },
          data: { requirements: projection.requirements, dimensions: projection.dimensions },
        });
      } else {
        await tx.jobCriteriaVersion.create({
          data: {
            workspaceId,
            jobId,
            version: draftVersion,
            status: 'draft',
            requirements: projection.requirements,
            dimensions: projection.dimensions,
          },
        });
      }
      await tx.job.update({ where: { id: jobId }, data: { criteriaStatus: 'draft' } });
    });
  }

  private async find(workspaceId: string, id: string) {
    const job = await this.db.job.findFirst({
      where: { id, workspaceId },
      include: { criteriaVersions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!job || !job.criteriaVersions[0]) throw new NotFoundException({ code: 'NOT_FOUND' });
    return job;
  }
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

// Single source of truth for "does this job require a completed Assessment before
// Interview" -- used both to gate DecisionsService.record's move_to_interview path and
// to tell the frontend (via toFrontendJob's workflowPolicy) whether to show the
// exception-request UI. Deliberately NOT based on seniority: a Senior job doesn't imply
// an assessment is required -- recruiters should be free to choose "Send Assessment" or
// "Move to Interview" for any job unless it (or an explicit title marker) opts in.
export function jobRequiresAssessment(job: { assessmentRequired: boolean; title: string }): boolean {
  return job.assessmentRequired || job.title.toLowerCase().includes('assessment-required');
}

const quickStartSchema = z.object({
  text: z.string().trim().min(1, 'Provide a job description.').max(150000),
  title: z.string().trim().min(1, 'Enter the job title.').max(200),
  team: z.string().trim().min(1, 'Enter the team or function.').max(200),
}).strict();

/**
 * Screening's own view of a Core Record job status. A quick_start job is a JD draft that Screening
 * already uses, so a Core 'draft' reads as 'open' here; every other status (published, paused,
 * closed, archived) is followed as-is, and jobs published from JD follow Core exactly.
 */
export function screeningStatus(coreStatus: string, origin: string) {
  return origin === 'quick_start' && coreStatus === 'draft' ? 'open' : coreStatus;
}

function formatJdText(title: string, content: RemoteCriteriaProjection): string {
  const lines = [title];
  if (content.roleSummary) lines.push('', content.roleSummary);
  if (content.responsibilities.length) lines.push('', 'Responsibilities:', ...content.responsibilities.map((item) => `- ${item}`));
  const labels = content.requirements.map((item) => item.label).filter(Boolean);
  if (labels.length) lines.push('', 'Requirements:', ...labels.map((label) => `- ${label}`));
  return lines.join('\n');
}

/**
 * JD stores requirements as `{ label, priority: must_have | preferred, kind: general, dimension:
 * experience }`; Screening's criteria schema wants `nice_to_have`, its own kind enum and one of its
 * dimension ids — map them into a draft the recruiter reviews and confirms in Screening.
 */
function toScreeningRequirements(requirements: unknown[], dimensions: unknown) {
  const kinds = new Set(['authorization', 'experience', 'skill', 'other']);
  const dimensionIds = asArray(dimensions)
    .map((item) => (item as { id?: unknown }).id)
    .filter((id): id is string => typeof id === 'string');
  const pickDimension = (preferred: string) =>
    dimensionIds.includes(preferred) ? preferred : dimensionIds[0] || preferred;
  return requirements.flatMap((raw, index) => {
    const item = raw as { id?: unknown; label?: unknown; priority?: unknown; kind?: unknown; hard?: unknown; dimension?: unknown };
    if (typeof item.label !== 'string' || !item.label.trim()) return [];
    const kind = typeof item.kind === 'string' && kinds.has(item.kind) ? item.kind : 'experience';
    const dimension = typeof item.dimension === 'string' && dimensionIds.includes(item.dimension)
      ? item.dimension
      : pickDimension(kind === 'skill' ? 'dim-skills' : 'dim-relexp');
    return [{
      id: typeof item.id === 'string' && item.id ? item.id : `jd-req-${index}`,
      label: item.label.trim().slice(0, 500),
      dimension,
      priority: item.priority === 'must_have' ? 'must_have' : 'nice_to_have',
      hard: item.hard === true,
      kind,
    }];
  });
}

/**
 * Criteria read back from the JD subsystem may be JD-authored (no scoring dimensions, JD's own
 * requirement vocabulary) — fall back to this job's local dimensions and map requirements into
 * Screening's schema so the criteria page can be reviewed and confirmed. Already-valid Screening
 * criteria pass through unchanged.
 */
function normalizeRemoteCriteria(remote: RemoteCriteriaProjection, localDimensions: unknown): RemoteCriteriaProjection {
  const dimensions = remote.dimensions.length ? remote.dimensions : (asArray(localDimensions) as RemoteCriteriaProjection['dimensions']);
  return {
    ...remote,
    dimensions,
    requirements: toScreeningRequirements(remote.requirements, dimensions) as RemoteCriteriaProjection['requirements'],
  };
}

function toFrontendJob(job: {
  id: string;
  title: string;
  team: string;
  location: string;
  employmentType: string;
  seniority: string;
  status: string;
  criteriaStatus: string;
  criteriaVersion: number;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  openings: number;
  applicantCount: number;
  assessmentRequired: boolean;
  criteriaVersions: Array<{ requirements: unknown; dimensions: unknown }>;
}, remoteCriteria?: RemoteCriteriaProjection) {
  const criteria = remoteCriteria || job.criteriaVersions[0];
  return {
    id: job.id,
    title: job.title,
    team: job.team,
    location: job.location,
    employmentType: job.employmentType,
    seniority: job.seniority,
    status: job.status,
    hiringManager: 'daniel',
    recruiter: 'emma',
    criteriaStatus: remoteCriteria ? remoteCriteria.status : job.criteriaStatus === 'confirmed' ? 'confirmed' : 'draft',
    criteriaVersion: remoteCriteria?.status === 'confirmed' ? remoteCriteria.versionNo : job.criteriaVersion,
    confirmedBy: remoteCriteria?.confirmedBy || job.confirmedBy || undefined,
    confirmedAt: remoteCriteria?.confirmedAt || job.confirmedAt?.toISOString(),
    compRange: { min: null, max: null, currency: 'USD', period: 'year', basis: 'unknown' },
    responsibilities: remoteCriteria?.responsibilities || [],
    requirements: asArray(criteria?.requirements),
    dimensions: asArray(criteria?.dimensions),
    workflowPolicy: { assessmentDisposition: jobRequiresAssessment(job) ? 'required' : 'optional', decisionApprovalsRequired: 1, exceptionApprovalRoles: ['emma', 'daniel'] },
    openings: job.openings,
    applicantCount: job.applicantCount,
    assessmentRequired: job.assessmentRequired,
  };
}

/**
 * F05 FR-7 / BR-5 (#179): no requirement may use a protected attribute or a proxy for one, or be a judgement no
 * résumé could verify. Rejected before anything is written, so the draft, any confirmed version and existing
 * matches stay exactly as they were.
 */
function assertAllowedRequirements(requirements: Array<{ id: string; label: string }>) {
  const problems = requirements
    .map((requirement) => ({ requirementId: requirement.id, label: requirement.label, problem: requirementProblem(requirement.label) }))
    .filter((item) => item.problem);
  if (problems.length) {
    throw new UnprocessableEntityException({
      code: 'REQUIREMENT_NOT_ALLOWED',
      message: 'A requirement uses a protected attribute or can\'t be verified from a résumé.',
      problems: problems.map(({ requirementId, label, problem }) => ({ requirementId, label, ...problem })),
    });
  }
}
