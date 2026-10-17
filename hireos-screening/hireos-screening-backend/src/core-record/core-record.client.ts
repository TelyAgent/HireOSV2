import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import type { Identity } from '../auth/workspace.guard';

// A Core Record call's deadline when CORE_RECORD_TIMEOUT_MS isn't set; under the gateway's 60 s (#386).
const DEFAULT_TIMEOUT_MS = 30_000;

type CoreRecordMode = 'mock' | 'remote';

export type CoreCandidate = {
  id: string;
  workspaceId: string;
  displayName: string;
  email?: string;
  phone?: string;
  ownerId: string;
  version: number;
};

export type CoreJob = {
  id: string;
  workspaceId: string;
  title: string;
  team?: string;
  location?: string;
  employmentType?: string;
  seniority?: string;
  status: string;
  openings: number;
  version: number;
};

export type CoreApplication = {
  id: string;
  workspaceId: string;
  candidateId: string;
  jobId: string;
  cycleId: string;
  status: string;
  origin: string;
  linkReason: string;
  linkedBy: string;
  version: number;
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

@Injectable()
export class CoreRecordClient {
  private readonly mode: CoreRecordMode;
  private readonly baseUrl: string;
  private readonly serviceName: string;

  constructor(private readonly config: ConfigService) {
    const configuredMode = this.config.get<string>('CORE_RECORD_MODE', 'mock');
    this.mode = configuredMode === 'remote' ? 'remote' : 'mock';
    this.baseUrl = this.config.get<string>('CORE_RECORD_BASE_URL', 'http://127.0.0.1:3004/api/v1').replace(/\/$/, '');
    this.serviceName = this.config.get<string>('CORE_RECORD_SERVICE_NAME', 'screening');
  }

  getStatus() {
    return { mode: this.mode, baseUrl: this.baseUrl, serviceName: this.serviceName };
  }

  async createCandidate(
    identity: Identity,
    input: { displayName: string; email?: string; phone?: string; source?: string },
    idempotencyKey: string = randomUUID(),
  ): Promise<CoreCandidate | null> {
    if (this.mode === 'mock') return null;
    return this.request<CoreCandidate>('/candidates', identity, {
      method: 'POST',
      idempotencyKey,
      body: input,
    });
  }

  /**
   * The Core candidate a résumé file (Core material id) belongs to: the one already linked to it
   * -- e.g. by Interview or Written seeing the same file first -- or a new one linked to it now.
   */
  async resolveCandidateForMaterial(
    identity: Identity,
    input: { materialId: string; displayName: string; source?: string },
  ): Promise<(CoreCandidate & { created: boolean }) | null> {
    if (this.mode === 'mock') return null;
    return this.request<CoreCandidate & { created: boolean }>('/candidates/from-material', identity, {
      method: 'POST',
      idempotencyKey: randomUUID(),
      body: input,
    });
  }

  /** Core Record's job directory — the jobs HireOS JD creates and publishes live here. */
  async listJobs(identity: Identity): Promise<CoreJob[]> {
    if (this.mode === 'mock') return [];
    return this.request<CoreJob[]>('/jobs', identity, { method: 'GET' });
  }

  /**
   * The Core Record jobs with these ids, of any status and age; deleted ones are absent (#143). Asked in groups
   * of 100. A Core Record from before #143 ignores `ids` and answers with its directory -- jobs that weren't
   * asked for -- so that group is checked one job at a time instead.
   */
  async listJobsByIds(identity: Identity, ids: string[]): Promise<CoreJob[]> {
    if (this.mode === 'mock' || !ids.length) return [];
    const found: CoreJob[] = [];
    for (let i = 0; i < ids.length; i += 100) {
      const group = ids.slice(i, i + 100);
      const jobs = await this.request<CoreJob[]>(`/jobs?ids=${group.map(encodeURIComponent).join(',')}`, identity, { method: 'GET' });
      const asked = new Set(group);
      if (jobs.every((job) => asked.has(job.id))) {
        found.push(...jobs);
        continue;
      }
      for (const id of group) {
        const job = await this.getJob(identity, id);
        if (job) found.push(job);
      }
    }
    return found;
  }

  /** One Core Record job, or null once it no longer exists (HireOS JD hard-deletes unused jobs). */
  async getJob(identity: Identity, id: string): Promise<CoreJob | null> {
    if (this.mode === 'mock') return null;
    return this.request<CoreJob | null>(`/jobs/${encodeURIComponent(id)}`, identity, { method: 'GET', notFoundAsNull: true });
  }

  async createApplication(
    identity: Identity,
    input: { candidateId: string; jobId: string; cycleId?: string; origin?: string; linkReason: string },
    idempotencyKey: string = randomUUID(),
  ): Promise<CoreApplication | null> {
    if (this.mode === 'mock') return null;
    return this.request<CoreApplication>('/applications', identity, {
      method: 'POST',
      idempotencyKey,
      body: input,
    });
  }

  /**
   * Registers a file with Core Record's shared Material master (see
   * docs/HireOS-Database-Architecture-Decision.md §4.1) -- mirrors createCandidate/
   * createApplication's mock/remote split: in 'mock' mode this returns null
   * and MaterialsService.saveUpload falls back to its old local-only behavior (local
   * hash dedup, local disk write) exactly like it did before this migration.
   */
  async uploadMaterial(identity: Identity, file: { buffer: Buffer; originalname: string; mimetype: string }): Promise<CoreMaterial | null> {
    if (this.mode === 'mock') return null;
    const form = new FormData();
    // Buffer's underlying ArrayBufferLike can theoretically be a SharedArrayBuffer, which
    // BlobPart's type doesn't accept -- Uint8Array.from copies into a plain, freshly
    // allocated ArrayBuffer to satisfy that.
    form.append('file', new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname);
    const response = await withDeadline(globalThis.fetch(`${this.baseUrl}/materials`, {
      method: 'POST',
      signal: this.signalFor(identity, 'POST'),
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
    }));
    const body = await withDeadline(parseBody(response));
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ServiceUnavailableException({
        code: error.code || 'CORE_RECORD_UNAVAILABLE',
        message: error.message || `Core Record returned HTTP ${response.status}.`,
      });
    }
    return body as CoreMaterial;
  }

  /**
   * Every call has a deadline under the gateway's 60 s (CORE_RECORD_TIMEOUT_MS, default 30 s), past which it fails
   * with CORE_RECORD_TIMEOUT. A read also stops when the caller has gone away, since nobody is left to receive it;
   * a write runs on to its deadline, as stopping it halfway could leave the caller's own records half-written (#386).
   */
  private signalFor(identity: Identity, method: 'GET' | 'POST') {
    const deadline = AbortSignal.timeout(Number(process.env.CORE_RECORD_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS);
    return method === 'GET' && identity.signal ? AbortSignal.any([deadline, identity.signal]) : deadline;
  }

  private async request<T>(
    path: string,
    identity: Identity,
    input: { method: 'GET' | 'POST'; idempotencyKey?: string; body?: unknown; notFoundAsNull?: boolean },
  ): Promise<T> {
    const response = await withDeadline(globalThis.fetch(`${this.baseUrl}${path}`, {
      method: input.method,
      signal: this.signalFor(identity, input.method),
      headers: {
        'content-type': 'application/json',
        'x-request-id': randomUUID(),
        'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
        'x-source-service': this.serviceName,
        'x-workspace-id': identity.workspaceId,
        'x-actor-id': identity.actorId,
        ...(process.env.SERVICE_TOKEN ? { 'x-hireos-service-token': process.env.SERVICE_TOKEN } : {}),
        ...(input.idempotencyKey ? { 'idempotency-key': hashIdempotencyKey(input.idempotencyKey) } : {}),
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    }));
    if (input.notFoundAsNull && response.status === 404) return null as T;
    const body = await withDeadline(parseBody(response));
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      if (response.status === 409) {
        throw new ConflictException({ code: error.code || 'CORE_RECORD_CONFLICT', message: error.message || 'Core Record rejected the request.' });
      }
      throw new ServiceUnavailableException({
        code: error.code || 'CORE_RECORD_UNAVAILABLE',
        message: error.message || `Core Record returned HTTP ${response.status}.`,
      });
    }
    return body as T;
  }
}

function hashIdempotencyKey(raw: string): string {
  // Idempotency keys often embed free-text (candidate names, job titles) which
  // may contain non-Latin1 characters; HTTP header values must be ByteStrings,
  // so hash rather than pass the raw text through.
  return createHash('sha256').update(raw).digest('hex');
}

async function parseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}

/** A call past its deadline (#386) as Core Record being unavailable, with a code saying why. */
async function withDeadline<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if ((error as { name?: string } | null)?.name === 'TimeoutError') {
      throw new ServiceUnavailableException({ code: 'CORE_RECORD_TIMEOUT', message: 'Core Record did not answer in time.' });
    }
    throw error;
  }
}
