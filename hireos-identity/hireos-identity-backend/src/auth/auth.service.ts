import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { IdentityConfig } from '../identity.config';
import { MailService } from '../mail/mail.service';
import { mailLocale, renderLoginCodeEmail } from '../mail/templates';
import { SessionsService, type RequestMeta, type SessionIdentity } from '../sessions/sessions.service';
import { CODE_MAX_ATTEMPTS, CODE_TTL_MS, generateCode, hashCode, isValidEmail, normalizeEmail, safeEqualHex } from './auth-crypto';

const RESEND_COOLDOWN_S = 60;
const EMAIL_HOURLY_LIMIT = 5;
const IP_HOURLY_LIMIT = 20;
const HOUR_MS = 60 * 60 * 1000;

export type SignedIn = { token: string; expiresAt: Date; identity: SessionIdentity };

function rateLimited(retryAfterSeconds: number): HttpException {
  return new HttpException(
    { code: 'CODE_RATE_LIMITED', message: 'Too many code requests — try again later.', retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)) },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly mail: MailService,
    private readonly sessions: SessionsService,
  ) {}

  /**
   * Responds identically whether or not the email may sign in, so the endpoint can't be used to
   * discover who works here; uninvited emails just never receive a code.
   */
  async requestCode(rawEmail: string, localeHint: string | undefined, meta: RequestMeta) {
    const email = normalizeEmail(rawEmail);
    if (!isValidEmail(email)) throw new BadRequestException({ code: 'INVALID_EMAIL', message: 'Enter a valid email address.' });
    await this.enforceRateLimits(email, meta.ip ?? null);

    const user = await this.signInEligibleUser(email);
    await this.db.authEvent.create({
      data: { type: 'code_requested', email, userId: user?.id ?? null, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null, detail: { eligible: Boolean(user) } },
    });

    if (user) {
      const code = generateCode();
      const now = new Date();
      // A new code supersedes every earlier unused one for this email.
      await this.db.loginCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: now } });
      const record = await this.db.loginCode.create({
        data: { email, codeHash: hashCode(code, this.config.loginCodeSecret), expiresAt: new Date(now.getTime() + CODE_TTL_MS), requestIp: meta.ip ?? null },
      });
      try {
        await this.mail.send(email, renderLoginCodeEmail(code, mailLocale(user.locale || localeHint)));
      } catch (error) {
        await this.db.loginCode.delete({ where: { id: record.id } });
        this.logger.error(`Sign-in code email to ${email} failed: ${error instanceof Error ? error.message : String(error)}`);
        throw new ServiceUnavailableException({ code: 'MAIL_UNAVAILABLE', message: 'Could not send the code — please try again shortly.' });
      }
    }
    return { sent: true, resendAfterSeconds: RESEND_COOLDOWN_S, expiresInSeconds: CODE_TTL_MS / 1000 };
  }

  async verifyCode(rawEmail: string, rawCode: string, meta: RequestMeta): Promise<SignedIn> {
    const email = normalizeEmail(rawEmail);
    const code = rawCode.replace(/\s+/g, '');
    const invalid = (attemptsLeft: number) =>
      new BadRequestException({ code: 'CODE_INVALID', message: 'The code is incorrect or has expired.', attemptsLeft });
    if (!isValidEmail(email) || !/^\d{6}$/.test(code)) throw invalid(CODE_MAX_ATTEMPTS);

    const record = await this.db.loginCode.findFirst({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.attempts >= CODE_MAX_ATTEMPTS) throw invalid(0);

    if (!safeEqualHex(record.codeHash, hashCode(code, this.config.loginCodeSecret))) {
      const updated = await this.db.loginCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
      await this.db.authEvent.create({ data: { type: 'code_failed', email, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null } });
      throw invalid(Math.max(0, CODE_MAX_ATTEMPTS - updated.attempts));
    }

    // Conditional consume: two concurrent submits of the same code can't both sign in.
    const consumed = await this.db.loginCode.updateMany({ where: { id: record.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) throw invalid(0);

    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (user?.status === 'disabled') throw new ForbiddenException({ code: 'USER_DISABLED', message: 'This account has been disabled.' });
    const membership = user?.memberships.find((m) => m.workspaceId === this.config.workspaceId && m.status !== 'removed');
    if (!user || !membership) throw invalid(0);

    return this.signIn(user.id, membership.status === 'invited', meta, 'code');
  }

  async devLogin(rawEmail: string, meta: RequestMeta): Promise<SignedIn> {
    if (!this.config.devLoginEnabled) throw new NotFoundException();
    const user = await this.signInEligibleUser(normalizeEmail(rawEmail));
    if (!user) throw new BadRequestException({ code: 'UNKNOWN_DEMO_ACCOUNT' });
    const membership = user.memberships.find((m) => m.workspaceId === this.config.workspaceId);
    return this.signIn(user.id, membership?.status === 'invited', meta, 'dev');
  }

  async devAccounts() {
    if (!this.config.devLoginEnabled) return [];
    const members = await this.db.membership.findMany({
      where: { workspaceId: this.config.workspaceId, status: { not: 'removed' }, user: { status: 'active' } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({ email: m.user.email, displayName: m.user.displayName, avatarColor: m.user.avatarColor, roles: m.roles }));
  }

  private async signIn(userId: string, activateMembership: boolean, meta: RequestMeta, method: 'code' | 'dev'): Promise<SignedIn> {
    const workspaceId = this.config.workspaceId;
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }),
      ...(activateMembership
        ? [this.db.membership.update({ where: { userId_workspaceId: { userId, workspaceId } }, data: { status: 'active' } })]
        : []),
      this.db.authEvent.create({ data: { type: 'login_succeeded', userId, ip: meta.ip ?? null, userAgent: meta.userAgent ?? null, detail: { method } } }),
    ]);
    const { token, expiresAt } = await this.sessions.create(userId, workspaceId, meta);
    const identity = await this.sessions.resolve(token);
    if (!identity) throw new ServiceUnavailableException({ code: 'SESSION_UNAVAILABLE' });
    return { token, expiresAt, identity };
  }

  /** Invited or active member of the workspace, with an active user account. */
  private async signInEligibleUser(email: string) {
    const user = await this.db.user.findUnique({ where: { email }, include: { memberships: true } });
    if (!user || user.status !== 'active') return null;
    const membership = user.memberships.find((m) => m.workspaceId === this.config.workspaceId && m.status !== 'removed');
    return membership ? user : null;
  }

  private async enforceRateLimits(email: string, ip: string | null) {
    const now = Date.now();
    const hourAgo = new Date(now - HOUR_MS);
    const recent = await this.db.authEvent.findMany({
      where: { type: 'code_requested', email, createdAt: { gt: hourAgo } },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const last = recent[recent.length - 1];
    if (last && now - last.createdAt.getTime() < RESEND_COOLDOWN_S * 1000) {
      throw rateLimited(RESEND_COOLDOWN_S - (now - last.createdAt.getTime()) / 1000);
    }
    if (recent.length >= EMAIL_HOURLY_LIMIT) {
      throw rateLimited((recent[0].createdAt.getTime() + HOUR_MS - now) / 1000);
    }
    if (ip) {
      const fromIp = await this.db.authEvent.count({ where: { type: 'code_requested', ip, createdAt: { gt: hourAgo } } });
      if (fromIp >= IP_HOURLY_LIMIT) throw rateLimited(15 * 60);
    }
  }
}
