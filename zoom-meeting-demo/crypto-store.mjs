// Fully self-contained account storage — own encryption key, own file, own directory.
// No dependency on any other project. AES-256-GCM, same well-understood scheme, generated
// fresh the first time this runs.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = join(process.cwd(), '.local');
const KEY_PATH = join(DIR, 'encryption.key');
const ACCOUNT_PATH = join(DIR, 'account.enc');

async function getKey() {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  try {
    return await writeFile(KEY_PATH, randomBytes(32), { flag: 'wx', mode: 0o600 }).then(() => readFile(KEY_PATH));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    return readFile(KEY_PATH);
  }
}

export async function saveAccount(account) {
  const key = await getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(account)), cipher.final()]);
  const tmp = `${ACCOUNT_PATH}.${randomBytes(4).toString('hex')}`;
  await writeFile(tmp, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
  await rename(tmp, ACCOUNT_PATH);
}

export async function loadAccount() {
  let data;
  try { data = await readFile(ACCOUNT_PATH); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const key = await getKey();
  const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
}

export async function refreshAccessToken(env) {
  const account = await loadAccount();
  if (!account) return null;

  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.ZM_RTMS_CLIENT,
      client_secret: env.ZM_RTMS_SECRET,
      refresh_token: account.refresh,
    }),
  });
  const tokens = await res.json().catch(() => ({}));
  if (!tokens.access_token) throw new Error(`Token refresh failed (${res.status}): ${JSON.stringify(tokens).slice(0, 300)}`);
  const updated = { ...account, access: tokens.access_token, refresh: tokens.refresh_token || account.refresh, expires: Date.now() + tokens.expires_in * 1000 };
  await saveAccount(updated);
  return updated.access;
}

export async function getFreshAccessToken(env, { force = false } = {}) {
  const account = await loadAccount();
  if (!account) return null;
  if (!force && account.expires > Date.now() + 60_000) return account.access;
  return refreshAccessToken(env);
}
