import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { readAvailability, storedPhone } from './field-formats';
import { CORRECTION_REASON_TYPES, referencedProfileFields } from './correction-rules';
import { confirmedIdentityOf, type ConfirmedIdentity } from '../intake/confirmed-identity';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { ProfileParserService } from './profile-parser.service';
import { AiProfileParserService } from './ai-profile-parser.service';
import { DiscoveryService } from '../discovery/discovery.service';
import { invalidSchema, invalidSchemaFromZod } from '../http/invalid-schema';

// A parse is one AI call (HIREOS_AI_TIMEOUT_SECONDS, 60s by default) plus a few writes, so
// the lease comfortably outlasts it. A job still "running" past its lease means the
// process died mid-parse (e.g. a deploy restarted the container) and is picked up again.
const LEASE_MS = 5 * 60_000;
// Transient AI failures (timeouts, rate limits, a malformed reply) are retried with a
// growing delay before the job is left failed for a human to retry.
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 30_000;
const NON_RETRYABLE_ERRORS = new Set(['SOURCE_MATERIAL_NOT_READY', 'AI_NOT_CONFIGURED']);

/** Currencies offered when correcting a salary expectation. */
export const COMPENSATION_CURRENCIES = ['CNY', 'USD', 'HKD', 'EUR', 'GBP', 'SGD', 'JPY'] as const;

