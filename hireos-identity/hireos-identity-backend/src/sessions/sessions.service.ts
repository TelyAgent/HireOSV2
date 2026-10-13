import { Injectable } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import { hashToken, newSessionToken, normalizeRoles, SESSION_TOUCH_INTERVAL_MS, SESSION_TTL_MS, type Role } from '../auth/auth-crypto';

export type SessionIdentity = {
  sessionId: string;
  userId: string;
  email: string;
  displayName: string;
  avatarColor: string | null;
  locale: string;
  workspaceId: string;
  workspaceName: string;
  roles: Role[];
  expiresAt: Date;
};

export type RequestMeta = { ip?: string | null; userAgent?: string | null };

@Injectable()
export class SessionsService {
  constructor(private readonly db: PrismaService) {}

  /** Returns the raw token for the cookie; only its hash is stored. */
  async create(userId: string, workspaceId: string, meta: RequestMeta): Promise<{ token: string; expiresAt: Date }> {
    const token = newSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db.session.create({
      data: { tokenHash: hashToken(token), userId, workspaceId, ip: meta.ip ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null, expiresAt },
    });
    return { token, expiresAt };
  }

  /**
   * The single source of truth for "who is this cookie": the session must be live, the user active
   * and the membership not removed. Sliding expiry is pushed forward at most every few minutes.
   */
  async resolve(token: string | undefined | null): Promise<SessionIdentity | null> {
    if (!token) return null;
    const session = await this.db.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { memberships: { include: { workspace: true } } } } },
    });
    const now = Date.now();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) return null;
    if (session.user.status !== 'active') return null;
    const membership = session.user.memberships.find((m) => m.workspaceId === session.workspaceId);
    if (!membership || membership.status === 'removed') return null;

    let expiresAt = session.expiresAt;
    if (now - session.lastUsedAt.getTime() >= SESSION_TOUCH_INTERVAL_MS) {
      expiresAt = new Date(now + SESSION_TTL_MS);
      await this.db.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date(now), expiresAt } });
    }
    return {
      sessionId: session.id,
      userId: session.userId,
      email: session.user.email,
      displayName: session.user.displayName,
      avatarColor: session.user.avatarColor,
      locale: session.user.locale,
      workspaceId: session.workspaceId,
      workspaceName: membership.workspace.name,
      roles: normalizeRoles(membership.roles),
      expiresAt,
    };
  }

  async revoke(sessionId: string) {
    await this.db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllForUser(userId: string) {
    await this.db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
