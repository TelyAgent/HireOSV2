import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { IdentityConfig } from '../identity.config';
import { MailService } from '../mail/mail.service';
import { mailLocale, renderInviteEmail } from '../mail/templates';
import { SessionsService, type SessionIdentity } from '../sessions/sessions.service';
import { avatarColorFor, isValidEmail, normalizeEmail, normalizeRoles, type Role } from '../auth/auth-crypto';

export type InviteInput = { email: string; displayName: string; roles: string[]; locale?: 'zh' | 'en'; sendEmail?: boolean };
export type UpdateInput = { displayName?: string; roles?: string[]; status?: 'active' | 'disabled' };

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
    private readonly sessions: SessionsService,
    private readonly mail: MailService,
  ) {}

  async list() {
    const members = await this.db.membership.findMany({
      where: { workspaceId: this.config.workspaceId, status: { not: 'removed' } },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m) => ({
      id: m.user.id,
      email: m.user.email,
      displayName: m.user.displayName,
      avatarColor: m.user.avatarColor,
      roles: normalizeRoles(m.roles),
      membershipStatus: m.status,
      status: m.user.status,
      lastLoginAt: m.user.lastLoginAt,
      createdAt: m.createdAt,
    }));
  }

  async invite(actor: SessionIdentity, input: InviteInput) {
    const email = normalizeEmail(input.email);
    if (!isValidEmail(email)) throw new BadRequestException({ code: 'INVALID_EMAIL' });
    const roles = this.requireRoles(input.roles);
    const workspaceId = this.config.workspaceId;

    const existing = await this.db.user.findUnique({ where: { email }, include: { memberships: true } });
    const membership = existing?.memberships.find((m) => m.workspaceId === workspaceId);
    if (membership && membership.status !== 'removed') throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'This email is already a member.' });

    const user = await this.db.$transaction(async (tx) => {
      const saved = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { displayName: input.displayName, status: 'active' } })
        : await tx.user.create({
            data: { email, displayName: input.displayName, avatarColor: avatarColorFor(email), locale: input.locale ?? 'zh' },
          });
      await tx.membership.upsert({
        where: { userId_workspaceId: { userId: saved.id, workspaceId } },
        update: { roles, status: 'invited', invitedBy: actor.userId },
        create: { userId: saved.id, workspaceId, roles, status: 'invited', invitedBy: actor.userId },
      });
      await tx.authEvent.create({ data: { type: 'user_invited', email, userId: saved.id, detail: { by: actor.userId, roles } } });
      return saved;
    });

    let emailSent = false;
    if (input.sendEmail) {
      try {
        const signInUrl = `${this.config.publicUrl}/account/login?email=${encodeURIComponent(email)}`;
        await this.mail.send(email, renderInviteEmail({ inviterName: actor.displayName, signInUrl, locale: mailLocale(user.locale) }));
        emailSent = true;
      } catch (error) {
        this.logger.warn(`Invite email to ${email} failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return { id: user.id, emailSent };
  }

  async update(actor: SessionIdentity, userId: string, input: UpdateInput) {
    const membership = await this.membershipOf(userId);
    const roles = input.roles ? this.requireRoles(input.roles) : undefined;
    const losesAdmin =
      membership.roles.includes('admin') && ((roles && !roles.includes('admin')) || input.status === 'disabled');
    if (input.status === 'disabled' && userId === actor.userId) {
      throw new ConflictException({ code: 'CANNOT_DISABLE_SELF', message: 'You cannot disable your own account.' });
    }
    if (losesAdmin) await this.assertAnotherAdmin(userId);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { ...(input.displayName ? { displayName: input.displayName } : {}), ...(input.status ? { status: input.status } : {}) },
      }),
      ...(roles
        ? [this.db.membership.update({ where: { userId_workspaceId: { userId, workspaceId: this.config.workspaceId } }, data: { roles } })]
        : []),
      this.db.authEvent.create({
        data: { type: input.status === 'disabled' ? 'user_disabled' : 'user_updated', userId, detail: { by: actor.userId, ...input } },
      }),
    ]);
    if (input.status === 'disabled') await this.sessions.revokeAllForUser(userId);
    return { ok: true };
  }

  async remove(actor: SessionIdentity, userId: string) {
    if (userId === actor.userId) throw new ConflictException({ code: 'CANNOT_REMOVE_SELF', message: 'You cannot remove yourself.' });
    const membership = await this.membershipOf(userId);
    if (membership.roles.includes('admin')) await this.assertAnotherAdmin(userId);
    await this.db.$transaction([
      this.db.membership.update({ where: { userId_workspaceId: { userId, workspaceId: this.config.workspaceId } }, data: { status: 'removed' } }),
      this.db.authEvent.create({ data: { type: 'user_removed', userId, detail: { by: actor.userId } } }),
    ]);
    await this.sessions.revokeAllForUser(userId);
    return { ok: true };
  }

  /** Display info for user ids stored on records elsewhere (confirmedBy, linkedBy …); includes former members. */
  async lookup(ids: string[]) {
    const unique = [...new Set(ids)].slice(0, 200);
    if (!unique.length) return [];
    const users = await this.db.user.findMany({
      where: { id: { in: unique }, memberships: { some: { workspaceId: this.config.workspaceId } } },
      select: { id: true, email: true, displayName: true, avatarColor: true },
    });
    return users;
  }

  private requireRoles(value: string[]): Role[] {
    const roles = normalizeRoles(value);
    if (!roles.length) throw new BadRequestException({ code: 'ROLES_REQUIRED', message: 'Pick at least one role.' });
    return roles;
  }

  private async membershipOf(userId: string) {
    const membership = await this.db.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId: this.config.workspaceId } },
    });
    if (!membership || membership.status === 'removed') throw new NotFoundException({ code: 'NOT_FOUND' });
    return membership;
  }

  private async assertAnotherAdmin(exceptUserId: string) {
    const others = await this.db.membership.count({
      where: {
        workspaceId: this.config.workspaceId,
        userId: { not: exceptUserId },
        status: { not: 'removed' },
        roles: { has: 'admin' },
        user: { status: 'active' },
      },
    });
    if (!others) throw new ConflictException({ code: 'LAST_ADMIN', message: 'The workspace needs at least one active admin.' });
  }
}
