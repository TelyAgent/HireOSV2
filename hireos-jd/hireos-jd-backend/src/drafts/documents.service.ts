import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import type { Identity } from '../auth/workspace.guard';
import { PrismaService } from '../persistence/prisma.service';
import { json } from '../records';

const AUDIENCES = ['internal', 'external'] as const;
type DocumentAudience = (typeof AUDIENCES)[number];

// Blocks are the frontend editor's own shape (see hireos-jd-front DocBlock); only the fields every
// block must have are checked, the rest is stored as-is.
const blockSchema = z
  .object({
    id: z.string().min(1).max(200),
    kind: z.string().min(1).max(40),
    text: z.union([z.string().max(20000), z.array(z.string().max(20000)).max(200)]),
  })
  .passthrough();

const saveSchema = z.object({
  blocks: z.array(blockSchema).max(500),
  /** Revision the client started editing from; omitted for the very first save. */
  baseRevision: z.number().int().positive().optional(),
});

@Injectable()
export class DocumentsService {
  constructor(private readonly db: PrismaService) {}

  async get(identity: Identity, jobId: string, audience: string) {
    const row = await this.db.jobDocument.findUnique({
      where: { workspaceId_jobId_audience: { workspaceId: identity.workspaceId, jobId, audience: parseAudience(audience) } },
    });
    if (!row) throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
    return serialize(row);
  }

  async save(identity: Identity, jobId: string, audience: string, raw: unknown) {
    const aud = parseAudience(audience);
    const input = saveSchema.parse(raw);
    const where = { workspaceId_jobId_audience: { workspaceId: identity.workspaceId, jobId, audience: aud } };
    return this.db.$transaction(async (tx) => {
      const current = await tx.jobDocument.findUnique({ where });
      if (!current) {
        const created = await tx.jobDocument.create({
          data: { workspaceId: identity.workspaceId, jobId, audience: aud, blocks: json(input.blocks), updatedBy: identity.actorId },
        });
        return serialize(created);
      }
      // Someone else saved since this client loaded the document — refuse instead of silently
      // overwriting their edits.
      if (input.baseRevision !== undefined && input.baseRevision !== current.revision) {
        throw new ConflictException({ code: 'DOCUMENT_CONFLICT', message: '文档已被他人更新，请刷新后再保存。' });
      }
      const changed = await tx.jobDocument.updateMany({
        where: { id: current.id, revision: current.revision },
        data: { blocks: json(input.blocks), revision: { increment: 1 }, updatedBy: identity.actorId },
      });
      if (changed.count !== 1) throw new ConflictException({ code: 'DOCUMENT_CONFLICT', message: '文档已被他人更新，请刷新后再保存。' });
      return serialize(await tx.jobDocument.findUniqueOrThrow({ where: { id: current.id } }));
    });
  }
}

function parseAudience(value: string): DocumentAudience {
  if ((AUDIENCES as readonly string[]).includes(value)) return value as DocumentAudience;
  throw new BadRequestException({ code: 'INVALID_AUDIENCE', message: 'audience must be "internal" or "external".' });
}

function serialize(row: { jobId: string; audience: string; blocks: unknown; revision: number; updatedBy: string; updatedAt: Date }) {
  return {
    jobId: row.jobId,
    audience: row.audience,
    blocks: row.blocks,
    revision: row.revision,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}
