import { BadRequestException, Body, Controller, ForbiddenException, HttpCode, Post, Req, ServiceUnavailableException } from '@nestjs/common';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { IdentityConfig } from '../identity.config';
import { SessionsService } from '../sessions/sessions.service';
import { PrismaService } from '../persistence/prisma.service';

/**
 * Backend-to-backend only. The gateways never forward `/account/api/internal/*`, and every call
 * must carry the shared INTERNAL_TOKEN as well.
 */
@Controller('internal')
export class InternalController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly config: IdentityConfig,
    private readonly db: PrismaService,
  ) {}

  @Post('memberships/verify')
  @HttpCode(200)
  async verifyMember(@Req() req: Request, @Body() body: { workspaceId?: unknown; userId?: unknown }) {
    this.assertInternal(req);
    if (typeof body?.workspaceId !== 'string' || typeof body?.userId !== 'string' ||
        !body.workspaceId.trim() || !body.userId.trim() || body.workspaceId.length > 200 || body.userId.length > 200) {
      throw new BadRequestException({ code: 'INVALID_REQUEST' });
    }
    const member = await this.db.membership.findFirst({ where: {
      workspaceId: body.workspaceId, userId: body.userId, status: 'active', user: { status: 'active' },
    }, select: { userId: true, workspaceId: true } });
    return { active: Boolean(member), ...(member ?? {}) };
  }

  @Post('sessions/introspect')
  @HttpCode(200)
  async introspect(@Req() req: Request, @Body() body: { token?: unknown }) {
    this.assertInternal(req);
    const identity = await this.sessions.resolve(typeof body?.token === 'string' ? body.token : null);
    if (!identity) return { active: false };
    return {
      active: true,
      userId: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
      workspaceId: identity.workspaceId,
      roles: identity.roles,
      expiresAt: identity.expiresAt,
    };
  }

  private assertInternal(req: Request) {
    const expected = this.config.internalToken;
    if (!expected) throw new ServiceUnavailableException({ code: 'INTERNAL_TOKEN_NOT_CONFIGURED' });
    const given = req.headers['x-internal-token'];
    const value = Buffer.from(typeof given === 'string' ? given : '');
    const target = Buffer.from(expected);
    if (value.length !== target.length || !timingSafeEqual(value, target)) throw new ForbiddenException({ code: 'INTERNAL_ONLY' });
  }
}
