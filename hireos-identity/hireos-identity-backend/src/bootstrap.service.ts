import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './persistence/prisma.service';
import { IdentityConfig } from './identity.config';
import { avatarColorFor, normalizeEmail } from './auth/auth-crypto';

/** Local-only demo accounts behind the sign-in page's one-click list (DEV_LOGIN_ENABLED). */
const DEMO_ACCOUNTS = [
  { email: 'maya.chen@example.com', displayName: 'Maya Chen', roles: ['admin', 'hr'] },
  { email: 'linh.tran@example.com', displayName: 'Linh Tran', roles: ['hr'] },
  { email: 'alex.park@example.com', displayName: 'Alex Park', roles: ['interviewer'] },
  { email: 'sam.reed@example.com', displayName: 'Sam Reed', roles: ['hr', 'interviewer'] },
  { email: 'jamie.cole@example.com', displayName: 'Jamie Cole', roles: ['interviewer'] },
];

/**
 * Idempotent on every start: makes sure the workspace exists, every BOOTSTRAP_ADMIN_EMAILS address
 * is an active admin (so there's always a way in), and — in local dev only — the demo accounts.
 */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly db: PrismaService,
    private readonly config: IdentityConfig,
  ) {}

  async onApplicationBootstrap() {
    const workspaceId = this.config.workspaceId;
    await this.db.workspace.upsert({
      where: { id: workspaceId },
      update: {},
      create: { id: workspaceId, name: this.config.workspaceName },
    });

    for (const raw of this.config.bootstrapAdminEmails) {
      const email = normalizeEmail(raw);
      await this.ensureMember(email, email.split('@')[0], ['admin'], true);
      this.logger.log(`Bootstrap admin ensured: ${email}`);
    }

    if (this.config.devLoginEnabled) {
      for (const account of DEMO_ACCOUNTS) await this.ensureMember(account.email, account.displayName, account.roles, false);
    }
  }

  private async ensureMember(email: string, displayName: string, roles: string[], forceAdmin: boolean) {
    const workspaceId = this.config.workspaceId;
    const user = await this.db.user.upsert({
      where: { email },
      update: forceAdmin ? { status: 'active' } : {},
      create: { email, displayName, avatarColor: avatarColorFor(email) },
    });
    const existing = await this.db.membership.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId } } });
    if (!existing) {
      await this.db.membership.create({ data: { userId: user.id, workspaceId, roles, status: 'active' } });
    } else if (forceAdmin && (existing.status === 'removed' || !existing.roles.includes('admin'))) {
      await this.db.membership.update({
        where: { userId_workspaceId: { userId: user.id, workspaceId } },
        data: { status: 'active', roles: [...new Set([...existing.roles, 'admin'])] },
      });
    }
  }
}
