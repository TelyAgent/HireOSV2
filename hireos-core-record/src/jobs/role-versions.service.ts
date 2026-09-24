import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { findIdempotent, json, storeIdempotency, type RequestMeta } from '../records';

const requirementSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  dimension: z.string().trim().min(1),
  priority: z.enum(['must_have', 'nice_to_have', 'preferred']),
  hard: z.boolean(),
  kind: z.string().trim().min(1),
  evidenceStandard: z.string().trim().optional(),
}).passthrough();

const dimensionSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  weight: z.number().min(0).max(1),
  rubric: z.string().trim().min(1),
}).passthrough();

const draftSchema = z.object({
  roleSummary: z.string().trim().max(10000).optional(),
  responsibilities: z.array(z.string().trim().min(1)).max(100).default([]),
  requirements: z.array(requirementSchema).max(200).default([]),
  dimensions: z.array(dimensionSchema).max(20).default([]),
  evaluationReadiness: z.enum(['ready', 'needs_configuration']).optional(),
  hiringContext: z.record(z.string(), z.unknown()).optional(),
  successCriteria: z.array(z.record(z.string(), z.unknown())).optional(),
  internalCompensation: z.record(z.string(), z.unknown()).nullable().optional(),
  publicCompensation: z.record(z.string(), z.unknown()).nullable().optional(),
  sourceRefs: z.array(z.unknown()).default([]),
  origin: z.enum(['jd_module', 'foundation_confirmed', 'external_import']).default('jd_module'),
});

const draftPatchSchema = draftSchema.partial();

const snapshotSchema = z.object({
  audience: z.enum(['internal_evaluation', 'external']),
  purpose: z.string().trim().min(1).max(120),
  consumerModule: z.string().trim().max(80).optional(),
  jdText: z.string().trim().max(50000).optional(),
  policyRefs: z.array(z.unknown()).default([]),
});

