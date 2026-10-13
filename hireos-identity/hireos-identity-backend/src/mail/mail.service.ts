import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { IdentityConfig } from '../identity.config';
import type { RenderedMail } from './templates';

/**
 * `console` (local default) logs the mail instead of sending it — the only place a sign-in code ever
 * reaches a log. `smtp` sends through Gmail (app password) or any SMTP relay.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: IdentityConfig) {}

  async send(to: string, mail: RenderedMail): Promise<void> {
    if (this.config.mailTransport === 'console') {
      if (this.config.isProduction) throw new Error('MAIL_TRANSPORT=console is not allowed in production');
      this.logger.log(`[console mail] to=${to} subject="${mail.subject}"\n${mail.text}`);
      return;
    }
    await this.smtpTransport().sendMail({ from: this.config.mailFrom, to, subject: mail.subject, html: mail.html, text: mail.text });
  }

  private smtpTransport() {
    if (!this.transporter) {
      const smtp = this.config.smtp;
      if (!smtp.user || !smtp.pass) throw new Error('SMTP_USER and SMTP_PASS are required when MAIL_TRANSPORT=smtp');
      this.transporter = createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });
    }
    return this.transporter;
  }
}
