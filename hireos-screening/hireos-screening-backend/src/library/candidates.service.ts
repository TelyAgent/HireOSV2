import { Injectable, NotFoundException } from '@nestjs/common';
import { toFrontendRecommendation } from '../discovery/discovery.service';
import { profileFields } from '../profiles/profile-fields';
import { referencedProfileFields } from '../profiles/correction-rules';
import { formatMonth, totalExperience } from '../profiles/experience';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../persistence/prisma.service';
import { pasteCandidateSchema, validate } from '../intake/contracts';
import type { Identity } from '../auth/workspace.guard';
import { CoreRecordClient } from '../core-record/core-record.client';
import { DiscoveryService } from '../discovery/discovery.service';

@Injectable()
export class CandidatesService {
  constructor(
    private readonly db: PrismaService,
    private readonly coreRecord: CoreRecordClient,
    private readonly discovery: DiscoveryService,
  ) {}

  async createManual(identity: Identity, raw: unknown) {
    const input = validate(pasteCandidateSchema, raw);
    const coreCandidate = await this.coreRecord.createCandidate(identity, {
      displayName: input.name,
      email: input.email || undefined,
      source: 'manual',
    }, `screening:candidate:manual:${identity.workspaceId}:${input.name}:${input.email || ''}`);
    const candidate = await this.db.$transaction(async (tx) => {
      const created = coreCandidate?.id
        ? await tx.candidate.upsert({
            where: { id: coreCandidate.id },
            update: { displayName: input.name, email: input.email || null },
            create: {
              id: coreCandidate.id,
              workspaceId: identity.workspaceId,
              displayName: input.name,
              email: input.email || null,
              ownerId: identity.actorId,
            },
          })
        : await tx.candidate.create({
            data: {
              workspaceId: identity.workspaceId,
              displayName: input.name,
              email: input.email || null,
              ownerId: identity.actorId,
            },
          });
      const existingLibraryEntry = await tx.libraryEntry.findUnique({ where: { candidateId: created.id } });
      if (!existingLibraryEntry) {
        await tx.libraryEntry.create({
          data: {
            workspaceId: identity.workspaceId,
            candidateId: created.id,
            ownerId: identity.actorId,
          },
        });
      }
      let profile = await tx.candidateProfile.findFirst({ where: { candidateId: created.id }, orderBy: { version: 'desc' } });
      if (!profile && (input.location || input.notes)) {
        const missingFields = ['compensation_expectation'];
        if (!input.location) missingFields.push('location');
        profile = await tx.candidateProfile.create({
          data: {
            workspaceId: identity.workspaceId,
            candidateId: created.id,
            version: 1,
            parseStatus: 'succeeded',
            dataStatus: 'partial',
            parserVersion: 'manual-paste-v1',
            displayName: input.name,
            sourceEntries: [] as unknown as Prisma.InputJsonValue,
            resumeVersionRefs: [] as unknown as Prisma.InputJsonValue,
            employmentHistory: (input.notes
              ? [{ company: '(from pasted notes)', title: '', start: '', end: '', achievements: [input.notes] }]
              : []) as unknown as Prisma.InputJsonValue,
            skills: [] as unknown as Prisma.InputJsonValue,
            education: [] as unknown as Prisma.InputJsonValue,
            certifications: [] as unknown as Prisma.InputJsonValue,
            projects: [] as unknown as Prisma.InputJsonValue,
            location: { value: input.location || '', status: input.location ? 'known' : 'unknown' } as unknown as Prisma.InputJsonValue,
            workAuthorization: { value: '', status: 'unknown' } as unknown as Prisma.InputJsonValue,
            languages: [] as unknown as Prisma.InputJsonValue,
            missingFields: missingFields as unknown as Prisma.InputJsonValue,
            corrections: [] as unknown as Prisma.InputJsonValue,
          },
        });
      }
      return { created, profile };
    });
    if (candidate.profile) {
      // PRD: matching runs automatically once a profile exists, not on a manual button
      // press. Enqueued after commit so a slow/failing match run can never roll back or
      // block the candidate creation that triggered it.
      await this.discovery.enqueueAutoMatch(identity.workspaceId, candidate.created.id, input.jobId);
    }
    return this.toFrontendCandidate(candidate.created, candidate.profile ?? undefined);
  }