@Injectable()
export class RoleVersionsService {
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity, jobId: string) {
    await this.assertJob(identity.workspaceId, jobId);
    const rows = await this.db.roleDefinitionVersion.findMany({
      where: { workspaceId: identity.workspaceId, jobId },
      orderBy: { versionNo: 'desc' },
    });
    return rows.map(serializeRoleVersion);
  }

  async get(identity: Identity, jobId: string, roleVersionId: string) {
    const row = await this.db.roleDefinitionVersion.findFirst({
      where: { id: roleVersionId, workspaceId: identity.workspaceId, jobId },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    return serializeRoleVersion(row);
  }

  async createDraft(identity: Identity, jobId: string, raw: unknown, meta: RequestMeta) {
    await this.assertJob(identity.workspaceId, jobId);
    const input = draftSchema.parse(raw);
    const operation = `role-version.create:${jobId}`;
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const latest = await tx.roleDefinitionVersion.findFirst({
        where: { workspaceId: identity.workspaceId, jobId },
        orderBy: { versionNo: 'desc' },
      });
      const versionNo = (latest?.versionNo || 0) + 1;
      const contentHash = hashContent(input);
      const row = await tx.roleDefinitionVersion.create({
        data: {
          workspaceId: identity.workspaceId,
          jobId,
          versionNo,
          origin: input.origin,
          roleSummary: input.roleSummary,
          responsibilities: json(input.responsibilities),
          requirements: json(input.requirements),
          dimensions: json(input.dimensions),
          evaluationReadiness: input.evaluationReadiness || readiness(input),
          hiringContext: input.hiringContext ? json(input.hiringContext) : undefined,
          successCriteria: input.successCriteria ? json(input.successCriteria) : undefined,
          internalCompensation: input.internalCompensation === undefined ? undefined : json(input.internalCompensation),
          publicCompensation: input.publicCompensation === undefined ? undefined : json(input.publicCompensation),
          sourceRefs: json(input.sourceRefs),
          contentHash,
          createdBy: identity.actorId,
        },
      });
      const result = serializeRoleVersion(row);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  async confirm(identity: Identity, jobId: string, roleVersionId: string, raw: unknown, meta: RequestMeta) {
    const row = await this.db.roleDefinitionVersion.findFirst({
      where: { id: roleVersionId, workspaceId: identity.workspaceId, jobId },
    });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (row.status === 'confirmed' || row.status === 'published') return serializeRoleVersion(row);
    const operation = `role-version.confirm:${roleVersionId}`;
    const input = raw || {};
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const confirmed = await tx.roleDefinitionVersion.update({
        where: { id: roleVersionId },
        data: {
          status: 'confirmed',
          confirmedBy: identity.actorId,
          confirmedAt: new Date(),
          confirmationRef: json({ type: 'human_confirmation', actorId: identity.actorId }),
        },
      });
      const result = serializeRoleVersion(confirmed);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  async updateDraft(identity: Identity, jobId: string, roleVersionId: string, raw: unknown, meta: RequestMeta) {
    const current = await this.db.roleDefinitionVersion.findFirst({
      where: { id: roleVersionId, workspaceId: identity.workspaceId, jobId },
    });
    if (!current) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (current.status !== 'draft') throw new ConflictException({ code: 'ROLE_VERSION_NOT_EDITABLE' });
    const patch = draftPatchSchema.parse(raw);
    const merged = {
      roleSummary: patch.roleSummary === undefined ? current.roleSummary || undefined : patch.roleSummary,
      responsibilities: patch.responsibilities || asArray(current.responsibilities).map(String),
      requirements: patch.requirements || asArray(current.requirements),
      dimensions: patch.dimensions || asArray(current.dimensions),
      evaluationReadiness: patch.evaluationReadiness || current.evaluationReadiness,
      hiringContext: patch.hiringContext === undefined ? current.hiringContext : patch.hiringContext,
      successCriteria: patch.successCriteria === undefined ? current.successCriteria : patch.successCriteria,
      internalCompensation: patch.internalCompensation === undefined ? current.internalCompensation : patch.internalCompensation,
      publicCompensation: patch.publicCompensation === undefined ? current.publicCompensation : patch.publicCompensation,
      sourceRefs: patch.sourceRefs || asArray(current.sourceRefs),
      origin: patch.origin || current.origin,
    };
    const operation = `role-version.update:${roleVersionId}`;
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, merged);
      if (prior.prior) return prior.prior.responseBody;
      const updated = await tx.roleDefinitionVersion.update({
        where: { id: roleVersionId },
        data: {
          roleSummary: merged.roleSummary,
          responsibilities: json(merged.responsibilities),
          requirements: json(merged.requirements),
          dimensions: json(merged.dimensions),
          evaluationReadiness: merged.evaluationReadiness,
          hiringContext: merged.hiringContext === undefined ? undefined : json(merged.hiringContext),
          successCriteria: merged.successCriteria === undefined ? undefined : json(merged.successCriteria),
          internalCompensation: merged.internalCompensation === undefined ? undefined : json(merged.internalCompensation),
          publicCompensation: merged.publicCompensation === undefined ? undefined : json(merged.publicCompensation),
          sourceRefs: json(merged.sourceRefs),
          origin: merged.origin,
          contentHash: hashContent(merged),
        },
      });
      const result = serializeRoleVersion(updated);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  async createSnapshot(identity: Identity, jobId: string, roleVersionId: string, raw: unknown, meta: RequestMeta) {
    const row = await this.db.roleDefinitionVersion.findFirst({
      where: { id: roleVersionId, workspaceId: identity.workspaceId, jobId, status: { in: ['confirmed', 'published'] } },
    });
    if (!row) throw new ConflictException({ code: 'ROLE_VERSION_NOT_CONFIRMED' });
    const input = snapshotSchema.parse(raw);
    const operation = `role-snapshot.create:${roleVersionId}:${input.purpose}:${input.consumerModule || ''}`;
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, input);
      if (prior.prior) return prior.prior.responseBody;
      const projection = {
        roleSummary: row.roleSummary,
        responsibilities: row.responsibilities,
        requirements: row.requirements,
        dimensions: row.dimensions,
        evaluationReadiness: row.evaluationReadiness,
        hiringContext: row.hiringContext,
        successCriteria: row.successCriteria,
      };
      const projectionHash = hashContent(projection);
      const snapshot = await tx.jobRequirementSnapshot.create({
        data: {
          workspaceId: identity.workspaceId,
          jobId,
          roleVersionId,
          audience: input.audience,
          purpose: input.purpose,
          consumerModule: input.consumerModule,
          profileProjection: json(projection),
          jdText: input.jdText,
          policyRefs: json(input.policyRefs),
          confirmationRef: row.confirmationRef || undefined,
          sourceHash: row.contentHash,
          projectionHash,
          projectionSchema: 'hireos.job-requirement-snapshot.v1',
          createdBy: identity.actorId,
        },
      });
      const result = serializeSnapshot(snapshot);
      await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
      return result;
    });
  }

  private async assertJob(workspaceId: string, jobId: string) {
    const job = await this.db.job.findFirst({ where: { id: jobId, workspaceId }, select: { id: true } });
    if (!job) throw new NotFoundException({ code: 'NOT_FOUND' });
  }
}