@Injectable()
export class ProfilesService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof globalThis.setInterval>;
  private running = false;

  constructor(
    private readonly db: PrismaService,
    private readonly parser: ProfileParserService,
    private readonly aiParser: AiProfileParserService,
    private readonly discovery: DiscoveryService,
  ) {}

  onModuleInit() {
    this.timer = globalThis.setInterval(() => void this.processQueued(), 250);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) globalThis.clearInterval(this.timer);
  }

  /** `targetJobId`: auto-match the parsed profile against that job only (import started from a job). */
  async enqueue(workspaceId: string, candidateId: string, resumeVersionId: string, materialId: string, targetJobId?: string) {
    return this.db.processingJob.create({
      data: {
        workspaceId,
        candidateId,
        resumeVersionId,
        materialId,
        type: 'resume_parse',
        input: { candidateId, resumeVersionId, materialId, parserVersion: 'local-resume-parser-v1', ...(targetJobId ? { targetJobId } : {}) },
      },
    });
  }

  // Cheap, synchronous, local-only extraction of just the fields identity/duplicate
  // matching needs. This intentionally stays separate from the full async profile parse
  // (which also writes CandidateProfile/ResumeVersion state) so intake can consult it
  // before a Candidate even exists yet.
  extractIdentitySignals(materialId: string, segments: unknown, fallbackName: string) {
    const parsed = this.parser.parse(materialId, asSegments(segments), fallbackName);
    return { displayName: parsed.displayName, email: parsed.email, phone: parsed.phone, location: parsed.location?.value || null };
  }

  async getLatest(identity: Identity, candidateId: string) {
    const candidate = await this.db.candidate.findFirst({
      where: { id: candidateId, workspaceId: identity.workspaceId },
      select: { id: true },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.db.candidateProfile.findFirst({
      where: { candidateId, workspaceId: identity.workspaceId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Every version of a candidate's profile, newest first (#159): how it came about (parsed or corrected), what it
   * said, and for a correction each field's old and new value with who, when and why. Corrections logged before
   * values were recorded get them from the neighbouring versions. Restricted fields (work authorization) are
   * left out until roles exist to read them.
   */
  async history(identity: Identity, candidateId: string) {
    const candidate = await this.db.candidate.findFirst({ where: { id: candidateId, workspaceId: identity.workspaceId }, select: { id: true } });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    const profiles = await this.db.candidateProfile.findMany({
      where: { candidateId, workspaceId: identity.workspaceId },
      orderBy: { version: 'asc' },
    });
    const snapshot = (profile: (typeof profiles)[number]) => ({
      displayName: profile.displayName,
      location: (asRecord(profile.location)?.value as string | undefined) ?? '',
      compensationExpectation: asRecord(profile.compensationExpectation),
      projects: asArray(profile.projects).map((project) => {
        const record = asRecord(project) ?? {};
        return { name: String(record.name ?? ''), description: String(record.description ?? '') };
      }),
    });
    const versions = profiles.map((profile, index) => {
      const previous = index > 0 ? profiles[index - 1] : null;
      const added = asArray(profile.corrections).slice(previous ? asArray(previous.corrections).length : 0).map((entry) => {
        const record = asRecord(entry) ?? {};
        const fieldPath = String(record.fieldPath ?? '');
        const before = previous ? snapshot(previous) : null;
        const after = snapshot(profile);
        const fromSnapshots: Record<string, [unknown, unknown]> = before
          ? { display_name: [before.displayName, after.displayName], location: [before.location, after.location], compensation_expectation: [before.compensationExpectation, after.compensationExpectation], projects: [before.projects, after.projects] }
          : {};
        const [oldValue, newValue] = 'oldValue' in record ? [record.oldValue, record.newValue] : (fromSnapshots[fieldPath] ?? [null, null]);
        return {
          fieldPath,
          oldValue: oldValue ?? null,
          newValue: newValue ?? null,
          reasonType: record.reasonType ?? null,
          reason: String(record.reason ?? ''),
          correctedBy: String(record.correctedBy ?? ''),
          correctedAt: String(record.correctedAt ?? ''),
        };
      });
      return {
        version: profile.version,
        createdAt: profile.createdAt.toISOString(),
        kind: added.length ? ('corrected' as const) : ('parsed' as const),
        resumeVersionId: profile.resumeVersionId,
        ...snapshot(profile),
        corrections: added,
      };
    });
    return { current: profiles.at(-1)?.version ?? null, versions: versions.reverse() };
  }

  async correct(identity: Identity, candidateId: string, raw: unknown) {
    const input = z.object({
      displayName: z.string().trim().min(1).max(200).optional(),
      // An empty string clears a wrongly parsed contact rather than leaving it in place.
      email: z.union([z.literal(''), z.string().trim().toLowerCase().email().max(320)]).optional(),
      phone: z.union([z.literal(''), z.string().trim().regex(/^\+?[\d\s()-]{5,40}$/)]).optional(),
      location: z.string().trim().max(200).optional(),
      compensationMin: z.number().finite().nonnegative().optional(),
      compensationMax: z.number().finite().nonnegative().optional(),
      compensationCurrency: z.enum(COMPENSATION_CURRENCIES).optional(),
      // Project descriptions by their position in the profile's project list (UC-F02-10).
      projects: z.array(z.object({ index: z.number().int().nonnegative(), description: z.string().trim().max(2000) }).strict()).max(50).optional(),
      // Why (COR-2): a quick choice, and a note — the note is required with "other". Whether a reason is required
      // at all depends on what the change touches (COR-1), checked below.
      reasonType: z.enum(CORRECTION_REASON_TYPES).optional(),
      reason: z.string().trim().max(1000).optional(),
    }).strict().refine((v) => (v.compensationMin == null) === (v.compensationMax == null), { message: 'min and max go together' })
      .refine((v) => v.compensationMin == null || v.compensationMax! >= v.compensationMin, { message: 'max below min' })
      .refine((v) => v.reasonType !== 'other' || !!v.reason, { message: 'Describe the reason when choosing "other".', path: ['reason'] })
      .safeParse(raw);
    if (!input.success) throw invalidSchemaFromZod(input.error);
    const candidate = await this.db.candidate.findFirst({
      where: { id: candidateId, workspaceId: identity.workspaceId },
      include: { profiles: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    const current = candidate.profiles[0];
    if (!current) throw new BadRequestException({ code: 'PROFILE_NOT_READY' });

    // Only fields whose value actually changes are corrected and logged.
    const data = input.data;
    const currentLocation = (asRecord(current.location)?.value as string | undefined) ?? '';
    const currentCompensation = asRecord(current.compensationExpectation);
    const currentProjects = asArray(current.projects).map((project) => asRecord(project) ?? {});
    const projectEdits = (data.projects ?? []).filter(
      ({ index, description }) => index < currentProjects.length && description !== String(currentProjects[index].description ?? ''),
    );
    // The contact this version shows — its own, or the candidate's record on a version from before contacts were
    // recorded — is what the form shows, what a change is measured against and what the log keeps as before (#155 review).
    const shownContact = current.contact
      ? { email: String(asRecord(current.contact)?.email ?? ''), phone: String(asRecord(current.contact)?.phone ?? '') }
      : { email: candidate.email ?? '', phone: candidate.phone ?? '' };
    const changed = {
      displayName: data.displayName !== undefined && data.displayName !== (current.displayName || candidate.displayName),
      email: data.email !== undefined && data.email !== shownContact.email,
      phone: data.phone !== undefined && data.phone !== shownContact.phone,
      location: !!data.location && data.location !== currentLocation,
      compensation: data.compensationMin != null && (
        data.compensationMin !== currentCompensation?.min || data.compensationMax !== currentCompensation?.max ||
        (data.compensationCurrency ?? 'CNY') !== currentCompensation?.currency || currentCompensation?.period !== 'month'
      ),
    };
    const fieldPaths = [
      ...(changed.displayName ? ['display_name'] : []),
      ...(changed.email ? ['email'] : []),
      ...(changed.phone ? ['phone'] : []),
      ...(changed.location ? ['location'] : []),
      ...(changed.compensation ? ['compensation_expectation'] : []),
      ...(projectEdits.length ? ['projects'] : []),
    ];
    if (!fieldPaths.length) throw new BadRequestException({ code: 'NO_CHANGES' });

    // COR-1: a reason is required only when the change touches something an effective recommendation or
    // evaluation used; otherwise an empty reason is fine and is logged as such.
    const referenced = await referencedProfileFields(this.db, identity.workspaceId, candidateId);
    const touched = fieldPaths.filter((field) => referenced.includes(field));
    if (touched.length && !data.reasonType) {
      throw invalidSchema({ reasonType: [`A reason is required: ${touched.join(', ')} is used by a current recommendation or evaluation.`] });
    }
    const nextProjects = projectEdits.length
      ? currentProjects.map((project, index) => {
          const edit = projectEdits.find((e) => e.index === index);
          return edit ? { ...project, description: edit.description } : project;
        })
      : current.projects;

    const nextLocation = changed.location
      ? { value: data.location, status: 'known', evidence: { source: 'human_correction', actorId: identity.actorId } }
      : current.location;
    // Salary expectations are recorded per month (as written in résumés here); currency is chosen.
    const nextCompensation = changed.compensation
      ? { min: data.compensationMin, max: data.compensationMax, currency: data.compensationCurrency ?? 'CNY', period: 'month', basis: 'gross', status: 'known' }
      : current.compensationExpectation;
    const correctedAt = new Date().toISOString();
    const correctionValues = (fieldPath: string): { oldValue: unknown; newValue: unknown } => {
      switch (fieldPath) {
        case 'display_name': return { oldValue: current.displayName || candidate.displayName, newValue: data.displayName };
        case 'email': return { oldValue: shownContact.email, newValue: data.email };
        case 'phone': return { oldValue: shownContact.phone, newValue: data.phone };
        case 'location': return { oldValue: currentLocation, newValue: data.location };
        case 'compensation_expectation': return { oldValue: currentCompensation, newValue: nextCompensation };
        case 'projects': return {
          oldValue: projectEdits.map(({ index }) => ({ index, description: String(currentProjects[index].description ?? '') })),
          newValue: projectEdits,
        };
        default: return { oldValue: null, newValue: null };
      }
    };
    const corrections = [
      ...asArray(current.corrections),
      ...fieldPaths.map((fieldPath) => ({
        fieldPath,
        // What the field said before and after (#159), so the history shows the change itself.
        ...correctionValues(fieldPath),
        reasonType: data.reasonType ?? null,
        reason: data.reason ?? '',
        reasonRequired: touched.includes(fieldPath),
        correctedBy: identity.actorId,
        correctedAt,
      })),
    ];
    const profile = await this.db.$transaction(async (tx) => {
      // Name and contacts live on the Candidate identity record; the profile keeps its own name copy.
      if (changed.displayName || changed.email || changed.phone) {
        await tx.candidate.update({
          where: { id: candidateId },
          data: {
            ...(changed.displayName ? { displayName: data.displayName } : {}),
            ...(changed.email ? { email: data.email || null } : {}),
            ...(changed.phone ? { phone: data.phone || null } : {}),
          },
        });
      }
      const created = await tx.candidateProfile.create({
        data: {
          workspaceId: identity.workspaceId,
          candidateId,
          resumeVersionId: current.resumeVersionId,
          version: current.version + 1,
          parseStatus: 'succeeded',
          dataStatus: current.dataStatus,
          parserVersion: current.parserVersion,
          displayName: changed.displayName ? data.displayName! : current.displayName,
          sourceEntries: toJson(current.sourceEntries),
          resumeVersionRefs: toJson(current.resumeVersionRefs),
          employmentHistory: toJson(current.employmentHistory),
          skills: toJson(current.skills),
          education: toJson(current.education),
          certifications: toJson(current.certifications),
          projects: toJson(nextProjects),
          location: toJson(nextLocation),
          workAuthorization: toJson(current.workAuthorization),
          languages: toJson(current.languages),
          ...(current.availability ? { availability: toJson(current.availability) } : {}),
          // This version's contact: the correction where there is one, otherwise what the previous version had.
          ...(current.contact || changed.email || changed.phone
            ? { contact: toJson({
                // An unchanged one keeps what this version showed: its own value, or — on a version from before
                // contacts were recorded — the candidate's record (#155 review).
                email: changed.email ? data.email || null : (current.contact ? (asRecord(current.contact)?.email ?? null) : (candidate.email ?? null)),
                phone: changed.phone ? data.phone || null : (current.contact ? (asRecord(current.contact)?.phone ?? null) : (candidate.phone ?? null)),
              }) }
            : {}),
          ...(nextCompensation ? { compensationExpectation: toJson(nextCompensation) } : {}),
          missingFields: toJson(asArray(current.missingFields).filter((field) => !(
            (field === 'location' && changed.location) || (field === 'compensation_expectation' && changed.compensation)
          ))),
          corrections: toJson(corrections),
        },
      });
      await tx.auditRecord.create({
        data: {
          workspaceId: identity.workspaceId,
          actorId: identity.actorId,
          action: 'candidate_profile_corrected',
          objectType: 'CandidateProfile',
          objectId: created.id,
          payload: { candidateId, reasonType: data.reasonType ?? null, reason: data.reason ?? '', fields: fieldPaths, reasonRequiredFor: touched },
        },
      });
      return created;
    });
    return profile;
  }

  async getJob(identity: Identity, jobId: string) {
    const job = await this.db.processingJob.findFirst({
      where: { id: jobId, workspaceId: identity.workspaceId },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    return serializeJob(job);
  }

  async retry(identity: Identity, jobId: string) {
    const job = await this.db.processingJob.findFirst({
      where: { id: jobId, workspaceId: identity.workspaceId },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (job.status !== 'failed') {
      throw new BadRequestException({ code: 'JOB_NOT_RETRYABLE', status: job.status });
    }
    return serializeJob(await this.requeue(job));
  }

  // "Re-parse" from the candidate page: requeues the candidate's latest resume parse if it
  // failed. A parse that is still queued/running is left alone.
  async reparseCandidate(identity: Identity, candidateId: string) {
    const job = await this.db.processingJob.findFirst({
      where: { workspaceId: identity.workspaceId, candidateId, type: 'resume_parse' },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (job.status !== 'failed') return serializeJob(job);
    return serializeJob(await this.requeue(job));
  }

  private async requeue(job: { id: string; resumeVersionId: string | null }) {
    return this.db.$transaction(async (tx) => {
      if (job.resumeVersionId) {
        await tx.resumeVersion.updateMany({
          where: { id: job.resumeVersionId, parseStatus: 'failed' },
          data: { parseStatus: 'pending' },
        });
      }
      return tx.processingJob.update({
        where: { id: job.id },
        data: { status: 'queued', attempt: 0, nextRunAt: new Date(), errorCode: null, leaseToken: null, leaseUntil: null },
      });
    });
  }

  private async processQueued() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const claimable: Prisma.ProcessingJobWhereInput = {
        OR: [
          { status: 'queued', nextRunAt: { lte: now } },
          { status: 'running', leaseUntil: { lt: now } },
        ],
      };
      const job = await this.db.processingJob.findFirst({
        where: { type: 'resume_parse', ...claimable },
        orderBy: { createdAt: 'asc' },
      });
      if (!job) return;
      const leaseToken = randomUUID();
      const claimed = await this.db.processingJob.updateMany({
        where: { id: job.id, ...claimable },
        data: { status: 'running', attempt: { increment: 1 }, leaseToken, leaseUntil: new Date(Date.now() + LEASE_MS) },
      });
      if (claimed.count !== 1) return;
      await this.processClaimed(job.id, leaseToken);
    } finally {
      this.running = false;
    }
  }

  private async processClaimed(jobId: string, leaseToken: string) {
    const job = await this.db.processingJob.findFirst({
      where: { id: jobId, leaseToken },
    });
    const materialId = job?.materialId;
    const candidateId = job?.candidateId;
    const resumeVersionId = job?.resumeVersionId;
    if (!materialId || !candidateId || !resumeVersionId) return;
    try {
      const material = await this.db.material.findUnique({ where: { id: materialId } });
      const candidate = await this.db.candidate.findUnique({ where: { id: candidateId } });
      if (!material || !candidate || material.readStatus !== 'available') {
        throw new Error('SOURCE_MATERIAL_NOT_READY');
      }
      // AI is authoritative when configured -- the local parser is a fixed English tech
      // keyword list that returns near-empty profiles for Chinese or non-engineering
      // resumes even though parseStatus says "succeeded". A genuine AI failure must
      // surface as a failed job (retryable), not silently fall back to that weak parser
      // and look successful while extracting almost nothing.
      const read = this.aiParser.isConfigured()
        ? await this.parseWithAi(material, candidate.displayName)
        : this.parseLocally(material, candidate.displayName);
      // What the user confirmed on a paste wins over what was read from the text (#160 #167).
      const parsed = withConfirmedIdentity(read, confirmedIdentityOf(material));
      const profile = await this.db.$transaction(async (tx) => {
        const latest = await tx.candidateProfile.findFirst({
          where: { candidateId: candidate.id },
          orderBy: { version: 'desc' },
          select: { version: true },
        });
        const created = await tx.candidateProfile.create({
          data: {
            workspaceId: job.workspaceId,
            candidateId: candidate.id,
            resumeVersionId,
            version: (latest?.version || 0) + 1,
            parseStatus: 'succeeded',
            dataStatus: parsed.missingFields.length ? 'partial' : 'complete',
            parserVersion: parsed.parserVersion,
            displayName: parsed.displayName,
            sourceEntries: parsed.sourceEntries,
            resumeVersionRefs: [job.resumeVersionId],
            employmentHistory: parsed.employmentHistory,
            skills: parsed.skills,
            education: parsed.education,
            certifications: parsed.certifications,
            projects: parsed.projects,
            location: parsed.location || { value: '', status: 'unknown' },
            workAuthorization: parsed.workAuthorization || { value: '', status: 'unknown' },
            languages: parsed.languages,
            ...(parsed.availability ? { availability: parsed.availability } : {}),
            contact: { email: parsed.email ?? null, phone: parsed.phone ?? null },
            ...(parsed.compensationExpectation ? { compensationExpectation: parsed.compensationExpectation } : {}),
            missingFields: parsed.missingFields,
            corrections: [],
          },
        });
        await tx.resumeVersion.update({
          where: { id: resumeVersionId },
          data: { parseStatus: 'succeeded' },
        });
        await tx.candidate.update({
          where: { id: candidate.id },
          data: {
            email: candidate.email || parsed.email,
            phone: candidate.phone || parsed.phone,
          },
        });
        await tx.processingJob.update({
          where: { id: job.id },
          data: {
            status: 'succeeded',
            result: { profileId: created.id, parserVersion: parsed.parserVersion, dataStatus: created.dataStatus },
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return created;
      });
      // PRD: matching runs automatically once a profile exists, not on a manual button
      // press. Enqueued after commit so a slow/failing match run can never roll back or
      // block the profile that triggered it.
      const targetJobId = (job.input as { targetJobId?: string } | null)?.targetJobId;
      await this.discovery.enqueueAutoMatch(job.workspaceId, candidate.id, targetJobId);
      return profile;
    } catch (error) {
      const errorCode = error instanceof Error ? error.message : 'PROFILE_PARSE_FAILED';
      if (job.attempt < MAX_ATTEMPTS && !NON_RETRYABLE_ERRORS.has(errorCode)) {
        await this.db.processingJob.update({
          where: { id: job.id },
          data: {
            status: 'queued',
            nextRunAt: new Date(Date.now() + RETRY_BASE_DELAY_MS * job.attempt),
            errorCode,
            leaseToken: null,
            leaseUntil: null,
          },
        });
        return;
      }
      await this.db.processingJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorCode,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      await this.db.resumeVersion.updateMany({
        where: { id: resumeVersionId },
        data: { parseStatus: 'failed' },
      });
    }
  }

  private parseLocally(material: { id: string; segments: unknown }, fallbackName: string) {
    const parsed = this.parser.parse(material.id, asSegments(material.segments), fallbackName);
    return { ...parsed, parserVersion: 'local-resume-parser-v1' as const };
  }

  private async parseWithAi(material: { id: string; text: string }, fallbackName: string) {
    const ai = await this.aiParser.parse(material.text, fallbackName);
    const missingFields = [
      ...(ai.location.status === 'unknown' ? ['location'] : []),
      // Work authorization is still parsed but never flagged as missing: most roles here are
      // domestic, where résumés don't state it and its absence means nothing.
      ...(ai.employmentHistory.length ? [] : ['employment_history']),
      ...(ai.education.length ? [] : ['education']),
      ...(ai.compensationExpectation ? [] : ['compensation_expectation']),
    ];
    return {
      displayName: ai.displayName || fallbackName,
      email: ai.email ? ai.email.trim().toLowerCase() : null,
      phone: storedPhone(ai.phone),
      location: ai.location,
      workAuthorization: ai.workAuthorization,
      skills: ai.skills,
      languages: ai.languages,
      availability: ai.availability.status === 'known' && ai.availability.value ? readAvailability(ai.availability.value) : null,
      employmentHistory: ai.employmentHistory,
      education: ai.education,
      certifications: ai.certifications,
      projects: ai.projects,
      compensationExpectation: ai.compensationExpectation ? { ...ai.compensationExpectation, status: 'known' as const } : null,
      missingFields,
      // Full-document evidence rather than the local parser's per-field line quotes -- the
      // model reads the whole resume at once instead of matching individual lines.
      sourceEntries: [{ sourceMaterialId: material.id, segmentId: 'ai-parsed', quote: material.text.slice(0, 500) }],
      parserVersion: 'ai-resume-parser-v1' as const,
    };
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return value === null || value === undefined ? {} : value as Prisma.InputJsonValue;
}

function asSegments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { id: string; text: string; page?: number } => (
    Boolean(item)
    && typeof item === 'object'
    && typeof (item as { id?: unknown }).id === 'string'
    && typeof (item as { text?: unknown }).text === 'string'
  ));
}

function serializeJob(job: {
  id: string;
  type: string;
  status: string;
  attempt: number;
  errorCode: string | null;
  result: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    attempt: job.attempt,
    errorCode: job.errorCode || undefined,
    result: job.result,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

type ParsedForProfile = {
  displayName: string;
  email: string | null;
  location: { value: string; status: string; evidence?: unknown } | null;
  missingFields: string[];
};

export function withConfirmedIdentity<T extends ParsedForProfile>(parsed: T, confirmed: ConfirmedIdentity | null): T {
  if (!confirmed) return parsed;
  const evidence = { source: 'user_confirmed' };
  const parsedLocation = parsed.location as { value?: unknown } | null;
  // The location as read stays as read (with its country and city) when the user confirmed it unchanged; only a
  // location the user typed differently replaces it, marked as theirs.
  const unchanged = !!confirmed.location && typeof parsedLocation?.value === 'string'
    && parsedLocation.value.trim().toLowerCase() === confirmed.location.trim().toLowerCase();
  // Cleared on the form (null): there is none, whatever the text says. Not sent (undefined): as read.
  const clearedLocation = confirmed.location === null;
  return {
    ...parsed,
    displayName: confirmed.displayName,
    email: confirmed.email === undefined ? parsed.email : confirmed.email,
    ...(confirmed.location && !unchanged
      ? { location: { value: confirmed.location, status: 'known', evidence }, missingFields: parsed.missingFields.filter((f) => f !== 'location') }
      : {}),
    ...(clearedLocation
      ? { location: { value: '', status: 'unknown', evidence }, missingFields: [...new Set([...parsed.missingFields, 'location'])] }
      : {}),
  };
}
