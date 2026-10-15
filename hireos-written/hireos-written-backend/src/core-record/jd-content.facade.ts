import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Identity } from '../auth/workspace.guard';

export type JdContent = {
  roleSummary?: string;
  responsibilities: string[];
  requirements: Array<{ id?: string; label?: string } & Record<string, unknown>>;
  // Raw JD text when the job was started from a subsystem entry (JD's IntakeService).
  sourceText?: string;
};

export type JdIntakeResult = { coreJobId: string; title: string; jdText: string; duplicate: boolean };

/**
 * Written's window onto the JD subsystem: reads a job's role content (GET
 * /jobs/:jobId/drafts/current) and, for the new-task entry, hands raw JD text to JD's
 * POST /intake/jobs so the job is created there (and in Core Record), never locally.
 * Mirrors hireos-interview's jd-content.facade.ts.
 */
@Injectable()
export class JdContentFacade {
  private readonly baseUrl: string;
  private readonly serviceName: string;
  private readonly serviceToken: string;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('JD_BASE_URL', 'http://127.0.0.1:3005/api').replace(/\/$/, '');
    this.serviceName = config.get<string>('CORE_RECORD_SERVICE_NAME', 'written');
    this.serviceToken = config.get<string>('SERVICE_TOKEN', '');
  }

  /** Null when the job has no JD draft yet -- not an error, there's just no content to show. */
  async get(identity: Identity, coreJobId: string): Promise<JdContent | null> {
    const response = await this.send(`/jobs/${encodeURIComponent(coreJobId)}/drafts/current`, identity, 'GET');
    if (response.status === 404) return null;
    const value = await this.parse<{ roleSummary?: unknown; responsibilities?: unknown; requirements?: unknown; sourceText?: unknown }>(response);
    return {
      roleSummary: typeof value.roleSummary === 'string' ? value.roleSummary : undefined,
      responsibilities: Array.isArray(value.responsibilities) ? value.responsibilities.map(String) : [],
      requirements: Array.isArray(value.requirements) ? (value.requirements as JdContent['requirements']) : [],
      sourceText: typeof value.sourceText === 'string' ? value.sourceText : undefined,
    };
  }

  /** Creates (or, for the same JD text, finds) the job in JD + Core Record. */
  async createFromText(identity: Identity, body: { text: string; coreMaterialId?: string }, idempotencyKey: string): Promise<JdIntakeResult> {
    return this.parse<JdIntakeResult>(await this.send('/intake/jobs', identity, 'POST', body, idempotencyKey));
  }

  private async send(path: string, identity: Identity, method: 'GET' | 'POST', body?: unknown, idempotencyKey?: string) {
    try {
      return await globalThis.fetch(`${this.baseUrl}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
          'x-request-id': randomUUID(),
          'x-correlation-id': `${this.serviceName}:${randomUUID()}`,
          'x-source-service': this.serviceName,
          'x-workspace-id': identity.workspaceId,
          'x-actor-id': identity.actorId,
          ...(this.serviceToken ? { 'x-hireos-service-token': this.serviceToken } : {}),
        },
      });
    } catch (error) {
      throw new ServiceUnavailableException({ code: 'JD_BACKEND_UNAVAILABLE', message: error instanceof Error ? error.message : 'JD backend is unavailable.' });
    }
  }

  private async parse<T>(response: Response): Promise<T> {
    const result = (response.headers.get('content-type') || '').includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) {
      const error = result as { code?: string; message?: string };
      throw new ServiceUnavailableException({ code: error.code || 'JD_BACKEND_ERROR', message: error.message || `JD backend returned HTTP ${response.status}.` });
    }
    return result as T;
  }
}

/**
 * The JD as prose. JD only returns sourceText while the job's draft is still the one its intake
 * wrote from the AI's reading of the text, untouched by a person -- the pasted text is then the
 * fullest version. Once someone edits it in JD, their structured content is flattened instead.
 */
export function formatJdText(content: JdContent, fallbackTitle: string): string {
  if (content.sourceText?.trim()) return content.sourceText.trim();
  const parts: string[] = [];
  if (content.roleSummary) parts.push(content.roleSummary.trim());
  if (content.responsibilities.length) parts.push(['主要职责：', ...content.responsibilities.map((r) => `- ${r}`)].join('\n'));
  const labels = content.requirements.map((r) => String(r.label || r.id || '')).filter(Boolean);
  if (labels.length) parts.push(['任职要求：', ...labels.map((l) => `- ${l}`)].join('\n'));
  return parts.join('\n\n') || fallbackTitle;
}