  async remove(identity: Identity, id: string) {
    const candidate = await this.db.candidate.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { resumeVersions: { select: { materialId: true } } },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    // Deleting the Candidate only cascades ResumeVersion (the link row) -- Material is a
    // workspace-wide, hash-deduped store (`Material_workspaceId_hash_key`) that outlives
    // any one candidate by design, so it's untouched by that cascade. Left behind, its
    // `hash`/`normalizedTextHash` keeps matching on re-upload and the new file gets
    // flagged as a duplicate of a candidate that no longer exists. ResumeVersion.materialId
    // is unique (one material has at most one resume version), so once the candidate (and
    // its resume versions) are gone, every material here is guaranteed orphaned and safe
    // to delete outright.
    const materialIds = [...new Set(candidate.resumeVersions.map((version) => version.materialId))];
    await this.db.$transaction(async (tx) => {
      await tx.candidate.delete({ where: { id } });
      if (materialIds.length > 0) {
        await tx.material.deleteMany({ where: { id: { in: materialIds } } });
      }
    });
  }

  async get(identity: Identity, id: string) {
    const candidate = await this.db.candidate.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: {
        resumeVersions: {
          orderBy: { version: 'asc' },
          include: { material: { select: { id: true, name: true, readStatus: true, errorCode: true, createdAt: true, segments: true } } },
        },
        profiles: { orderBy: { version: 'desc' }, take: 1 },
        recommendations: { orderBy: { createdAt: 'desc' }, include: { prelinkEvaluation: true } },
        applications: { orderBy: { linkedAt: 'desc' } },
        sources: { orderBy: { receivedAt: 'desc' }, take: 50, include: { material: { select: { id: true, name: true } } } },
      },
    });
    if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
    const matchingStatuses = await this.discovery.getMatchingStatuses(identity.workspaceId, [id]);
    const referenced = await referencedProfileFields(this.db, identity.workspaceId, id);
    // Field-by-field status and source locations, against the résumé version the profile was parsed from (#155).
    const profile = candidate.profiles[0];
    const parsedFrom = candidate.resumeVersions.find((version) => version.id === profile?.resumeVersionId);
    const fields = profileFields(profile as unknown as Record<string, unknown> | undefined, candidate, parsedFrom ? {
      resumeVersionId: parsedFrom.id,
      resumeVersion: parsedFrom.version,
      materialId: parsedFrom.materialId,
      readable: parsedFrom.material.readStatus === 'available' && Array.isArray(parsedFrom.material.segments) && parsedFrom.material.segments.length > 0,
      segments: (Array.isArray(parsedFrom.material.segments) ? parsedFrom.material.segments : []) as Array<{ id: string; text: string; page?: number }>,
    } : null);
    return {
      candidate: {
        ...this.toFrontendCandidate(candidate, candidate.profiles[0]),
        // Fields a correction needs a reason for right now: used by a current recommendation or evaluation (#158).
        correctionReasonRequiredFor: referenced,
        profileFields: fields,
      },
      matching: matchingStatuses.get(id) ?? { isMatching: false, lastRun: null },
      // Every way this candidate's material came in, including re-uploads of a file already on record (#153).
      sources: candidate.sources.map((source) => ({
        id: source.id,
        channel: source.channel,
        receivedAt: source.receivedAt.toISOString(),
        materialId: source.materialId ?? undefined,
        fileName: source.material?.name,
      })),
      resumeVersions: candidate.resumeVersions.map((version) => ({
        id: version.id,
        version: version.version,
        fileName: version.material.name,
        uploadedAt: version.uploadedAt.toISOString(),
        source: version.source,
        parseStatus: version.parseStatus === 'succeeded' ? 'succeeded' : version.parseStatus,
        isLatest: version.isLatest,
        materialId: version.materialId,
      })),
      applications: candidate.applications.map((application) => ({
        id: application.id,
        candidateId: application.candidateId,
        jobId: application.jobId,
        cycleId: application.cycleId,
        status: application.status,
        screeningStatus: application.screeningStatus,
        origin: application.origin,
        linkedAt: application.linkedAt.toISOString(),
        linkedBy: application.linkedBy,
        linkReason: application.linkReason,
      })),
      // With eligibility, conflicts and what each was based on (#181 #183).
      recommendations: candidate.recommendations.map((recommendation) => toFrontendRecommendation(recommendation)),
    };
  }

  toFrontendCandidate(candidate: {
    id: string;
    displayName: string;
    email: string | null;
    phone?: string | null;
    identityStatus: string;
    ownerId: string;
    retention: string;
    libraryStatus: string;
    lastMatchedAt: Date | null;
    createdAt: Date;
  }, profile?: {
    displayName: string;
    dataStatus: string;
    parseStatus: string;
    location: unknown;
    workAuthorization: unknown;
    skills: unknown;
    education: unknown;
    employmentHistory: unknown;
    compensationExpectation: unknown;
    missingFields: unknown;
    projects?: unknown;
  }) {
    const location = asProfileValue(profile?.location);
    const workAuth = asProfileValue(profile?.workAuthorization);
    const compensation = asRecord(profile?.compensationExpectation);
    return {
      id: candidate.id,
      displayName: profile?.displayName || candidate.displayName,
      identityStatus: candidate.identityStatus === 'confirmed' ? 'confirmed' as const : 'provisional' as const,
      contact: {
        email: candidate.email || '',
        phone: candidate.phone || '',
        location: { value: location?.value || '', status: location?.status || 'unknown' as const },
      },
      workAuth: { value: workAuth?.value || '', status: workAuth?.status || 'unknown' as const },
      tags: asArray(profile?.skills).map((skill) => typeof skill === 'object' && skill && 'name' in skill ? String(skill.name) : String(skill)),
      owner: 'emma' as const,
      ownerId: candidate.ownerId,
      createdAt: candidate.createdAt.toISOString(),
      lastMatchedAt: candidate.lastMatchedAt?.toISOString() ?? null,
      retention: candidate.retention,
      libraryStatus: 'available' as const,
      compensationExpectation: compensation,
      // Profiles parsed before work authorization stopped counting as missing still carry it.
      missingFields: asArray(profile?.missingFields).map(String).filter((field) => field !== 'work_authorization'),
      // Dates as YYYY-MM whatever format the résumé used; "present" and unreadable values stay as written (#156).
      employment: asArray(profile?.employmentHistory).map((entry) => {
        const record = asRecord(entry);
        if (!record) return entry;
        return { ...record, start: formatMonth(record.start) ?? record.start, end: formatMonth(record.end) ?? record.end };
      }),
      totalExperience: totalExperience(profile?.employmentHistory),
      skills: asArray(profile?.skills).map((skill) => typeof skill === 'object' && skill && 'name' in skill ? String(skill.name) : String(skill)),
      education: asArray(profile?.education),
      // The profile version shown, for its history (#159).
      profileVersion: (profile as { version?: number } | undefined)?.version ?? null,
      projects: asArray(profile?.projects).map((project) => {
        const record = asRecord(project) ?? {};
        return { name: String(record.name ?? ''), description: String(record.description ?? '') };
      }),
    };
  }
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function asProfileValue(value: unknown): { value: string; status: 'known' | 'unknown' } | null {
  const record = asRecord(value);
  if (!record || typeof record.value !== 'string') return null;
  return {
    value: record.value,
    status: record.status === 'known' ? 'known' : 'unknown',
  };
}
