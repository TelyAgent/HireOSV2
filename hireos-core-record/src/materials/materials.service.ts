import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { findIdempotent, storeIdempotency, type RequestMeta } from '../records';
import { writeAudit } from '../audit/audit.service';
import { writeOutbox } from '../outbox/outbox.service';

type MulterFile = Express.Multer.File;

const MAX_FILE_SIZE = 25 * 1024 * 1024;

@Injectable()
export class MaterialsService {
  constructor(
    private readonly db: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The one place a file actually lands in the platform: hash it, dedupe by
   * (workspaceId, hash) so the same file uploaded twice (from this subsystem or a
   * different one) never gets two master records, then persist bytes to disk and
   * register the Material row. Every other subsystem (Screening, Interview, ...)
   * calls this instead of keeping its own copy of "the file" -- see
   * docs/HireOS-Database-Architecture-Decision.md §4.1.
   */
  async create(identity: Identity, file: MulterFile | undefined, candidateId: string | undefined, meta: RequestMeta) {
    if (!file || !file.size) throw new BadRequestException({ code: 'EMPTY_FILE' });
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException({ code: 'FILE_TOO_LARGE', maxBytes: MAX_FILE_SIZE });

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const operation = 'material.create';
    return this.db.$transaction(async (tx) => {
      const prior = await findIdempotent(tx, identity, operation, meta, { hash, candidateId });
      if (prior.prior) return prior.prior.responseBody;

      if (candidateId) {
        const candidate = await tx.candidate.findFirst({ where: { id: candidateId, workspaceId: identity.workspaceId } });
        if (!candidate) throw new NotFoundException({ code: 'NOT_FOUND' });
      }

      // Same file, same workspace, regardless of who uploaded it or from which
      // subsystem -- this is the cross-subsystem dedup the old per-subsystem Material
      // tables could never see.
      const duplicate = await tx.material.findUnique({
        where: { workspaceId_hash: { workspaceId: identity.workspaceId, hash } },
      });
      if (duplicate) {
        const result = serialize(duplicate);
        await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
        return result;
      }

      const storageRoot = resolve(this.config.get<string>('STORAGE_DIR', '.local/materials'));
      await mkdir(storageRoot, { recursive: true, mode: 0o700 });
      const storageKey = randomUUID();
      const storagePath = join(storageRoot, storageKey);
      await writeFile(storagePath, file.buffer, { mode: 0o600, flag: 'wx' });

      try {
        const material = await tx.material.create({
          data: {
            workspaceId: identity.workspaceId,
            name: decodeOriginalFileName(file.originalname).slice(0, 255),
            mime: file.mimetype,
            size: file.size,
            hash,
            storageKey,
            candidateId,
            readStatus: 'available',
            securityStatus: 'not_scanned',
          },
        });
        const result = serialize(material);
        await storeIdempotency(tx, identity, operation, prior.key, prior.hash, result);
        await writeAudit(tx, identity, meta, {
          action: 'material.received',
          objectType: 'Material',
          objectId: material.id,
          afterVersion: material.version,
          payload: { name: material.name, mime: material.mime, hash: material.hash },
        });
        await writeOutbox(tx, identity, meta, {
          eventType: 'material.received',
          aggregateType: 'Material',
          aggregateId: material.id,
          aggregateVersion: material.version,
          payload: { materialId: material.id, candidateId: material.candidateId, readStatus: material.readStatus },
        });
        return result;
      } catch (error) {
        await unlink(storagePath).catch(() => undefined);
        throw error;
      }
    });
  }

  async get(identity: Identity, id: string) {
    const material = await this.db.material.findFirst({
      where: { id, workspaceId: identity.workspaceId },
      include: { candidate: { select: { id: true, displayName: true } } },
    });
    if (!material) throw new NotFoundException({ code: 'NOT_FOUND' });
    return { ...serialize(material), candidate: material.candidate || undefined };
  }

  async download(identity: Identity, id: string, meta: RequestMeta) {
    const material = await this.assertReadable(identity, id);
    await this.db.auditRecord.create({
      data: {
        workspaceId: identity.workspaceId,
        actorId: identity.actorId,
        action: 'material.downloaded',
        objectType: 'Material',
        objectId: id,
        payload: { purpose: 'api_download', requestId: meta.requestId },
        requestId: meta.requestId,
        correlationId: meta.correlationId,
      },
    });
    return {
      materialId: material.id,
      name: material.name,
      mime: material.mime,
      status: 'authorized',
      downloadUrl: `/api/v1/materials/${material.id}/content`,
    };
  }

  /** Actually streams the bytes -- `download()` above stays a metadata/authorization
   * check callers can poll without pulling the whole file across the wire. */
  async readContent(identity: Identity, id: string) {
    const material = await this.assertReadable(identity, id);
    const storageRoot = resolve(this.config.get<string>('STORAGE_DIR', '.local/materials'));
    const storagePath = join(storageRoot, material.storageKey);
    return { stream: createReadStream(storagePath), name: material.name, mime: material.mime };
  }

  private async assertReadable(identity: Identity, id: string) {
    const material = await this.db.material.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!material) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (material.securityStatus === 'quarantined' || material.readStatus === 'invalidated') {
      throw new ConflictException({ code: 'MATERIAL_UNAVAILABLE' });
    }
    return material;
  }
}

function serialize(material: {
  id: string;
  workspaceId: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
  storageKey: string;
  readStatus: string;
  securityStatus: string;
  version: number;
  candidateId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: material.id,
    workspaceId: material.workspaceId,
    name: material.name,
    mime: material.mime,
    size: material.size,
    hash: material.hash,
    readStatus: material.readStatus,
    securityStatus: material.securityStatus,
    version: material.version,
    candidateId: material.candidateId || undefined,
    createdAt: material.createdAt.toISOString(),
    updatedAt: material.updatedAt.toISOString(),
  };
}

// Node's HTTP parser decodes multipart header fields (including the filename in
// Content-Disposition) as latin1 per the HTTP spec, even when the browser sent a UTF-8
// filename. Multer/busboy pass that mis-decoded string straight through as
// `file.originalname`, so every non-ASCII filename needs this reversed before it's
// stored or displayed anywhere.
function decodeOriginalFileName(name: string): string {
  return Buffer.from(name, 'latin1').toString('utf8');
}
