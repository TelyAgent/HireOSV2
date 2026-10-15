import { ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import type { Identity } from '../auth/workspace.guard';

export type CoreJob = { id: string; title: string; team?: string; location?: string; employmentType?: string; seniority?: string; status: string };
export type CoreMaterial = { id: string; name: string; mime: string; size: number; hash: string; readStatus: string; securityStatus: string };
export type CoreCandidate = { id: string; displayName: string; email?: string; identityStatus: string; status: string };
export type CoreApplication = { id: string; candidateId: string; jobId: string; status: string };

/**
 * Written's window onto Core Record's master records, for the new-task entry (see
 * QuickStartService): it stores uploaded files, lists jobs for the picker, and registers the
 * Candidate + Application a case hangs off -- it never originates a Job (JD does). Mirrors
 * hireos-interview's core-record.client.ts.
 */
@Injectable()
export class CoreRecordClient {
  private readonly baseUrl: string;
  private readonly serviceName: string;
  private readonly serviceToken: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('CORE_RECORD_BASE_URL', 'http://127.0.0.1:3004/api/v1').replace(/\/$/, '');
    this.serviceName = config.get<string>('CORE_RECORD_SERVICE_NAME', 'written');
    this.serviceToken = config.get<string>('SERVICE_TOKEN', '');
  }

  /** Core Record's job directory; `status: 'open'` = published jobs only (filtered before Core's row cap). */
  listJobs(identity: Identity, query?: string, status?: string) {
    const params = new URLSearchParams();
    if (query?.trim()) params.set('q', query.trim());
    if (status) params.set('status', status);
    const qs = params.toString();
    return this.request<CoreJob[]>(`/jobs${qs ? `?${qs}` : ''}`, identity, 'GET');
  }

  getJob(identity: Identity, id: string) {
    return this.request<CoreJob>(`/jobs/${encodeURIComponent(id)}`, identity, 'GET');
  }

  getMaterial(identity: Identity, id: string) {
    return this.request<CoreMaterial>(`/materials/${encodeURIComponent(id)}`, identity, 'GET');
  }

  /** The Core candidate a résumé file belongs to -- shared by every subsystem that sees the same file. */
  resolveCandidateForMaterial(identity: Identity, body: { materialId: string; displayName: string; source: string }) {
    return this.request<CoreCandidate & { created: boolean }>('/candidates/from-material', identity, 'POST', body, randomUUID());
  }

  createApplication(identity: Identity, body: { candidateId: string; jobId: string; origin: string; linkReason: string }, idempotencyKey: string) {
    return this.request<CoreApplication>('/applications', identity, 'POST', body, idempotencyKey);
  }

  /** Stores the file in Core Record's shared Material master (hash-deduped across subsystems). */
  async uploadMaterial(identity: Identity, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<CoreMaterial> {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname);
    const response = await this.send('/materials', identity, { method: 'POST', body: form, idempotencyKey: randomUUID() });
    return this.parse<CoreMaterial>(response);
  }

  async downloadMaterialContent(identity: Identity, id: string): Promise<Buffer> {
    const response = await this.send(`/materials/${encodeURIComponent(id)}/content`, identity, { method: 'GET' });
    if (response.status === 404) throw new NotFoundException({ code: 'NOT_FOUND' });
    if (!response.ok) throw new ServiceUnavailableException({ code: 'CORE_RECORD_ERROR', message: `Core Record returned HTTP ${response.status}.` });
    return Buffer.from(await response.arrayBuffer());
  }

  private async request<T>(path: string, identity: Identity, method: 'GET' | 'POST', body?: unknown, idempotencyKey?: string): Promise<T> {
    const response = await this.send(path, identity, {
      method, idempotencyKey, json: true,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return this.parse<T>(response);
  }

  private async send(path: string, identity: Identity, init: { method: string; body?: BodyInit; idempotencyKey?: string; json?: boolean }) {
    try {
      return await globalThis.fetch(`${this.baseUrl}${path}`, {
        method: init.method,
        body: init.body,
        headers: {
          ...(init.json ? { 'content-type': 'application/json' } : {}),
          ...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
          'x-actor-id': identity.actorId,
          ...(this.serviceToken ? { 'x-hireos-service-token': this.serviceToken } : {}),
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException({ code: 'CORE_RECORD_UNAVAILABLE', message: error instanceof Error ? error.message : 'Core Record is unavailable.' });
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    if (response.status === 404) throw new NotFoundException({ code: 'NOT_FOUND' });
    const result = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const error = result as { code?: string; message?: string };
      // e.g. JOB_NOT_OPEN when linking a candidate to a closed/archived job.
      if (response.status === 409) throw new ConflictException({ code: error.code || 'CORE_RECORD_CONFLICT', message: error.message });
      throw new ServiceUnavailableException({ code: error.code || 'CORE_RECORD_ERROR', message: error.message || `Core Record returned HTTP ${response.status}.` });
    }
    return result as T;
  }
}
