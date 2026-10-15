import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Identity } from '../intake/workspace.guard';

export type JdContent = {
  roleSummary?: string;
  responsibilities: string[];
  requirements: Array<{ id?: string; label?: string } & Record<string, unknown>>;
  // Raw JD text when the job was started from a subsystem entry (JD's IntakeService).
  sourceText?: string;
};

export type JdIntakeResult = { coreJobId: string; title: string; jdText: string; duplicate: boolean };

/**
 * Interview's window onto the JD subsystem: reads a job's role content (GET
 * /jobs/:jobId/drafts/current, the same endpoint hireos-screening-backend's
 * JobCriteriaFacade reads) and, for the new-task entry, hands raw JD text to JD's
 * POST /intake/jobs so the job is created there (and in Core Record), never locally.
 */
@Injectable()
export class JdContentFacade {
  private readonly baseUrl: string;
  private readonly serviceName: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('JD_BASE_URL', 'http://127.0.0.1:3005/api').replace(/\/$/, '');
    this.serviceName = this.config.get<string>('CORE_RECORD_SERVICE_NAME', 'interview');
  }

  /** Returns null when the job has no confirmed (or draft) JD yet -- not an error, just
   * nothing to show. attach() still succeeds without it; the recruiter can fill in a JD
   * later from the JD subsystem itself. */
  async get(identity: Identity, coreJobId: string): Promise<JdContent | null> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}/jobs/${coreJobId}/drafts/current`, {
        method: 'GET',
        headers: {
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
        code: 'JD_BACKEND_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'JD backend is unavailable.',
      });
    }
    if (response.status === 404) return null;
    const body = await parseBody(response);
    if (!response.ok) {
      const error = body as { code?: string; message?: string };
      throw new ServiceUnavailableException({ code: error.code || 'JD_BACKEND_ERROR', message: error.message || `JD backend returned HTTP ${response.status}.` });
    }
    const value = body as { roleSummary?: unknown; responsibilities?: unknown; requirements?: unknown; sourceText?: unknown };
    return {
      roleSummary: typeof value.roleSummary === 'string' ? value.roleSummary : undefined,
      responsibilities: Array.isArray(value.responsibilities) ? value.responsibilities.map(String) : [],
      requirements: Array.isArray(value.requirements) ? (value.requirements as JdContent['requirements']) : [],
      sourceText: typeof value.sourceText === 'string' ? value.sourceText : undefined,
    };
  }

  /** Creates (or, for the same JD text, finds) the job in JD + Core Record. */
  async createFromText(identity: Identity, body: { text: string; coreMaterialId?: string }, idempotencyKey: string): Promise<JdIntakeResult> {
    let response: Response;
    try {
      response = await globalThis.fetch(`${this.baseUrl}/intake/jobs`, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
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
        code: 'JD_BACKEND_UNAVAILABLE',
        message: error instanceof Error ? error.message : 'JD backend is unavailable.',
      });
    }
    const result = await parseBody(response);
    if (!response.ok) {
      const error = result as { code?: string; message?: string };
      throw new ServiceUnavailableException({ code: error.code || 'JD_BACKEND_ERROR', message: error.message || `JD backend returned HTTP ${response.status}.` });
    }
    return result as JdIntakeResult;
  }
}

/** Flattens the structured JD draft into the plain text RubricService/splitText expect --
 * Interview only ever consumes JD content as prose, never edits its structure. */
export function formatJdText(content: JdContent, fallbackTitle: string): string {
  // JD only returns sourceText while the job's draft is still the one its intake wrote from the
  // AI's reading of the text, untouched by a person -- the pasted text is then the fullest version
  // of the JD. Once someone edits it in JD, sourceText is gone and their structured content is used.
  if (content.sourceText?.trim()) return content.sourceText.trim();
  const parts: string[] = [];
  if (content.roleSummary) parts.push(content.roleSummary.trim());
  if (content.responsibilities.length) {
    parts.push(['主要职责：', ...content.responsibilities.map((r) => `- ${r}`)].join('\n'));
  }
  if (content.requirements.length) {
    const labels = content.requirements.map((r) => String(r.label || r.id || '')).filter(Boolean);
    if (labels.length) parts.push(['任职要求：', ...labels.map((l) => `- ${l}`)].join('\n'));
  }
  return parts.join('\n\n') || fallbackTitle;
}

async function parseBody(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return response.json();
  return response.text();
}
