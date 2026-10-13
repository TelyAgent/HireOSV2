import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const SESSION_COOKIE = 'hireos_sid';
const DEV_CODE_SECRET = 'hireos-identity-local-dev-only';

function list(value: string | undefined): string[] {
  return (value || '').split(',').map((item) => item.trim()).filter(Boolean);
}

@Injectable()
export class IdentityConfig {
  constructor(private readonly config: ConfigService) {}

  get isProduction() {
    return this.config.get('NODE_ENV') === 'production';
  }

  /** Every subsystem already stores this workspace id on its records, so it is reused as-is. */
  get workspaceId() {
    return this.config.get<string>('DEFAULT_WORKSPACE_ID', 'local-screening-workspace');
  }

  get workspaceName() {
    return this.config.get<string>('WORKSPACE_NAME', 'HireOS');
  }

  get bootstrapAdminEmails() {
    return list(this.config.get<string>('BOOTSTRAP_ADMIN_EMAILS'));
  }

  get loginCodeSecret() {
    const secret = this.config.get<string>('LOGIN_CODE_SECRET', '');
    if (secret) return secret;
    if (this.isProduction) throw new Error('LOGIN_CODE_SECRET is required in production');
    return DEV_CODE_SECRET;
  }

  /** Shared secret for `/api/internal/*` (session introspection by the other backends). */
  get internalToken() {
    return this.config.get<string>('INTERNAL_TOKEN', '');
  }

  /** Deploy path prefix in front of every subsystem: `` locally, `/hireos` on the server. */
  get basePath() {
    return this.config.get<string>('APP_BASE_PATH', '').replace(/\/+$/, '');
  }

  /** Absolute origin + base path, used for links in emails, e.g. https://hireos.aipollo.me/hireos */
  get publicUrl() {
    return this.config.get<string>('PUBLIC_URL', 'http://localhost:8080').replace(/\/+$/, '');
  }

  get cookiePath() {
    return this.config.get<string>('COOKIE_PATH', '/');
  }

  get cookieSecure() {
    return this.config.get<string>('COOKIE_SECURE') === 'true';
  }

  /** Proxies in front of this service that append to X-Forwarded-For (0 locally, 2 on the server). */
  get trustedProxyHops() {
    return Number(this.config.get<string>('TRUSTED_PROXY_HOPS', '0')) || 0;
  }

  get allowedOrigins() {
    return list(this.config.get<string>('ALLOWED_ORIGINS'));
  }

  /** Front ends redirect to sign-in only when this is on (the backends run AUTH_MODE=session). */
  get loginRequired() {
    return this.config.get<string>('LOGIN_REQUIRED') === 'true';
  }

  /** One-click demo-account sign-in for local development; never in production. */
  get devLoginEnabled() {
    return !this.isProduction && this.config.get<string>('DEV_LOGIN_ENABLED') === 'true';
  }

  get mailTransport(): 'console' | 'smtp' {
    return this.config.get<string>('MAIL_TRANSPORT') === 'smtp' ? 'smtp' : 'console';
  }

  get smtp() {
    return {
      host: this.config.get<string>('SMTP_HOST', 'smtp.gmail.com'),
      port: Number(this.config.get<string>('SMTP_PORT', '465')),
      secure: this.config.get<string>('SMTP_SECURE', 'true') !== 'false',
      user: this.config.get<string>('SMTP_USER', ''),
      // Google shows app passwords as 'abcd efgh ijkl mnop'; the spaces are not part of it.
      pass: this.config.get<string>('SMTP_PASS', '').replace(/\s+/g, ''),
    };
  }

  get mailFrom() {
    return this.config.get<string>('MAIL_FROM', '') || `HireOS <${this.smtp.user}>`;
  }
}