function readiness(input: { responsibilities: unknown[]; requirements: unknown[]; dimensions: unknown[] }) {
  return input.responsibilities.length > 0 && input.requirements.length > 0 && input.dimensions.length > 0 ? 'ready' : 'needs_configuration';
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hashContent(value: unknown) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

type RoleVersionRow = {
  id: string;
  jobId: string;
  versionNo: number;
  origin: string;
  status: string;
  roleSummary: string | null;
  responsibilities: unknown;
  requirements: unknown;
  dimensions: unknown;
  evaluationReadiness: string;
  hiringContext: unknown;
  successCriteria: unknown;
  internalCompensation: unknown;
  publicCompensation: unknown;
  sourceRefs: unknown;
  confirmationRef: unknown;
  confirmedBy: string | null;
  confirmedAt: Date | null;
  contentHash: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

function serializeRoleVersion(row: RoleVersionRow) {
  return {
    id: row.id,
    jobId: row.jobId,
    versionNo: row.versionNo,
    origin: row.origin,
    status: row.status,
    roleSummary: row.roleSummary || undefined,
    responsibilities: row.responsibilities,
    requirements: row.requirements,
    dimensions: row.dimensions,
    evaluationReadiness: row.evaluationReadiness,
    hiringContext: row.hiringContext,
    successCriteria: row.successCriteria,
    internalCompensation: row.internalCompensation,
    publicCompensation: row.publicCompensation,
    sourceRefs: row.sourceRefs,
    confirmationRef: row.confirmationRef,
    confirmedBy: row.confirmedBy,
    confirmedAt: row.confirmedAt?.toISOString(),
    contentHash: row.contentHash,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type SnapshotRow = {
  id: string;
  jobId: string;
  roleVersionId: string;
  status: string;
  audience: string;
  purpose: string;
  consumerModule: string | null;
  profileProjection: unknown;
  jdText: string | null;
  policyRefs: unknown;
  confirmationRef: unknown;
  sourceHash: string;
  projectionHash: string;
  projectionSchema: string;
  createdBy: string;
  createdAt: Date;
};

function serializeSnapshot(row: SnapshotRow) {
  return {
    id: row.id,
    jobId: row.jobId,
    roleVersionId: row.roleVersionId,
    status: row.status,
    audience: row.audience,
    purpose: row.purpose,
    consumerModule: row.consumerModule || undefined,
    profileProjection: row.profileProjection,
    jdText: row.jdText || undefined,
    policyRefs: row.policyRefs,
    confirmationRef: row.confirmationRef,
    sourceHash: row.sourceHash,
    projectionHash: row.projectionHash,
    projectionSchema: row.projectionSchema,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
