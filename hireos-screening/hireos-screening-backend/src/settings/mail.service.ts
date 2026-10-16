import { MailTargetError, resolveMailTarget } from './mail-target';
import { Injectable } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import type { Readable } from 'node:stream';
import { ImapFlow } from 'imapflow';
import nodemailer from 'nodemailer';

export class MailApiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export interface MailboxCredentials {
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

export interface MailInboxMessage {
  id: string;
  from: string;
  subject: string;
  date: string | null;
}

export interface MailAttachment {
  filename: string;
  mimetype: string;
  buffer: Buffer;
}

export interface MailAttachmentMessage {
  uid: number;
  subject: string;
  from: string;
  attachments: MailAttachment[];
}

/**
 * How much one mailbox import may read (#135). Defaults pending the Owner's confirmation on #135: an attachment
 * may be as large as an uploaded file (25 MB); a message at most 50 MB in 10 attachments; one import at most
 * 100 MB in 50 attachments.
 */
export const MAIL_IMPORT_LIMITS = {
  attachmentBytes: 25 * 1024 * 1024,
  messageBytes: 50 * 1024 * 1024,
  messageAttachments: 10,
  batchBytes: 100 * 1024 * 1024,
  batchAttachments: 50,
};
export type MailImportLimits = typeof MAIL_IMPORT_LIMITS;

/** A message left unread because something in it is over a limit, with why. */
export interface MailSkippedMessage {
  uid: number;
  subject: string;
  from: string;
  reason: 'attachment_too_large' | 'message_too_large' | 'too_many_attachments';
  detail: string;
}

export interface MailAttachmentScan {
  /** Messages whose résumé attachments were all read, to import (and then mark read). */
  messages: MailAttachmentMessage[];
  /** Messages not imported because of a limit; they stay unread. */
  skipped: MailSkippedMessage[];
  /** Unread messages not looked at because this import's budget was used up; the next import reads them. */
  deferred: number;
}

export class AttachmentTooLargeError extends Error {}

const RESUME_EXTENSIONS = ['.pdf', '.doc', '.docx'];

function looksLikeResume(filename: string): boolean {
  const lower = filename.toLowerCase();
  return RESUME_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

interface BodyStructureNode {
  part?: string;
  disposition?: string | null;
  dispositionParameters?: Record<string, string>;
  parameters?: Record<string, string>;
  type?: string;
  subtype?: string;
  /** Encoded size on the server, and its transfer encoding. */
  size?: number;
  encoding?: string;
  childNodes?: BodyStructureNode[];
}

function collectAttachmentParts(node: BodyStructureNode | undefined, acc: { part: string; filename: string; type: string; size?: number }[] = []) {
  if (!node) return acc;
  const filename = node.dispositionParameters?.filename || node.parameters?.name;
  if (filename && node.part) {
    // The decoded size, estimated from the stated one: base64 takes 4 bytes for every 3 (#135).
    const size = typeof node.size === 'number' ? (node.encoding?.toLowerCase() === 'base64' ? Math.floor((node.size * 3) / 4) : node.size) : undefined;
    acc.push({ part: node.part, filename, type: `${node.type || 'application'}/${node.subtype || 'octet-stream'}`.toLowerCase(), ...(size != null ? { size } : {}) });
  }
  for (const child of node.childNodes || []) collectAttachmentParts(child, acc);
  return acc;
}

/** Reads a stream into memory, but stops reading — and drops what was read — as soon as it passes `limit` bytes. */
export async function streamToBuffer(stream: Readable, limit = Infinity): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const piece = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += piece.length;
    if (size > limit) {
      stream.destroy();
      throw new AttachmentTooLargeError(`over ${limit} bytes`);
    }
    chunks.push(piece);
  }
  return Buffer.concat(chunks);
}

