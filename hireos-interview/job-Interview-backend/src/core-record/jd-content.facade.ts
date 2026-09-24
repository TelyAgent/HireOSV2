import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { Identity } from '../intake/workspace.guard';

export type JdContent = {
  roleSummary?: string;
  responsibilities: string[];
  requirements: Array<{ id?: string; label?: string } & Record<string, unknown>>;
};

/**
 * Read-only proxy to the JD subsystem's confirmed role content (see
 * hireos-jd-backend's DraftsController — GET /jobs/:jobId/drafts/current), the same
 * endpoint hireos-screening-backend's JobCriteriaFacade already reads. Interview never
 * writes here: it has no JD-authoring capability of its own (see Job's schema comment).
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
    const value = body as { roleSummary?: unknown; responsibilities?: unknown; requirements?: unknown };
    return {
      roleSummary: typeof value.roleSummary === 'string' ? value.roleSummary : undefined,
      responsibilities: Array.isArray(value.responsibilities) ? value.responsibilities.map(String) : [],
      requirements: Array.isArray(value.requirements) ? (value.requirements as JdContent['requirements']) : [],
    };
  }
}

/** Flattens the structured JD draft into the plain text RubricService/splitText expect --
 * Interview only ever consumes JD content as prose, never edits its structure. */
export function formatJdText(content: JdContent, fallbackTitle: string): string {
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
