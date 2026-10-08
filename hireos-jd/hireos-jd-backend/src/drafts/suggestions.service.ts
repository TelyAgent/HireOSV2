import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';

const AUDIENCES = ['internal', 'external'] as const;
const STATUSES = ['proposed', 'accepted', 'rejected', 'stale', 'cancelled'] as const;

const createSchema = z.object({
  anchorBlock: z.string().min(1).max(200),
  author: z.enum(['ai', 'human']),
  /** App-level person id of whoever asked for / typed the change (shown as the mark's author). */
  initiatedBy: z.string().min(1).max(200),
  instruction: z.string().max(4000).default(''),
  oldText: z.string().max(40000),
  newText: z.string().max(40000),
  newItems: z.array(z.string().max(20000)).max(200).nullable().optional(),
  reason: z.string().max(4000).default(''),
  supersedes: z.string().max(200).nullable().optional(),
});

const updateSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    staleReason: z.string().max(2000).nullable().optional(),
    /** Re-editing your own pending suggestion in Suggesting mode. */
    newText: z.string().max(40000).optional(),
    newItems: z.array(z.string().max(20000)).max(200).nullable().optional(),
  })
  .refine((x) => Object.keys(x).length > 0, { message: 'Nothing to update.' });

type Row = {
  id: string;
  anchorBlock: string;
  status: string;
  author: string;
  initiatedBy: string;
  createdBy: string;
  instruction: string;
  oldText: string;
  newText: string;
  newItems: unknown;
  reason: string;
  staleReason: string | null;
  supersedes: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class SuggestionsService {
  constructor(private readonly db: PrismaService) {}

  async list(identity: Identity, jobId: string, audience: string) {
    const rows = await this.db.jobDocumentSuggestion.findMany({
      where: { workspaceId: identity.workspaceId, jobId, audience: parseAudience(audience) },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serialize);
  }

  async create(identity: Identity, jobId: string, audience: string, raw: unknown) {
    const input = parse(createSchema, raw);
    const row = await this.db.jobDocumentSuggestion.create({
      data: {
        workspaceId: identity.workspaceId,
        jobId,
        audience: parseAudience(audience),
        anchorBlock: input.anchorBlock,
        author: input.author,
        initiatedBy: input.initiatedBy,
        createdBy: identity.actorId,
        instruction: input.instruction,
        oldText: input.oldText,
        newText: input.newText,
        newItems: input.newItems ? json(input.newItems) : undefined,
        reason: input.reason,
        supersedes: input.supersedes ?? null,
      },
    });
    return serialize(row);
  }

  async update(identity: Identity, jobId: string, audience: string, id: string, raw: unknown) {
    const input = parse(updateSchema, raw);
    const current = await this.db.jobDocumentSuggestion.findFirst({
      where: { id, workspaceId: identity.workspaceId, jobId, audience: parseAudience(audience) },
    });
    if (!current) throw new NotFoundException({ code: 'SUGGESTION_NOT_FOUND' });
    // Only a still-open proposal can be decided or edited; "stale" can still be dismissed.
    const open = current.status === 'proposed' || (current.status === 'stale' && input.status === 'cancelled');
    if (!open) {
      throw new ConflictException({ code: 'SUGGESTION_ALREADY_DECIDED', message: '该建议已被处理，请刷新后查看。' });
    }
    const deciding = input.status && input.status !== 'proposed' && input.status !== 'stale';
    const row = await this.db.jobDocumentSuggestion.update({
      where: { id: current.id },
      data: {
        status: input.status,
        staleReason: input.staleReason,
        newText: input.newText,
        newItems: input.newItems === undefined ? undefined : input.newItems === null ? Prisma.DbNull : json(input.newItems),
        decidedBy: deciding ? identity.actorId : undefined,
        decidedAt: deciding ? new Date() : undefined,
      },
    });
    return serialize(row);
  }
}

function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new BadRequestException({ code: 'INVALID_SUGGESTION', message: result.error.message });
  return result.data;
}

function parseAudience(value: string) {
  if ((AUDIENCES as readonly string[]).includes(value)) return value;
  throw new BadRequestException({ code: 'INVALID_AUDIENCE', message: 'audience must be "internal" or "external".' });
}

function serialize(row: Row) {
  return {
    id: row.id,
    anchorBlock: row.anchorBlock,
    status: row.status,
    author: row.author,
    initiatedBy: row.initiatedBy,
    createdBy: row.createdBy,
    instruction: row.instruction,
    oldText: row.oldText,
    newText: row.newText,
    newItems: Array.isArray(row.newItems) ? (row.newItems as string[]) : null,
    reason: row.reason,
    staleReason: row.staleReason ?? undefined,
    supersedes: row.supersedes ?? undefined,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
