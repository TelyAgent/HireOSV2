/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { PrismaService } from '../persistence/prisma.service';
import type { Identity } from '../auth/workspace.guard';
import { MailService, MailApiError, type MailInboxMessage, type MailAttachmentScan, type MailboxCredentials } from './mail.service';
import { ImportsService } from '../intake/imports.service';
import { decryptCredential, encryptCredential } from './mail-credential-cipher';
import { invalidSchema, invalidSchemaFromZod } from '../http/invalid-schema';

const corporateMailboxSchema = z.object({
  name: z.string().trim().max(200).optional(),
  provider: z.enum(['gmail', 'outlook', 'qq', '163', '126', 'custom']),
  email: z.string().trim().email().max(320),
  password: z.string().trim().max(500).optional(),
  imapHost: z.string().trim().min(1).max(255),
  imapPort: z.number().int().min(1).max(65535),
  imapTls: z.boolean(),
  smtpHost: z.string().trim().min(1).max(255),
  smtpPort: z.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  mailbox: z.string().trim().min(1).max(200).default('INBOX'),
  purposes: z.object({ inbound: z.boolean(), outbound: z.boolean() }),
}).strict();

const testCorporateMailboxSchema = corporateMailboxSchema.extend({
  password: z.string().trim().max(500).optional(),
});

const DEFAULT_WORKSPACE = 'local-screening-workspace';

// Google/163/QQ etc. all display app passwords grouped in 4s ("ytlh hkrc alwo
// ivne") for readability -- a straight copy-paste carries those spaces along,
// and IMAP/SMTP auth fails on the literal string. Strip all whitespace, not
// just leading/trailing (zod's .trim() only handles the edges).
function normalizePassword(value: string | undefined): string | undefined {
  const stripped = value?.replace(/\s+/g, '');
  return stripped || undefined;
}

/**
 * The saved password belongs to the server and account it was saved for (#125 #127). When any of these change, a
 * blank password is not filled in from storage: the new target would otherwise receive the old credential.
 */
