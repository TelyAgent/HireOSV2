import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Identity } from '../intake/workspace.guard';

export type CoreJob = {
  id: string;
  title: string;
  team?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  status: string;
};

export type CoreMaterial = {
  id: string;
  name: string;
  mime: string;
  size: number;
  hash: string;
  readStatus: string;
  securityStatus: string;
};

/**
 * Read-only on purpose: Interview never originates a Job (see Job's schema comment) --
 * it only looks up jobs that JD or Screening already registered with Core Record. This
 * mirrors hireos-screening-backend's core-record.client.ts, trimmed to the two calls
 * Interview actually needs.
 */
@Injectable()
export class CoreRecordClient {
  private readonly baseUrl: string;
  private readonly serviceName: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CORE_RECORD_BASE_URL', 'http://127.0.0.1:3004/api/v1').replace(/\/$/, '');
    this.serviceName = this.config.get<string>('CORE_RECORD_SERVICE_NAME', 'interview');
  }

  async listJobs(identity: Identity, query?: string): Promise<CoreJob[]> {
    const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return this.request<CoreJob[]>(`/jobs${qs}`, identity, 'GET');
  }

  async getJob(identity: Identity, id: string): Promise<CoreJob> {
    return this.request<CoreJob>(`/jobs/${id}`, identity, 'GET');
  }

  async getMaterial(identity: Identity, id: string): Promise<CoreMaterial> {
    return this.request<CoreMaterial>(`/materials/${id}`, identity, 'GET');
  }

  /**
   * Pulls the raw bytes of a material Core Record already holds -- used when a
   * screening hand-off references a résumé by coreMaterialId (see
   * ScreeningHandoffService) and Interview needs to extract its own local text/
   * segments from it, the same way it would for a freshly uploaded file.
   */
  async downloadMaterialContent(identity: Identity, id: string): Promise<Buffer> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}/materials/${id}/content`, {
        method: 'GET',
        headers: {
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CORE_RECORD_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Core Record is unavailable.',
      });
    }
    if (response.status === 404) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!response.ok) {
      throw new ServiceUnavailableException({ code: 'CORE_RECORD_ERROR', message: `Core Record returned HTTP ${response.status}.` });
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Registers a file with Core Record's shared Material master (see
   * docs/HireOS-Database-Architecture-Decision.md §4.1) -- this is the one and only
   * place a résumé's raw bytes get stored; Interview keeps a local Material row too
   * (its own extracted text/segments are business-specific, not Core Record's concern)
   * but the identity of "is this the same file" now lives here, shared with every
   * other subsystem.
   */
  async uploadMaterial(identity: Identity, file: { buffer: Buffer; originalname: string; mimetype: string }, candidateId?: string): Promise<CoreMaterial> {
    const form = new FormData();
    // Buffer's underlying ArrayBufferLike can theoretically be a SharedArrayBuffer, which
    // BlobPart's type doesn't accept -- Uint8Array.from copies into a plain, freshly
    // allocated ArrayBuffer to satisfy that.
    form.append('file', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname);
    if (candidateId) form.append('candidateId', candidateId);
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}/materials`, {
        method: 'POST',
        headers: {
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
          'idempotency-key': randomUUID(),
        },
        body: form,
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CORE_RECORD_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Core Record is unavailable.',
      });
    }
    const body = await parseBody(response);
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ServiceUnavailableException({ code: error.code || 'CORE_RECORD_ERROR', message: error.message || `Core Record returned HTTP ${response.status}.` });
    }
    return body as CoreMaterial;
  }

  private async request<T>(path: string, identity: Identity, method: 'GET'): Promise<T> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CORE_RECORD_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Core Record is unavailable.',
      });
    }
    if (response.status === 404) throw new NotFoundException({ code: 'NOT_FOUND' });
    const body = await parseBody(response);
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ServiceUnavailableException({ code: error.code || 'CORE_RECORD_ERROR', message: error.message || `Core Record returned HTTP ${response.status}.` });
    }
    return body as T;
  }
}

async function parseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

// Core Record's Job.status ('draft'|'open'|'paused'|'closed'|'archived') collapses to the
// coarser set the Interview UI's role-status counters expect -- 'draft'/'archived' both
// read as "not actively hiring" but aren't the same as an explicit 'closed' decision.
export function mapRecruitingStatus(coreStatus: string): 'open' | 'paused' | 'closed' | 'unknown' {
  if (coreStatus === 'open') return 'open';
  if (coreStatus === 'paused') return 'paused';
  if (coreStatus === 'closed' || coreStatus === 'archived') return 'closed';
  return 'unknown';
}
