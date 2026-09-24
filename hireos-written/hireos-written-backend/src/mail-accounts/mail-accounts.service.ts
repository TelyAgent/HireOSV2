import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailApiError, MailService } from './mail.service';
import type { CreateMailAccountDto, TestMailAccountDto, UpdateMailAccountDto } from './mail-account.dto';

@Injectable()
export class MailAccountsService {
  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
  ) {}

  private serialize(account: {
    id: string; name: string; provider: string; email: string; smtpHost: string; smtpPort: number;
    smtpSecure: boolean; enabled: boolean; status: string; lastError: string | null; updatedAt: Date;
  }) {
    return {
      id: account.id,
      name: account.name,
      provider: account.provider,
      email: account.email,
      smtpHost: account.smtpHost,
      smtpPort: account.smtpPort,
      smtpSecure: account.smtpSecure,
      enabled: account.enabled,
      status: account.status,
      lastError: account.lastError,
      updatedAt: account.updatedAt.toISOString(),
      hasPassword: true,
    };
  }

  async list(identity: Identity) {
    const accounts = await this.db.mailAccount.findMany({ where: { workspaceId: identity.workspaceId }, orderBy: { createdAt: 'asc' } });
    return accounts.map((a) => this.serialize(a));
  }

  async testConnection(dto: TestMailAccountDto) {
    try {
      await this.mail.testConnection(dto);
      return { status: 'ok' as const };
    } catch (error) {
      const message = error instanceof MailApiError ? error.message : 'SMTP 连接测试失败。';
      return { status: 'error' as const, message };
    }
  }

  async create(identity: Identity, dto: CreateMailAccountDto) {
    // Verified before it's ever saved -- a bad host/port/app-password is rejected here, not
    // discovered the next time someone tries to actually send an invitation.
    await this.mail.testConnection(dto);
    const account = await this.db.mailAccount.create({
      data: {
        workspaceId: identity.workspaceId,
        name: dto.name,
        provider: dto.provider,
        email: dto.email,
        password: dto.password,
        smtpHost: dto.smtpHost,
        smtpPort: dto.smtpPort,
        smtpSecure: dto.smtpSecure,
        status: 'connected',
      },
    });
    return this.serialize(account);
  }

  async update(identity: Identity, id: string, dto: UpdateMailAccountDto) {
    const existing = await this.db.mailAccount.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'MAIL_ACCOUNT_NOT_FOUND' });

    const merged = {
      email: dto.email ?? existing.email,
      password: dto.password ?? existing.password,
      smtpHost: dto.smtpHost ?? existing.smtpHost,
      smtpPort: dto.smtpPort ?? existing.smtpPort,
      smtpSecure: dto.smtpSecure ?? existing.smtpSecure,
    };
    await this.mail.testConnection(merged);

    const account = await this.db.mailAccount.update({
      where: { id },
      data: { name: dto.name ?? existing.name, provider: dto.provider ?? existing.provider, ...merged, status: 'connected', lastError: null },
    });
    return this.serialize(account);
  }

  async remove(identity: Identity, id: string) {
    const existing = await this.db.mailAccount.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'MAIL_ACCOUNT_NOT_FOUND' });
    await this.db.mailAccount.delete({ where: { id } });
    return { status: 'deleted' };
  }

  async setEnabled(identity: Identity, id: string, enabled: boolean) {
    const existing = await this.db.mailAccount.findFirst({ where: { id, workspaceId: identity.workspaceId } });
    if (!existing) throw new NotFoundException({ code: 'MAIL_ACCOUNT_NOT_FOUND' });
    const account = await this.db.mailAccount.update({ where: { id }, data: { enabled } });
    return this.serialize(account);
  }

  /** Used by InvitationsService to actually deliver an invitation email -- picks the workspace's
   * first enabled account (this app only ever needs one configured outbound mailbox at a time). */
  async sendFromWorkspaceAccount(identity: Identity, message: { to: string; subject: string; html: string; text: string }): Promise<{ sent: boolean; error?: string }> {
    const account = await this.db.mailAccount.findFirst({ where: { workspaceId: identity.workspaceId, enabled: true }, orderBy: { createdAt: 'asc' } });
    if (!account) return { sent: false, error: 'NO_MAILBOX_CONFIGURED' };
    try {
      await this.mail.send(account, message);
      return { sent: true };
    } catch (error) {
      const errMessage = error instanceof MailApiError ? error.message : 'SEND_FAILED';
      await this.db.mailAccount.update({ where: { id: account.id }, data: { status: 'error', lastError: errMessage } }).catch(() => {});
      return { sent: false, error: errMessage };
    }
  }
}