const CONNECTION_FIELDS = ['email', 'imapHost', 'imapPort', 'imapTls', 'smtpHost', 'smtpPort', 'smtpSecure'] as const;
function connectionChanged(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const same = (a: unknown, b: unknown) => (typeof a === 'string' && typeof b === 'string' ? a.trim().toLowerCase() === b.trim().toLowerCase() : a === b);
  return CONNECTION_FIELDS.some((field) => !same(prev[field], next[field]));
}
function savedPasswordFor(prev: Record<string, unknown> | null, next: Record<string, unknown>, submitted: string | undefined): string | undefined {
  if (submitted) return submitted;
  if (!prev?.password) return undefined;
  if (connectionChanged(prev, next)) {
    throw invalidSchema({ password: ['Enter the password again: the server or account changed, so the saved one is not sent to it.'] });
  }
  return decryptCredential(prev.password as string);
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly db: PrismaService,
    private readonly mail: MailService,
    private readonly imports: ImportsService,
  ) {}

  async listConnections(identity: Identity) {
    await this.ensureConnections(identity.workspaceId);
    const rows = await this.db.sourceConnection.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(serializeConnection);
  }

  async readConnection(identity: Identity, id: string) {
    const connection = await this.getConnection(identity.workspaceId, id);
    if (connection.status === 'authorization_required') {
      throw new ConflictException({ code: 'AUTH_REQUIRED', message: 'Authorization required' });
    }
    const updated = await this.db.sourceConnection.update({
      where: { id },
      data: { lastReadAt: new Date(), status: connection.kind === 'folder' ? 'watching' : 'connected' },
    });
    await this.audit(identity, 'connection_read', 'SourceConnection', id, { status: 'succeeded' });
    return serializeConnection(updated);
  }

  async reconnectConnection(identity: Identity, id: string) {
    const connection = await this.getConnection(identity.workspaceId, id);
    const updated = await this.db.sourceConnection.update({
      where: { id },
      data: { lastReadAt: new Date(), status: connection.kind === 'folder' ? 'watching' : 'connected' },
    });
    await this.audit(identity, 'connection_reconnected', 'SourceConnection', id, { status: 'succeeded' });
    return serializeConnection(updated);
  }

  async pauseConnection(identity: Identity, id: string) {
    await this.getConnection(identity.workspaceId, id);
    const updated = await this.db.sourceConnection.update({
      where: { id },
      data: { status: 'paused' },
    });
    await this.audit(identity, 'connection_paused', 'SourceConnection', id, { status: 'succeeded' });
    return serializeConnection(updated);
  }

  async listActivity(identity: Identity) {
    const rows = await this.db.auditRecord.findMany({
      where: { workspaceId: identity.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => {
      const payload = row.payload as Record<string, unknown>;
      return {
        id: row.id,
        op: row.action,
        actor: row.actorId,
        target: `${row.objectType}:${row.objectId}`,
        status: payload.status === 'failed' ? 'failed' : payload.status === 'partial' ? 'partial' : 'succeeded',
        detail: typeof payload.detail === 'string' ? payload.detail : undefined,
        at: row.createdAt.toISOString(),
      };
    });
  }



  // The password (app password / auth code) is write-only by design -- never
  // returned once saved. This is the single place that reads the raw payload,
  // and it always strips it before returning; consumers only ever learn
  // *whether* a password is set, never its value. Each mailbox is its own
  // WorkspaceSetting row (kind='corporate_mailbox', key=<mailbox id>) -- the
  // generic settings table already supports any number of rows per kind, so
  // "one workspace, many mailboxes" needed no schema change.
  async listCorporateMailboxes(identity: Identity) {
    const rows = await this.db.workspaceSetting.findMany({
      where: { workspaceId: identity.workspaceId, kind: 'corporate_mailbox' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => serializeMailbox(row.key, row.payload as any));
  }

  async getCorporateMailbox(identity: Identity, id: string) {
    const row = await this.getMailboxSetting(identity.workspaceId, id);
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    return serializeMailbox(row.key, row.payload as any);
  }

  // Runs IMAP/SMTP checks against the *submitted* form values without saving --
  // the drawer's "测试连通性" button calls this so a bad host/port/password is
  // caught before the user commits to it. Works for both a brand-new account
  // (no id yet) and an existing one (id supplied, so a blank password falls
  // back to what's already stored).
  async testCorporateMailbox(identity: Identity, raw: unknown, id?: string) {
    const parsed = testCorporateMailboxSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const input = parsed.data;
    const existing = id ? await this.getMailboxSetting(identity.workspaceId, id) : null;
    const prev = existing ? (existing.payload as any) : null;
    const password = savedPasswordFor(prev, input, normalizePassword(input.password));
    if (!password) throw new BadRequestException({ code: 'CREDENTIALS_REQUIRED', message: 'An authorization code / password is required.' });
    const creds: MailboxCredentials = { email: input.email, password, imapHost: input.imapHost, imapPort: input.imapPort, imapTls: input.imapTls, smtpHost: input.smtpHost, smtpPort: input.smtpPort, smtpSecure: input.smtpSecure };
    const checks: { code: 'imap' | 'smtp'; level: 'pass' | 'fail'; message: string }[] = [];
    if (input.purposes.inbound) {
      try {
        const result = await this.mail.testImap(creds);
        checks.push({ code: 'imap', level: 'pass', message: `连接成功，收件箱共 ${result.messagesExist} 封邮件。` });
      } catch (error) {
        checks.push({ code: 'imap', level: 'fail', message: error instanceof MailApiError ? error.message : '无法连接 IMAP 服务器。' });
      }
    }
    if (input.purposes.outbound) {
      try {
        await this.mail.testSmtp(creds);
        checks.push({ code: 'smtp', level: 'pass', message: 'SMTP 认证成功，可以发信。' });
      } catch (error) {
        checks.push({ code: 'smtp', level: 'fail', message: error instanceof MailApiError ? error.message : '无法连接 SMTP 服务器。' });
      }
    }
    return { verdict: checks.every((c) => c.level === 'pass') && checks.length > 0 ? 'pass' : 'fail', checks };
  }

  async createCorporateMailbox(identity: Identity, raw: unknown) {
    return this.persistCorporateMailbox(identity, null, raw);
  }

  async updateCorporateMailbox(identity: Identity, id: string, raw: unknown) {
    const existing = await this.getMailboxSetting(identity.workspaceId, id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    return this.persistCorporateMailbox(identity, existing, raw);
  }

  async deleteCorporateMailbox(identity: Identity, id: string) {
    const existing = await this.getMailboxSetting(identity.workspaceId, id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    await this.db.workspaceSetting.delete({ where: { id: existing.id } });
    await this.audit(identity, 'corporate_mailbox_removed', 'WorkspaceSetting', existing.id, { email: (existing.payload as any).email });
  }

  private async persistCorporateMailbox(identity: Identity, existing: { id: string; key: string; version: number; payload: unknown } | null, raw: unknown) {
    const parsed = corporateMailboxSchema.safeParse(raw);
    if (!parsed.success) throw invalidSchemaFromZod(parsed.error);
    const input = parsed.data;
    const prev = existing ? (existing.payload as any) : null;
    const password = savedPasswordFor(prev, input, normalizePassword(input.password));
    if (!password) {
      throw new BadRequestException({ code: 'CREDENTIALS_REQUIRED', message: 'An authorization code / password is required for the first connection.' });
    }
    const creds: MailboxCredentials = { email: input.email, password, imapHost: input.imapHost, imapPort: input.imapPort, imapTls: input.imapTls, smtpHost: input.smtpHost, smtpPort: input.smtpPort, smtpSecure: input.smtpSecure };
    // "Save and verify" actually verifies: a bad host/port/password is rejected
    // here instead of being silently stored and failing at sync time.
    if (input.purposes.inbound) {
      try {
        await this.mail.testImap(creds);
      } catch (error) {
        const message = error instanceof MailApiError ? error.message : '无法通过 IMAP 验证这个邮箱。';
        throw new BadRequestException({ code: 'MAILBOX_VERIFICATION_FAILED', message });
      }
    }
    if (input.purposes.outbound) {
      try {
        await this.mail.testSmtp(creds);
      } catch (error) {
        const message = error instanceof MailApiError ? error.message : '无法通过 SMTP 验证这个邮箱。';
        throw new BadRequestException({ code: 'MAILBOX_VERIFICATION_FAILED', message });
      }
    }
    const payload = {
      name: input.name || input.email,
      provider: input.provider,
      email: input.email,
      password: encryptCredential(password),
      imapHost: input.imapHost,
      imapPort: input.imapPort,
      imapTls: input.imapTls,
      smtpHost: input.smtpHost,
      smtpPort: input.smtpPort,
      smtpSecure: input.smtpSecure,
      mailbox: input.mailbox,
      purposes: input.purposes,
      enabled: prev?.enabled ?? true,
      status: 'active',
      connectedAt: prev?.connectedAt || new Date().toISOString(),
      lastSyncedAt: prev?.lastSyncedAt || null,
    };
    const key = existing?.key || randomUUID();
    const saved = existing
      ? await this.db.workspaceSetting.update({ where: { id: existing.id }, data: { version: existing.version + 1, payload: payload as Prisma.InputJsonValue, updatedBy: identity.actorId } })
      : await this.db.workspaceSetting.create({
          data: { workspaceId: identity.workspaceId, kind: 'corporate_mailbox', key, version: 1, payload: payload as Prisma.InputJsonValue, updatedBy: identity.actorId },
        });
    await this.audit(identity, 'corporate_mailbox_configured', 'WorkspaceSetting', saved.id, { email: input.email, provider: input.provider });
    return serializeMailbox(key, payload);
  }

  async setCorporateMailboxEnabled(identity: Identity, id: string, enabled: boolean) {
    const existing = await this.getMailboxSetting(identity.workspaceId, id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const payload = { ...(existing.payload as any), enabled };
    const updated = await this.db.workspaceSetting.update({
      where: { id: existing.id },
      data: { payload: payload as Prisma.InputJsonValue, version: existing.version + 1, updatedBy: identity.actorId },
    });
    await this.audit(identity, enabled ? 'corporate_mailbox_enabled' : 'corporate_mailbox_disabled', 'WorkspaceSetting', updated.id, {});
    return serializeMailbox(id, payload);
  }

  async syncCorporateMailbox(identity: Identity, id: string) {
    const existing = await this.getMailboxSetting(identity.workspaceId, id);
    if (!existing) throw new NotFoundException({ code: 'NOT_CONFIGURED' });
    const prev = existing.payload as any;
    let recentMessages: MailInboxMessage[] = [];
    if (prev.purposes?.inbound) {
      const creds: MailboxCredentials = { email: prev.email, password: decryptCredential(prev.password), imapHost: prev.imapHost, imapPort: prev.imapPort, imapTls: prev.imapTls, smtpHost: prev.smtpHost, smtpPort: prev.smtpPort, smtpSecure: prev.smtpSecure };
      try {
        recentMessages = await this.mail.listRecentInbox(creds, 10);
      } catch (error) {
        const message = error instanceof MailApiError ? error.message : '无法连接邮箱进行同步。';
        throw new BadRequestException({ code: 'MAILBOX_SYNC_FAILED', message });
      }
    }
    const payload = { ...prev, lastSyncedAt: new Date().toISOString(), lastSyncMessageCount: recentMessages.length };
    const updated = await this.db.workspaceSetting.update({
      where: { id: existing.id },
      data: { payload: payload as Prisma.InputJsonValue, version: existing.version + 1, updatedBy: identity.actorId },
    });
    await this.audit(identity, 'corporate_mailbox_synced', 'WorkspaceSetting', updated.id, { messageCount: recentMessages.length });
    return { ...serializeMailbox(id, payload), recentMessages };
  }

  // Pulls resume-looking attachments out of unseen mail and feeds them into the
  // same intake pipeline a browser upload uses (Material -> ImportItem ->
  // candidate creation), so "Import from email" is real ingestion, not just a
  // status display. IMAP's own \Seen flag is the only dedupe state kept -- a
  // message this already imported from never comes back on the next click.
  async importFromMailbox(identity: Identity, id: string, targetJobId?: string) {
    const existing = await this.getMailboxSetting(identity.workspaceId, id);
    if (!existing) throw new NotFoundException({ code: 'NOT_FOUND' });
    const payload = existing.payload as any;
    if (!payload.purposes?.inbound) {
      throw new BadRequestException({ code: 'INBOUND_NOT_ENABLED', message: '请先为该邮箱启用"用于收件 / Recruiting Inbox"。' });
    }
    const creds: MailboxCredentials = { email: payload.email, password: decryptCredential(payload.password), imapHost: payload.imapHost, imapPort: payload.imapPort, imapTls: payload.imapTls, smtpHost: payload.smtpHost, smtpPort: payload.smtpPort, smtpSecure: payload.smtpSecure };
    let scan: MailAttachmentScan;
    try {
      scan = await this.mail.listUnseenResumeAttachments(creds, 20);
    } catch (error) {
      const message = error instanceof MailApiError ? error.message : '无法连接邮箱读取新邮件。';
      throw new BadRequestException({ code: 'MAILBOX_IMPORT_FAILED', message });
    }
    // createBatch()/saveUpload() always run originalname through decodeOriginalFileName()
    // (Buffer.from(name,'latin1').toString('utf8')), because that's the fix for how
    // Node's multipart parser mangles real HTTP uploads. imapflow already hands back a
    // correctly-decoded Unicode filename (it resolves MIME encoded-words itself), so
    // running it through that same fix a second time would mangle it again -- e.g. a
    // Chinese filename can come out containing an embedded NUL byte, which Postgres
    // rejects outright. Pre-encoding into the same raw latin1 representation here keeps
    // the single decode step consistent for every caller instead of special-casing channels.
    // Only messages whose attachments were all read are imported and then marked read; a message over a limit,
    // or past this import's budget, stays unread with the reason reported (#135).
    const messages = scan.messages;
    const files = messages.flatMap((m) =>
      m.attachments.map(
        (a) =>
          ({
            originalname: Buffer.from(a.filename, 'utf8').toString('latin1'),
            mimetype: a.mimetype,
            size: a.buffer.length,
            buffer: a.buffer,
          }) as unknown as Express.Multer.File,
      ),
    );
    let batchId: string | undefined;
    if (files.length) {
      const batch = await this.imports.createBatch(identity, files, 'email', undefined, targetJobId);
      batchId = batch.id;
      await this.mail.markSeen(creds, messages.map((m) => m.uid)).catch(() => undefined);
    }
    const skipped = scan.skipped.map(({ subject, from, reason, detail }) => ({ subject, from, reason, detail }));
    const updatedPayload = { ...payload, lastSyncedAt: new Date().toISOString(), lastSyncMessageCount: messages.length };
    await this.db.workspaceSetting.update({
      where: { id: existing.id },
      data: { payload: updatedPayload as Prisma.InputJsonValue, version: existing.version + 1, updatedBy: identity.actorId },
    });
    await this.audit(identity, 'corporate_mailbox_email_import', 'WorkspaceSetting', existing.id, {
      messagesScanned: messages.length, attachmentsImported: files.length, messagesSkipped: skipped.length, messagesDeferred: scan.deferred,
    });
    return { mailbox: serializeMailbox(id, updatedPayload), messagesScanned: messages.length, attachmentsImported: files.length, batchId, skipped, deferred: scan.deferred };
  }

  private getMailboxSetting(workspaceId: string, id: string) {
    return this.db.workspaceSetting.findUnique({ where: { workspaceId_kind_key: { workspaceId, kind: 'corporate_mailbox', key: id } } });
  }

  private async ensureConnections(workspaceId: string) {
    if (workspaceId !== DEFAULT_WORKSPACE) return;
    const count = await this.db.sourceConnection.count({ where: { workspaceId } });
    if (count > 0) return;
    const now = new Date();
    await this.db.sourceConnection.createMany({
      data: [
        { id: 'conn-1', workspaceId, kind: 'email', name: 'Recruiting intake mailbox', account: 'recruiting-intake@hireos.demo', status: 'connected', lastReadAt: hoursAgo(now, 3), scope: 'Inbox, last 30 days + new mail' },
        { id: 'conn-2', workspaceId, kind: 'email', name: 'Hiring manager referrals mailbox', account: 'referrals@hireos.demo', status: 'authorization_required', lastReadAt: daysAgo(now, 6), scope: 'Inbox, new mail only' },
        { id: 'conn-3', workspaceId, kind: 'folder', name: 'Shared Drive - Recruiting/Resumes', account: '/Shared Drives/Recruiting/Resumes', status: 'watching', lastReadAt: hoursAgo(now, 1), scope: 'Includes subfolders' },
        { id: 'conn-4', workspaceId, kind: 'api', name: 'Demo ingestion endpoint', account: 'API token ****-8841', status: 'connected', lastReadAt: daysAgo(now, 2), scope: 'candidate.import events' },
      ],
    });
  }

  private async getConnection(workspaceId: string, id: string) {
    const row = await this.db.sourceConnection.findFirst({ where: { workspaceId, id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND' });
    return row;
  }

  private async ensureSetting(workspaceId: string, kind: string, payload: Record<string, unknown>) {
    const existing = await this.db.workspaceSetting.findUnique({ where: { workspaceId_kind_key: { workspaceId, kind, key: 'default' } } });
    if (existing) return existing;
    return this.db.workspaceSetting.create({
      data: { workspaceId, kind, key: 'default', version: 1, payload: payload as Prisma.InputJsonValue, updatedBy: 'system' },
    });
  }

  private async updateSetting(id: string, version: number, payload: Record<string, unknown>, actorId: string) {
    return this.db.workspaceSetting.update({
      where: { id },
      data: { version, payload: payload as Prisma.InputJsonValue, updatedBy: actorId },
    });
  }

  private async audit(identity: Identity, action: string, objectType: string, objectId: string, payload: Record<string, unknown>) {
    await this.db.auditRecord.create({
      data: {
        workspaceId: identity.workspaceId,
        actorId: identity.actorId,
        action,
        objectType,
        objectId,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }
}

function serializeMailbox(id: string, payload: any) {
  return {
    id,
    configured: true,
    enabled: payload.enabled !== false,
    name: payload.name,
    email: payload.email,
    provider: payload.provider,
    hasPassword: Boolean(payload.password),
    imapHost: payload.imapHost,
    imapPort: payload.imapPort,
    imapTls: payload.imapTls,
    smtpHost: payload.smtpHost,
    smtpPort: payload.smtpPort,
    smtpSecure: payload.smtpSecure,
    mailbox: payload.mailbox || 'INBOX',
    purposes: payload.purposes || { inbound: false, outbound: false },
    status: payload.status || 'active',
    connectedAt: payload.connectedAt,
    lastSyncedAt: payload.lastSyncedAt || null,
    lastSyncMessageCount: typeof payload.lastSyncMessageCount === 'number' ? payload.lastSyncMessageCount : null,
  };
}

function serializeConnection(row: any) {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    account: row.account,
    status: row.status,
    lastRead: row.lastReadAt?.toISOString() || new Date(0).toISOString(),
    scope: row.scope,
  };
}

function hoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000);
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