const megabytes = (bytes: number) => `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;

/** The checked address for a user-entered host, or the reason it can't be used as a MailApiError. */
async function checkedTarget(host: string) {
  try {
    return await resolveMailTarget(host);
  } catch (error) {
    if (error instanceof MailTargetError) throw new MailApiError(error.message, error);
    throw error;
  }
}

@Injectable()
export class MailService {
  /** Connects to the checked address for the host, never to whatever the name resolves to later (#128). */
  private async buildImapClient(creds: MailboxCredentials): Promise<ImapFlow> {
    const target = await checkedTarget(creds.imapHost);
    return new ImapFlow({
      host: target.address,
      ...(target.servername ? { servername: target.servername } : {}),
      port: creds.imapPort,
      secure: creds.imapTls,
      auth: { user: creds.email, pass: creds.password },
      logger: false,
    });
  }

  /** Connects and locks INBOX, then disconnects -- proves the address, password
   * (app password / auth code) and IMAP host/port actually work together. */
  async testImap(creds: MailboxCredentials): Promise<{ messagesExist: number }> {
    const client = await this.buildImapClient(creds);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        return { messagesExist: client.mailbox ? client.mailbox.exists : 0 };
      } finally {
        lock.release();
      }
    } catch (error) {
      throw new MailApiError(describeMailError(error, 'imap'), error);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** nodemailer's verify() does a real SMTP handshake + AUTH without sending a
   * message -- confirms outbound credentials without risking an actual send. */
  async testSmtp(creds: MailboxCredentials): Promise<void> {
    const target = await checkedTarget(creds.smtpHost);
    const transporter = nodemailer.createTransport({
      host: target.address,
      ...(target.servername ? { tls: { servername: target.servername } } : {}),
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      auth: { user: creds.email, pass: creds.password },
    });
    try {
      await transporter.verify();
    } catch (error) {
      throw new MailApiError(describeMailError(error, 'smtp'), error);
    } finally {
      transporter.close();
    }
  }

  async listRecentInbox(creds: MailboxCredentials, maxResults = 10): Promise<MailInboxMessage[]> {
    const client = await this.buildImapClient(creds);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const exists = client.mailbox ? client.mailbox.exists : 0;
        if (!exists) return [];
        const range = `${Math.max(1, exists - maxResults + 1)}:*`;
        const messages: MailInboxMessage[] = [];
        for await (const msg of client.fetch({ seq: range }, { envelope: true })) {
          messages.push({
            id: String(msg.uid ?? msg.seq),
            from: msg.envelope?.from?.[0]?.address || msg.envelope?.from?.[0]?.name || '',
            subject: msg.envelope?.subject || '(no subject)',
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
          });
        }
        return messages.reverse();
      } finally {
        lock.release();
      }
    } catch (error) {
      throw new MailApiError(describeMailError(error, 'imap'), error);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Only ever looks at *unseen* mail -- IMAP's own \Seen flag is the dedupe
   * mechanism, so a message this import already pulled attachments from is
   * never re-imported on the next click, without us tracking any state of our
   * own. Only .pdf/.doc/.docx attachments are downloaded; everything else
   * (inline images, signature logos) is skipped without ever fetching its bytes. */
  async listUnseenResumeAttachments(creds: MailboxCredentials, maxMessages = 20, limits: MailImportLimits = MAIL_IMPORT_LIMITS): Promise<MailAttachmentScan> {
    const client = await this.buildImapClient(creds);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        const uids = await client.search({ seen: false }, { uid: true });
        const targetUids = (uids || []).slice(-maxMessages);
        const scan: MailAttachmentScan = { messages: [], skipped: [], deferred: 0 };
        // What this import has kept in memory so far; nothing past the batch budget is ever read (#135).
        let batchBytes = 0;
        let batchAttachments = 0;
        for (const [index, uid] of targetUids.entries()) {
          const msg = await client.fetchOne(String(uid), { envelope: true, bodyStructure: true }, { uid: true });
          if (!msg) continue;
          const parts = collectAttachmentParts(msg.bodyStructure as unknown as BodyStructureNode).filter((p) => looksLikeResume(p.filename));
          if (!parts.length) continue;
          const subject = msg.envelope?.subject || '(no subject)';
          const from = msg.envelope?.from?.[0]?.address || '';
          const skip = (reason: MailSkippedMessage['reason'], detail: string) => scan.skipped.push({ uid, subject, from, reason, detail });
          // Sizes the server states are checked before anything is downloaded.
          const declared = parts.reduce((sum, p) => sum + (p.size ?? 0), 0);
          const tooBig = parts.find((p) => (p.size ?? 0) > limits.attachmentBytes);
          if (parts.length > limits.messageAttachments) { skip('too_many_attachments', `${parts.length} résumé attachments; at most ${limits.messageAttachments} per message`); continue; }
          if (tooBig) { skip('attachment_too_large', `${tooBig.filename} is ${megabytes(tooBig.size!)}; at most ${megabytes(limits.attachmentBytes)} per attachment`); continue; }
          if (declared > limits.messageBytes) { skip('message_too_large', `attachments total ${megabytes(declared)}; at most ${megabytes(limits.messageBytes)} per message`); continue; }
          // This message would take the import past its budget: stop here, it and the rest stay for the next import.
          if (batchAttachments + parts.length > limits.batchAttachments || batchBytes + declared > limits.batchBytes) {
            scan.deferred = targetUids.length - index;
            break;
          }
          const attachments: MailAttachment[] = [];
          let messageBytes = 0;
          let refused: { reason: MailSkippedMessage['reason']; detail: string } | 'over_batch' | null = null;
          for (const part of parts) {
            const { content } = await client.download(String(uid), part.part, { uid: true });
            // The stated size can be missing or wrong: the bytes actually read are what count.
            const forAttachment = limits.attachmentBytes;
            const forMessage = limits.messageBytes - messageBytes;
            const forBatch = limits.batchBytes - batchBytes - messageBytes;
            try {
              const buffer = await streamToBuffer(content, Math.min(forAttachment, forMessage, forBatch));
              messageBytes += buffer.length;
              attachments.push({ filename: part.filename, mimetype: part.type, buffer });
            } catch (error) {
              if (!(error instanceof AttachmentTooLargeError)) throw error;
              // Cut off by what's left of this import: the message isn't at fault, it waits for the next import.
              refused = forBatch < Math.min(forAttachment, forMessage) ? 'over_batch'
                : forMessage < forAttachment ? { reason: 'message_too_large', detail: `attachments total over ${megabytes(limits.messageBytes)}` }
                : { reason: 'attachment_too_large', detail: `${part.filename} is over ${megabytes(limits.attachmentBytes)}` };
              break;
            }
          }
          if (refused === 'over_batch') { scan.deferred = targetUids.length - index; break; }
          if (refused) { skip(refused.reason, refused.detail); continue; }
          batchBytes += messageBytes;
          batchAttachments += attachments.length;
          scan.messages.push({ uid, subject, from, attachments });
        }
        return scan;
      } finally {
        lock.release();
      }
    } catch (error) {
      throw new MailApiError(describeMailError(error, 'imap'), error);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }

  /** Marks messages \Seen after their attachments have been handed off to the
   * import pipeline -- this is what makes them drop out of the next unseen search. */
  async markSeen(creds: MailboxCredentials, uids: number[]): Promise<void> {
    if (!uids.length) return;
    const client = await this.buildImapClient(creds);
    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageFlagsAdd(uids, ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    } catch (error) {
      throw new MailApiError(describeMailError(error, 'imap'), error);
    } finally {
      await client.logout().catch(() => undefined);
    }
  }
}

function describeMailError(error: unknown, protocol: 'imap' | 'smtp'): string {
  const err = error as { message?: string; code?: string; responseCode?: number };
  const label = protocol === 'imap' ? 'IMAP' : 'SMTP';
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return `${label} 服务器地址无法解析，请检查主机名。`;
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return `无法连接到 ${label} 服务器，请检查主机名和端口。`;
  if (err.responseCode === 535 || /invalid credentials|authentication failed|auth/i.test(err.message || '')) {
    return `${label} 认证失败，请检查邮箱地址和授权码（不是邮箱登录密码）。`;
  }
  return err.message ? `${label} 错误：${err.message}` : `无法连接到 ${label} 服务器。`;
}
