import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Buffer } from 'node:buffer';
import { timingSafeEqual } from 'node:crypto';

/*
 * Shared HireOS request authentication. The same file lives in every backend (core-record, jd,
 * screening, interview, written) — keep the copies identical apart from DEV_ACTOR_FALLBACK.
 *
 * Who is calling, in order:
 *  1. Another HireOS backend: `x-hireos-service-token` matches SERVICE_TOKEN → the caller forwards the
 *     user it acts for in `x-workspace-id` / `x-actor-id`.
 *  2. A signed-in browser: the `hireos_sid` cookie is checked against the identity service
 *     (IDENTITY_INTERNAL_URL + IDENTITY_INTERNAL_TOKEN) on every request — not cached, so signing
 *     out or removing a member takes effect on the very next call.
 *  3. AUTH_MODE=dev (the default) only: no session → the fixed local development identity,
 *     exactly as before the identity service existed. AUTH_MODE=session refuses instead.
 */
const DEV_ACTOR_FALLBACK = 'local-user';

export type Identity = {
  workspaceId: string;
  actorId: string;
  roles: string[];
  /** Absent on identities built in-process (e.g. background jobs). */
  kind?: 'user' | 'service' | 'dev';
  email?: string;
  displayName?: string;
};

type Headers = Record<string, string | string[] | undefined>;
type Introspection = { active: boolean; userId?: string; email?: string; displayName?: string; workspaceId?: string; roles?: string[] };

const SESSION_COOKIE = 'hireos_sid';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function header(headers: Headers, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  for (const part of (cookieHeader || '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

function sameSecret(given: string | undefined, expected: string): boolean {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class WorkspaceGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceGuard.name);

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: Headers; method: string; identity: Identity }>();
    request.identity = await this.authenticate(request);
    return true;
  }

  private get sessionMode() {
    return this.config.get<string>('AUTH_MODE') === 'session';
  }

  private async authenticate(request: { headers: Headers; method: string }): Promise<Identity> {
    const service = this.serviceIdentity(request.headers);
    if (service) return service;

    const token = readCookie(header(request.headers, 'cookie'), SESSION_COOKIE);
    if (token) {
      let user: Identity | null = null;
      try {
        user = await this.introspect(token);
      } catch (error) {
        if (this.sessionMode) throw new ServiceUnavailableException({ code: 'IDENTITY_UNAVAILABLE', message: 'Sign-in service is unavailable.' });
        this.logger.warn(`Session check skipped (identity service unreachable): ${error instanceof Error ? error.message : String(error)}`);
      }
      if (user) {
        this.assertAllowedOrigin(request);
        return user;
      }
    }

    if (!this.sessionMode && this.config.get('NODE_ENV') !== 'production' && this.config.get('DEV_AUTH_ENABLED') === 'true') {
      return {
        workspaceId: this.config.get<string>('DEV_WORKSPACE_ID', 'local-screening-workspace'),
        actorId: this.config.get<string>('DEV_ACTOR_ID', DEV_ACTOR_FALLBACK),
        roles: ['admin', 'hr', 'interviewer'],
        kind: 'dev',
      };
    }
    throw new UnauthorizedException({ code: 'AUTH_REQUIRED' });
  }

  private serviceIdentity(headers: Headers): Identity | null {
    const given = header(headers, 'x-hireos-service-token');
    if (!given) return null;
    if (!sameSecret(given, this.config.get<string>('SERVICE_TOKEN', ''))) throw new UnauthorizedException({ code: 'INVALID_SERVICE_TOKEN' });
    const workspaceId = header(headers, 'x-workspace-id');
    if (!workspaceId) throw new UnauthorizedException({ code: 'WORKSPACE_REQUIRED' });
    return {
      workspaceId,
      actorId: header(headers, 'x-actor-id') || `service:${header(headers, 'x-source-service') || 'unknown'}`,
      roles: [],
      kind: 'service',
    };
  }

  private async introspect(token: string): Promise<Identity | null> {
    const baseUrl = this.config.get<string>('IDENTITY_INTERNAL_URL', '');
    if (!baseUrl) throw new Error('IDENTITY_INTERNAL_URL is not configured');
    const response = await globalThis.fetch(`${baseUrl.replace(/\/+$/, '')}/internal/sessions/introspect`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-internal-token': this.config.get<string>('IDENTITY_INTERNAL_TOKEN', '') },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new Error(`identity introspection returned HTTP ${response.status}`);
    const result = (await response.json()) as Introspection;
    return result.active && result.userId && result.workspaceId
      ? { workspaceId: result.workspaceId, actorId: result.userId, roles: result.roles ?? [], kind: 'user', email: result.email, displayName: result.displayName }
      : null;
  }

  /** CSRF backstop on top of SameSite=Lax for cookie-authenticated, state-changing requests. */
  private assertAllowedOrigin(request: { headers: Headers; method: string }) {
    if (SAFE_METHODS.has(request.method)) return;
    const allowed = (this.config.get<string>('ALLOWED_ORIGINS', '') || '').split(',').map((o) => o.trim()).filter(Boolean);
    const origin = header(request.headers, 'origin');
    if (allowed.length && origin && !allowed.includes(origin)) {
      throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' });
    }
  }
}
