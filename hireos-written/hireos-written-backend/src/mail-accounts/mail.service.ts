import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { MailTargetError, resolveMailTarget } from './mail-target';

// Ported from hireos-screening-backend's src/settings/mail.service.ts -- SMTP-send half only
// (this service never needs the IMAP/receive half, since nothing here imports resumes from an
// inbox). hireos-screening itself never actually calls `transporter.sendMail()` anywhere (only
// `.verify()` for its connectivity test) -- `send()` below is genuinely new, `testConnection()`
// and `describeMailError()` are a direct port.
export class MailApiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export interface SmtpCredentials {
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

/** The checked address for a user-entered host (#128), or the reason it can't be used as a MailApiError. */
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
  /** A real SMTP handshake + AUTH without sending a message -- confirms credentials before save. */
  async testConnection(creds: SmtpCredentials): Promise<void> {
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
      throw new MailApiError(describeMailError(error), error);
    } finally {
      transporter.close();
    }
  }

  async send(creds: SmtpCredentials, message: { to: string; subject: string; html: string; text: string }): Promise<void> {
    const target = await checkedTarget(creds.smtpHost);
    const transporter = nodemailer.createTransport({
      host: target.address,
      ...(target.servername ? { tls: { servername: target.servername } } : {}),
      port: creds.smtpPort,
      secure: creds.smtpSecure,
      auth: { user: creds.email, pass: creds.password },
    });
    try {
      await transporter.sendMail({ from: creds.email, to: message.to, subject: message.subject, html: message.html, text: message.text });
    } catch (error) {
      throw new MailApiError(describeMailError(error), error);
    } finally {
      transporter.close();
    }
  }
}

function describeMailError(error: unknown): string {
  const err = error as { message?: string; code?: string; responseCode?: number };
  if (err.code === 'ENOTFOUND' || err.code === 'EAI_AGAIN') return 'SMTP 服务器地址无法解析，请检查主机名。';
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return '无法连接到 SMTP 服务器，请检查主机名和端口。';
  if (err.responseCode === 535 || /invalid credentials|authentication failed|auth/i.test(err.message || '')) {
    return 'SMTP 认证失败，请检查邮箱地址和授权码（不是邮箱登录密码）。';
  }
  return err.message ? `SMTP 错误：${err.message}` : '无法连接到 SMTP 服务器。';
}
