import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const CODE_MAX_ATTEMPTS = 5;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Sliding expiry is only written back this often, so each request doesn't cost a DB write. */
export const SESSION_TOUCH_INTERVAL_MS = 5 * 60 * 1000;

export const ROLES = ['admin', 'hr', 'interviewer'] as const;
export type Role = (typeof ROLES)[number];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

/** Uniform 000000–999999 from the CSPRNG. */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const name = part.slice(0, index).trim();
    if (!name || name in cookies) continue;
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      cookies[name] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

/** Subsystem path segments a sign-in may return to (under the deploy's base path, e.g. `/hireos`). */
export const RETURN_SECTIONS = ['interview', 'screening', 'jd', 'written', 'account'] as const;

/**
 * Only same-site paths into a known subsystem are accepted as `returnTo`, so the sign-in page can't
 * be used as an open redirect (`//evil.com`, `https://…`, `/\evil.com` all fall through to null).
 */
export function sanitizeReturnTo(value: unknown, basePath: string): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  if (value.length > 2000 || [...value].some((ch) => ch.charCodeAt(0) < 0x20)) return null;
  const base = basePath.replace(/\/+$/, '');
  for (const section of RETURN_SECTIONS) {
    const prefix = `${base}/${section}`;
    if (value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`)) return value;
  }
  return null;
}

const AVATAR_COLORS = ['#2563eb', '#16a34a', '#9333ea', '#c2410c', '#0f766e', '#be123c', '#4f46e5', '#a16207'];

export function avatarColorFor(email: string): string {
  const digest = createHash('sha256').update(email).digest();
  return AVATAR_COLORS[digest[0] % AVATAR_COLORS.length];
}

export function normalizeRoles(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((role): role is Role => (ROLES as readonly string[]).includes(role as string)))];
}
