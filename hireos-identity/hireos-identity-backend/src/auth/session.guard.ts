import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { IdentityConfig } from '../identity.config';
import { SessionsService, type SessionIdentity } from '../sessions/sessions.service';
import { assertAllowedOrigin, sessionToken } from './http';

export type AuthedRequest = Request & { auth: SessionIdentity };

/** Guards the identity service's own signed-in routes (me, logout, member management). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionsService,
    private readonly config: IdentityConfig,
  ) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    assertAllowedOrigin(req, this.config.allowedOrigins);
    const session = await this.sessions.resolve(sessionToken(req));
    if (!session) throw new UnauthorizedException({ code: 'AUTH_REQUIRED', loginRequired: this.config.loginRequired });
    req.auth = session;
    return true;
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.auth?.roles.includes('admin')) throw new ForbiddenException({ code: 'ADMIN_REQUIRED' });
    return true;
  }
}
