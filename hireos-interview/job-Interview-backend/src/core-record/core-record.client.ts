import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

export type CoreCandidate = { id: string; displayName: string; email?: string; identityStatus: string; status: string };
export type CoreApplication = { id: string; candidateId: string; jobId: string; status: string };

/**
 * Interview's window onto Core Record's master records. It never originates a Job (JD does,
 * see JdContentFacade.createFromText) but registers the Candidate and Application a task
 * hangs off, so every subsystem sees the same (job, candidate) pair. Mirrors
 * hireos-screening-backend's core-record.client.ts.
 */
@Injectable()
export class CoreRecordClient {
  private readonly baseUrl: string;
  private readonly serviceName: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CORE_RECORD_BASE_URL', 'http://127.0.0.1:3004/api/v1').replace(/\/$/, '');
    this.serviceName = this.config.get<string>('CORE_RECORD_SERVICE_NAME', 'interview');
  }

  /** Core Record's job directory; `status: 'open'` = published jobs only (filtered before Core's row cap). */
  async listJobs(identity: Identity, query?: string, status?: string): Promise<CoreJob[]> {
    const params = new URLSearchParams();
    if (query?.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    const qs = params.toString();
    return this.request<CoreJob[]>(`/jobs${qs ? `?${qs}` : ''}`, identity, 'GET');
  }

  async getJob(identity: Identity, id: string): Promise<CoreJob> {
    return this.request<CoreJob>(`/jobs/${id}`, identity, 'GET');
  }

  async createCandidate(identity: Identity, body: { displayName: string; source: string }, idempotencyKey: string): Promise<CoreCandidate> {
    return this.request<CoreCandidate>('/candidates', identity, 'POST', body, idempotencyKey);
  }

  /** The Core candidate a résumé file belongs to -- shared by every subsystem that sees the same file. */
  async resolveCandidateForMaterial(identity: Identity, body: { materialId: string; displayName: string; source: string }): Promise<CoreCandidate & { created: boolean }> {
    return this.request<CoreCandidate & { created: boolean }>('/candidates/from-material', identity, 'POST', body, randomUUID());
  }

  async findCandidatesByEmail(identity: Identity, email: string): Promise<CoreCandidate[]> {
    return this.request<CoreCandidate[]>(`/candidates?email=${encodeURIComponent(email)}`, identity, 'GET');
  }

  async createApplication(identity: Identity, body: { candidateId: string; jobId: string; origin: string; linkReason: string }, idempotencyKey: string): Promise<CoreApplication> {
    return this.request<CoreApplication>('/applications', identity, 'POST', body, idempotencyKey);
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
          'x-actor-id': identity.actorId,
          ...(process.env.SERVICE_TOKEN ? { 'x-hireos-service-token': process.env.SERVICE_TOKEN } : {}),
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
          'x-actor-id': identity.actorId,
          ...(process.env.SERVICE_TOKEN ? { 'x-hireos-service-token': process.env.SERVICE_TOKEN } : {}),
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

  private async request<T>(path: string, identity: Identity, method: 'GET' | 'POST', body?: unknown, idempotencyKey?: string): Promise<T> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
          'content-type': 'application/json',
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
          'x-actor-id': identity.actorId,
          ...(process.env.SERVICE_TOKEN ? { 'x-hireos-service-token': process.env.SERVICE_TOKEN } : {}),
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'CORE_RECORD_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'Core Record is unavailable.',
      });
    }
    if (response.status === 404) throw new NotFoundException({ code: 'NOT_FOUND' });
    const result = await parseBody(response);
    if (!response.ok) {
      const error = result as { code?: string; message?: string };
      // e.g. JOB_NOT_OPEN when linking a candidate to a closed/archived job.
      if (response.status === 409) throw new ConflictException({ code: error.code || 'CORE_RECORD_CONFLICT', message: error.message });
      throw new ServiceUnavailableException({ code: error.code || 'CORE_RECORD_ERROR', message: error.message || `Core Record returned HTTP ${response.status}.` });
    }
    return result as T;
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
