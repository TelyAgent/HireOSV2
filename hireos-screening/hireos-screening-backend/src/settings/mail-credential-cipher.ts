import { ServiceUnavailableException } from '@nestjs/common';
import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { env as processEnv } from 'node:process';

/*
 * Mailbox passwords (app passwords / authorization codes) at rest (#387). The same file lives in Screening and
 * Written -- keep the copies identical.
 *
 * Stored as `enc:v1:<key id>:<iv>:<tag>:<ciphertext>` (AES-256-GCM, base64url parts). The key is
 * MAIL_CREDENTIAL_KEY: 32 bytes, base64. To rotate, move the old key to MAIL_CREDENTIAL_KEY_PREVIOUS, set a new
 * one, and run the service's `scripts/encrypt-mail-credentials.cjs`; values under either key are read meanwhile.
 * A value without the prefix is a password saved before encryption, read as it is until that script rewrites it.
 * In production a missing key fails the save or read with MAIL_CREDENTIAL_KEY_MISSING -- nothing is ever written
 * in plain text. Elsewhere (local development) a fixed development key stands in, so a fresh checkout works.
 */
const PREFIX = 'enc:v1:';
const DEV_KEY = createHash('sha256').update('hireos-local-development-mail-credential-key').digest();

type Env = Record<string, string | undefined>;

function parseKey(name: string, value: string): Buffer {
  const key = Buffer.from(value.trim(), 'base64');
  if (key.length !== 32) {
    throw new ServiceUnavailableException({ code: 'MAIL_CREDENTIAL_KEY_INVALID', message: `${name} must be 32 bytes, base64-encoded.` });
  }
  return key;
}

function keyId(key: Buffer) {
  return createHash('sha256').update(key).digest('hex').slice(0, 8);
}

/** The key new values are written with, then the ones values may still be under. */
function keys(env: Env): Buffer[] {
  const current = env.MAIL_CREDENTIAL_KEY?.trim();
  if (!current) {
    if (env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException({ code: 'MAIL_CREDENTIAL_KEY_MISSING', message: 'MAIL_CREDENTIAL_KEY is not set on this server, so mailbox passwords cannot be stored or read.' });
    }
    return [DEV_KEY];
  }
  const previous = env.MAIL_CREDENTIAL_KEY_PREVIOUS?.trim();
  return [parseKey('MAIL_CREDENTIAL_KEY', current), ...(previous ? [parseKey('MAIL_CREDENTIAL_KEY_PREVIOUS', previous)] : [])];
}

export function isEncrypted(stored: string) {
  return stored.startsWith(PREFIX);
}

/** Whether `stored` is already under the current key (the re-encryption script leaves those alone). */
export function isCurrent(stored: string, env: Env = processEnv) {
  return isEncrypted(stored) && stored.slice(PREFIX.length).split(':')[0] === keyId(keys(env)[0]);
}

export function encryptCredential(plain: string, env: Env = processEnv): string {
  const [key] = keys(env);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${PREFIX}${keyId(key)}:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`;
}

export function decryptCredential(stored: string, env: Env = processEnv): string {
  if (!stored || !isEncrypted(stored)) return stored;
  const [id, iv, tag, ciphertext] = stored.slice(PREFIX.length).split(':');
  const key = keys(env).find((k) => keyId(k) === id);
  if (!key || !iv || !tag || ciphertext === undefined) {
    throw new ServiceUnavailableException({ code: 'MAIL_CREDENTIAL_KEY_MISMATCH', message: 'This mailbox password was saved under a key this server does not have. Enter the password again.' });
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
