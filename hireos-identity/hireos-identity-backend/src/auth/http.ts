import { ForbiddenException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SESSION_COOKIE, type IdentityConfig } from '../identity.config';
import { parseCookies } from './auth-crypto';
import type { RequestMeta } from '../sessions/sessions.service';

/**
 * Client IP for rate limiting. Chain = X-Forwarded-For hops + the socket peer; with N trusted
 * proxies in front of us (TRUSTED_PROXY_HOPS: the server's nginx + the gateway nginx = 2), the
 * client is the entry N from the right. Entries further left are client-supplied and ignored.
 */
export function clientIp(req: Request, trustedHops: number): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  const hops = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded || '').split(',').map((hop) => hop.trim()).filter(Boolean);
  const chain = [...hops, req.socket.remoteAddress || ''].filter(Boolean);
  if (!chain.length) return null;
  return chain[Math.max(0, chain.length - 1 - Math.max(0, trustedHops))];
}

export function requestMeta(req: Request, trustedHops = 0): RequestMeta {
  return { ip: clientIp(req, trustedHops), userAgent: req.headers['user-agent'] || null };
}

export function sessionToken(req: Request): string | undefined {
  return parseCookies(req.headers.cookie)[SESSION_COOKIE];
}

export function setSessionCookie(res: Response, config: IdentityConfig, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: config.cookiePath,
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response, config: IdentityConfig) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: config.cookieSecure, sameSite: 'lax', path: config.cookiePath });
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF backstop on top of SameSite=Lax: a state-changing request that carries an Origin (every
 * browser POST/PATCH does) must come from one of ALLOWED_ORIGINS. Unset list = no check (local dev).
 */
export function assertAllowedOrigin(req: Request, allowedOrigins: string[]) {
  if (SAFE_METHODS.has(req.method) || !allowedOrigins.length) return;
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' });
  }
}
