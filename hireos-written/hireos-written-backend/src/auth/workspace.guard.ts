import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Identity = { workspaceId: string; actorId: string };

/**
 * Dev-only auth stub, matching the same pattern used across hireos-jd-backend, hireos-screening-backend
 * and hireos-interview's intake guard — no real identity provider exists yet anywhere in this estate,
 * so every service fabricates a fixed identity in development and refuses all requests in production.
 */
@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.config.get('NODE_ENV') === 'production' || this.config.get('DEV_AUTH_ENABLED') !== 'true') {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED' });
    }
    const request = context.switchToHttp().getRequest<{ identity: Identity }>();
    request.identity = {
      workspaceId: this.config.get<string>('DEV_WORKSPACE_ID', 'local-screening-workspace'),
      actorId: this.config.get<string>('DEV_ACTOR_ID', 'local-written-user'),
    };
    return true;
  }
}
