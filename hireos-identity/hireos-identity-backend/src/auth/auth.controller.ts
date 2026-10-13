import { BadRequestException, Body, Controller, Get, HttpCode, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { IdentityConfig } from '../identity.config';
import { PrismaService } from '../persistence/prisma.service';
import { SessionsService, type SessionIdentity } from '../sessions/sessions.service';
import { sanitizeReturnTo } from './auth-crypto';
import { AuthService, type SignedIn } from './auth.service';
import { assertAllowedOrigin, clearSessionCookie, requestMeta, sessionToken, setSessionCookie } from './http';
import { SessionGuard, type AuthedRequest } from './session.guard';

const codeSchema = z.object({ email: z.string().max(254), locale: z.string().max(10).optional() });
const verifySchema = z.object({ email: z.string().max(254), code: z.string().max(20), returnTo: z.string().max(2000).optional() });
const devLoginSchema = z.object({ email: z.string().max(254), returnTo: z.string().max(2000).optional() });
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(100).optional(), locale: z.enum(['zh', 'en']).optional() });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'INVALID_REQUEST', message: result.error.message });
  return result.data;
}

export function serializeMe(identity: SessionIdentity) {
  return {
    user: {
      id: identity.userId,
      email: identity.email,
      displayName: identity.displayName,
      avatarColor: identity.avatarColor,
      locale: identity.locale,
    },
    workspace: { id: identity.workspaceId, name: identity.workspaceName },
    roles: identity.roles,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly config: IdentityConfig,
    private readonly db: PrismaService,
  ) {}

  /** Public: tells the front ends whether to send signed-out visitors to the sign-in page. */
  @Get('config')
  getConfig() {
    return { loginRequired: this.config.loginRequired, devLogin: this.config.devLoginEnabled };
  }

  @Post('code')
  @HttpCode(200)
  requestCode(@Req() req: Request, @Body() body: unknown) {
    assertAllowedOrigin(req, this.config.allowedOrigins);
    const input = parse(codeSchema, body);
    return this.auth.requestCode(input.email, input.locale, requestMeta(req, this.config.trustedProxyHops));
  }

  @Post('verify')
  @HttpCode(200)
  async verify(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    assertAllowedOrigin(req, this.config.allowedOrigins);
    const input = parse(verifySchema, body);
    const signedIn = await this.auth.verifyCode(input.email, input.code, requestMeta(req, this.config.trustedProxyHops));
    return this.finishSignIn(res, signedIn, input.returnTo);
  }

  @Get('dev-accounts')
  devAccounts() {
    return this.auth.devAccounts();
  }

  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: unknown) {
    assertAllowedOrigin(req, this.config.allowedOrigins);
    const input = parse(devLoginSchema, body);
    const signedIn = await this.auth.devLogin(input.email, requestMeta(req, this.config.trustedProxyHops));
    return this.finishSignIn(res, signedIn, input.returnTo);
  }

  /** Every front end calls this on load; it also re-issues the cookie so its expiry slides with the session. */
  @Get('me')
  @UseGuards(SessionGuard)
  me(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    const token = sessionToken(req);
    if (token) setSessionCookie(res, this.config, token, req.auth.expiresAt);
    return serializeMe(req.auth);
  }

  @Patch('me')
  @UseGuards(SessionGuard)
  async updateMe(@Req() req: AuthedRequest, @Body() body: unknown) {
    const input = parse(profileSchema, body);
    await this.db.user.update({ where: { id: req.auth.userId }, data: input });
    const refreshed = await this.sessions.resolve(sessionToken(req));
    return serializeMe(refreshed ?? req.auth);
  }

  /** Always clears the cookie, even when the session is already gone. */
  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    assertAllowedOrigin(req, this.config.allowedOrigins);
    const session = await this.sessions.resolve(sessionToken(req));
    if (session) {
      await this.sessions.revoke(session.sessionId);
      await this.db.authEvent.create({ data: { type: 'logout', userId: session.userId, ...requestMeta(req, this.config.trustedProxyHops) } });
    }
    clearSessionCookie(res, this.config);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async logoutAll(@Req() req: AuthedRequest, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeAllForUser(req.auth.userId);
    await this.db.authEvent.create({ data: { type: 'logout_all', userId: req.auth.userId, ...requestMeta(req, this.config.trustedProxyHops) } });
    clearSessionCookie(res, this.config);
    return { ok: true };
  }

  private finishSignIn(res: Response, signedIn: SignedIn, returnTo: string | undefined) {
    setSessionCookie(res, this.config, signedIn.token, signedIn.expiresAt);
    return { ...serializeMe(signedIn.identity), returnTo: sanitizeReturnTo(returnTo, this.config.basePath) };
  }
}
