import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer, Server } from 'node:http';
import { mkdir, readFile, writeFile, rename, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { Identity } from '../intake/workspace.guard';
import { MeetingsService } from './meetings.service';

type MeetingInfo = { id: string; password: string; joinUrl: string };
// One Zoom account, many meetings — keyed by a caller-chosen string. "default" is the
// account's original single meeting (Live Interview hosting, unaware of any specific
// round); a real InterviewRound.id keys that round's own meeting (Schedule's generated
// link). Each key gets its own independent create-once-then-reuse lifecycle.
type Account = {
  id: string; name: string; email?: string; clientId: string; access: string; refresh: string; expires: number;
  meetings?: Record<string, MeetingInfo>;
  // The single key currently mid-creation (an outcome-uncertain create must never be
  // silently repeated) — at most one at a time, since `exclusive` serializes all work per owner.
  pendingKey?: string;
  /** @deprecated pre-per-round shape; migrated into meetings.default on read */
  meeting?: MeetingInfo;
  /** @deprecated pre-per-round shape; migrated into pendingKey on read */
  creating?: boolean;
};
const DEFAULT_MEETING_KEY = 'default';
// ZOOM_AUTH_MODE=s2s: a Server-to-Server OAuth app (account credentials, no user ever clicks
// "authorize") creates every meeting on one configured host user and starts RTMS for it; the
// General app (ZM_RTMS_*) only receives the stream, verifies webhooks and signs Meeting SDK
// joins. All identities share this one storage slot, since there is a single host account.
const S2S_OWNER = 's2s-host';
type Pending = {
  server?: Server;
  timer: NodeJS.Timeout;
  state: string;
  owner: string;
  clientId: string;
  redirect: string;
  verifier?: string;
  consumed?: boolean;
};

@Injectable()
export class ZoomHostService implements OnModuleDestroy {
  private readonly logger = new Logger(ZoomHostService.name);
  private readonly pending = new Map<string, Pending>();
  private readonly failures = new Map<string, string>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly directory = join(process.cwd(), '.local', 'zoom');
  private s2sTokenCache: { token: string; expires: number } | null = null;
  constructor(private readonly config: ConfigService, private readonly signatures: MeetingsService) {}

  private s2sMode() { return this.config.get<string>('ZOOM_AUTH_MODE')?.trim() === 's2s'; }
  private s2sConfig() {
    const value = (key: string) => this.config.get<string>(key)?.trim() || '';
    const config = {
      accountId: value('ZOOM_S2S_ACCOUNT_ID'), clientId: value('ZOOM_S2S_CLIENT_ID'),
      clientSecret: value('ZOOM_S2S_CLIENT_SECRET'), host: value('ZOOM_S2S_HOST_USER'),
    };
    if (!config.accountId || !config.clientId || !config.clientSecret || !config.host) {
      throw new ServiceUnavailableException({ code: 'ZOOM_S2S_CONFIG_REQUIRED' });
    }
    return config;
  }
  /** Account-credentials token (1 hour, no refresh token), cached until a minute before expiry. */
  private async s2sAccessToken() {
    if (this.s2sTokenCache && this.s2sTokenCache.expires > Date.now() + 60000) return this.s2sTokenCache;
    const { accountId, clientId, clientSecret } = this.s2sConfig();
    const body = await this.call(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}` },
    }, 'TOKEN');
    if (typeof body?.access_token !== 'string' || !Number.isFinite(body.expires_in)) throw new ServiceUnavailableException({ code: 'ZOOM_TOKEN_FAILED' });
    this.s2sTokenCache = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
    return this.s2sTokenCache;
  }
  /** Storage/lock key: per HireOS user in OAuth mode, one shared slot in S2S mode. */
  private store(identity: Identity) { return this.s2sMode() ? S2S_OWNER : this.owner(identity); }
  /** Where meetings are created: the OAuth user's own account, or the configured S2S host. */
  private meetingsUrl(account: Account) {
    return this.s2sMode()
      ? `https://api.zoom.us/v2/users/${encodeURIComponent(account.id)}/meetings`
      : 'https://api.zoom.us/v2/users/me/meetings';
  }

  private enabled() {
    if (this.config.get('NODE_ENV') === 'production' || this.config.get('ZOOM_DEV_ENABLED') !== 'true') throw new NotFoundException({ code: 'ZOOM_DISABLED' });
  }
  private owner(identity: Identity) { return createHash('sha256').update(JSON.stringify([identity.workspaceId, identity.actorId])).digest('hex'); }
  private clientId() {
    const id = (
      this.config.get<string>('ZOOM_OAUTH_CLIENT_ID')
      || this.config.get<string>('ZOOM_OAUTH_PUBLIC_CLIENT_ID')
      || this.config.get<string>('ZM_RTMS_CLIENT')
    )?.trim();
    if (!id) throw new ServiceUnavailableException({ code: 'ZOOM_OAUTH_CLIENT_ID_REQUIRED' });
    return id;
  }
  private clientSecret() {
    return (
      this.config.get<string>('ZOOM_OAUTH_CLIENT_SECRET')
      || this.config.get<string>('ZM_RTMS_SECRET')
    )?.trim() || '';
  }
  private configuredRedirect() {
    return this.config.get<string>('ZOOM_OAUTH_REDIRECT_URI')?.trim() || '';
  }
  private callbackPort() {
    const raw = this.config.get<string>('ZOOM_OAUTH_CALLBACK_PORT')?.trim() || '50590';
    const port = Number(raw);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ServiceUnavailableException({ code: 'ZOOM_OAUTH_CALLBACK_PORT_INVALID' });
    }
    return port;
  }
  private async exclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const next = (this.locks.get(key) || Promise.resolve()).catch(() => {}).then(work);
    this.locks.set(key, next);
    try { return await next; } finally { if (this.locks.get(key) === next) this.locks.delete(key); }
  }
  private async key() {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    const path = join(this.directory, 'encryption.key');
    try { await writeFile(path, randomBytes(32), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    return readFile(path);
  }
  private async read(owner: string): Promise<Account | null> {
    let data: Buffer;
    try { data = await readFile(join(this.directory, owner)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
    const decipher = createDecipheriv('aes-256-gcm', await this.key(), data.subarray(0, 12));
    decipher.setAAD(Buffer.from(owner)); decipher.setAuthTag(data.subarray(12, 28));
    const account: Account = JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString());
    // Migrate the pre-per-round shape in memory; persisted back on the next save() (any
    // write path already does one), never here — read() must stay side-effect-free.
    if (account.meeting && !account.meetings) { account.meetings = { [DEFAULT_MEETING_KEY]: account.meeting }; }
    if (account.creating && !account.pendingKey) { account.pendingKey = DEFAULT_MEETING_KEY; }
    delete account.meeting; delete account.creating;
    return account;
  }
  private async save(owner: string, account: Account) {
    const key = await this.key(); const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(owner));
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(account)), cipher.final()]);
    const path = join(this.directory, owner); const temporary = `${path}.${randomBytes(8).toString('hex')}`;
    await writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600 });
    await rename(temporary, path);
  }
  private async call(url: string, init: RequestInit, operation: string): Promise<any> {
    let response: Response;
    try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) }); }
    catch { throw new ServiceUnavailableException({ code: `ZOOM_${operation}_UNCERTAIN` }); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      this.logger.error(`${operation} ${response.status}: ${JSON.stringify(body)}`);
      throw new BadRequestException({ code: `ZOOM_${operation}_FAILED`, providerStatus: response.status });
    }
    return body;
  }
  private async token(parameters: Record<string, string>) {
    const clientSecret = this.clientSecret();
    if (clientSecret) parameters.client_secret = clientSecret;
    return this.call('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      // Public Client OAuth uses PKCE and deliberately has no client secret.
      body: new URLSearchParams(parameters),
    }, 'TOKEN');
  }
  private close(owner: string) {
    const pending = this.pending.get(owner);
    if (pending) { clearTimeout(pending.timer); pending.server?.close(); this.pending.delete(owner); }
  }
  onModuleDestroy() { for (const owner of this.pending.keys()) this.close(owner); }

  async status(identity: Identity) {
    this.enabled();
    if (this.s2sMode()) {
      // Nothing to authorize: "connected" means the S2S credentials work and the host exists.
      try {
        const account = await this.exclusive(S2S_OWNER, () => this.account(S2S_OWNER));
        const defaultMeeting = account.meetings?.[DEFAULT_MEETING_KEY];
        return { mode: 's2s' as const, connected: true, name: account.name, pending: false, error: null, meeting: defaultMeeting ? { meetingNumber: defaultMeeting.id, joinUrl: defaultMeeting.joinUrl } : null };
      } catch (error) {
        const code = (error as { getResponse?: () => { code?: string } }).getResponse?.().code;
        return { mode: 's2s' as const, connected: false, name: null, pending: false, error: code && /^ZOOM_[A-Z0-9_]+$/.test(code) ? code : 'ZOOM_S2S_FAILED', meeting: null };
      }
    }
    const owner = this.owner(identity); const account = await this.read(owner);
    const connected = !!account && account.clientId === this.clientId();
    const defaultMeeting = connected ? account!.meetings?.[DEFAULT_MEETING_KEY] : undefined;
    return { mode: 'oauth' as const, connected, name: connected ? account!.name : null, pending: this.pending.has(owner), error: this.failures.get(owner) || null, meeting: defaultMeeting ? { meetingNumber: defaultMeeting.id, joinUrl: defaultMeeting.joinUrl } : null };
  }

  async authorize(identity: Identity) {
    this.enabled();
    if (this.s2sMode()) throw new BadRequestException({ code: 'ZOOM_S2S_NO_AUTHORIZATION' });
    const clientId = this.clientId(); const owner = this.owner(identity);
    return this.exclusive(owner, async () => {
      this.close(owner); this.failures.delete(owner);
      const state = randomBytes(32).toString('base64url');
      const confidential = !!this.clientSecret() && !!this.configuredRedirect();
      const verifier = confidential ? undefined : randomBytes(48).toString('base64url');
      const challenge = verifier ? createHash('sha256').update(verifier).digest('base64url') : '';
      const configuredRedirect = this.configuredRedirect();
      let redirect = configuredRedirect;
      let server: Server | undefined;
      if (!confidential) {
        server = createServer(async (req, res) => {
          const url = new URL(req.url || '/', 'http://127.0.0.1');
          const result = await this.handleOAuthCallback(url);
          res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer');
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.writeHead(result.status);
          res.end(result.message);
        });
        server.requestTimeout = 30000; server.headersTimeout = 10000;
        await new Promise<void>((resolve, reject) => { server!.once('error', reject); server!.listen(this.callbackPort(), '127.0.0.1', resolve); });
        const address = server.address(); if (!address || typeof address === 'string') throw new Error('No loopback address');
        redirect = `http://127.0.0.1:${address.port}/api/integrations/zoom/callback`;
      } else if (!/^https:\/\//i.test(redirect)) {
        throw new ServiceUnavailableException({ code: 'ZOOM_OAUTH_HTTPS_REDIRECT_REQUIRED' });
      }
      const timer = setTimeout(() => { if (this.pending.get(owner)?.state === state) { this.failures.set(owner, 'ZOOM_AUTH_EXPIRED'); this.close(owner); } }, 5 * 60 * 1000); timer.unref();
      this.pending.set(owner, { server, timer, state, owner, clientId, redirect, verifier });
      const authorization = new URL('https://zoom.us/oauth/authorize');
      const parameters: Record<string, string> = { response_type: 'code', client_id: clientId, redirect_uri: redirect, state };
      if (challenge) { parameters.code_challenge = challenge; parameters.code_challenge_method = 'S256'; }
      authorization.search = new URLSearchParams(parameters).toString();
      this.logger.log(`Authorize URL: ${authorization.toString()}`);
      return { authorizationUrl: authorization.toString() };
    });
  }

  async handleOAuthCallback(url: URL): Promise<{ status: number; message: string }> {
    const state = url.searchParams.get('state') || '';
    const pending = [...this.pending.values()].find(value => value.state === state);
    if (!pending || pending.consumed || url.pathname !== '/api/integrations/zoom/callback') {
      return { status: 400, message: 'Invalid OAuth callback.' };
    }
    pending.consumed = true;
    try {
      if (url.searchParams.has('error') || !url.searchParams.get('code')) throw new Error('Denied');
      await this.exclusive(pending.owner, async () => {
        const parameters: Record<string, string> = {
          grant_type: 'authorization_code',
          client_id: pending.clientId,
          redirect_uri: pending.redirect,
          code: url.searchParams.get('code')!,
        };
        if (pending.verifier) parameters.code_verifier = pending.verifier;
        const tokens = await this.token(parameters);
        if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new Error('Invalid token response');
        const user = await this.call('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } }, 'PROFILE');
        if (!user.id) throw new Error('Invalid profile');
        const previous = await this.read(pending.owner);
        await this.save(pending.owner, {
          id: user.id,
          name: user.display_name || user.first_name || 'Zoom host',
          email: user.email,
          clientId: pending.clientId,
          access: tokens.access_token,
          refresh: tokens.refresh_token,
          expires: Date.now() + tokens.expires_in * 1000,
          ...(previous && previous.id === user.id ? { meetings: previous.meetings } : {}),
        });
      });
      return { status: 200, message: 'Zoom connected. You can close this tab and return to HireOS.' };
    } catch (error) {
      const code = (error as { getResponse?: () => { code?: string } }).getResponse?.().code;
      this.failures.set(pending.owner, code && /^ZOOM_[A-Z_]+$/.test(code) ? code : 'ZOOM_AUTH_FAILED');
      return { status: 400, message: 'Zoom authorization failed. Return to HireOS and check the displayed error code.' };
    } finally {
      if (this.pending.get(pending.owner)?.state === state) this.close(pending.owner);
    }
  }

  /** S2S mode: the configured host user (looked up once and remembered with its meetings), with
   * a fresh account-credentials token. The token itself is never relied on from storage. */
  private async s2sAccount(): Promise<Account> {
    const { clientId, host } = this.s2sConfig();
    const { token, expires } = await this.s2sAccessToken();
    let account = await this.read(S2S_OWNER);
    const matchesHost = !!account && account.clientId === clientId && (account.id === host || account.email?.toLowerCase() === host.toLowerCase());
    if (!account || !matchesHost) {
      const user = await this.call(`https://api.zoom.us/v2/users/${encodeURIComponent(host)}`, { headers: { Authorization: `Bearer ${token}` } }, 'PROFILE');
      if (!user?.id) throw new ServiceUnavailableException({ code: 'ZOOM_S2S_HOST_NOT_FOUND' });
      const sameUser = !!account && account.id === user.id;
      account = {
        id: user.id,
        name: user.display_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Zoom host',
        email: user.email,
        clientId,
        access: '', refresh: '', expires: 0,
        ...(sameUser ? { meetings: account!.meetings, pendingKey: account!.pendingKey } : {}),
      };
      await this.save(S2S_OWNER, account);
    }
    return { ...account, access: token, refresh: '', expires };
  }

  private async account(owner: string) {
    if (this.s2sMode()) return this.s2sAccount();
    const account = await this.read(owner);
    if (!account || account.clientId !== this.clientId()) throw new BadRequestException({ code: 'ZOOM_CONNECT_REQUIRED' });
    if (account.expires < Date.now() + 60000) {
      const tokens = await this.token({ grant_type: 'refresh_token', client_id: account.clientId, refresh_token: account.refresh });
      if (!tokens.access_token || !tokens.refresh_token || !Number.isFinite(tokens.expires_in)) throw new BadRequestException({ code: 'ZOOM_CONNECT_REQUIRED' });
      account.access = tokens.access_token; account.refresh = tokens.refresh_token; account.expires = Date.now() + tokens.expires_in * 1000;
      await this.save(owner, account);
    }
    if (!account.email) {
      const user = await this.call('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${account.access}` },
      }, 'PROFILE');
      if (typeof user?.email === 'string' && user.email) {
        account.email = user.email;
        await this.save(owner, account);
      }
    }
    return account;
  }

  private async zak(account: Account) {
    const body = await this.call('https://api.zoom.us/v2/users/me/zak', {
      headers: { Authorization: `Bearer ${account.access}` },
    }, 'ZAK');
    if (typeof body?.token !== 'string' || !body.token) throw new ServiceUnavailableException({ code: 'ZOOM_ZAK_REQUIRED' });
    return body.token;
  }

  // The RTMS webhook arrives with no request identity of ours to key on, but the account
  // store is keyed by owner hash — so hand back the token of any connected account. There
  // is one Zoom host per workspace in practice; refreshing happens inside account().
  async anyAccessToken(): Promise<string | null> {
    if (this.s2sMode()) {
      try { return (await this.s2sAccessToken()).token; } catch { return null; }
    }
    let files: string[];
    try { files = await readdir(this.directory); } catch { return null; }
    for (const file of files) {
      if (file === 'encryption.key' || file === S2S_OWNER) continue;
      try { return (await this.account(file)).access; } catch { /* unusable account; try the next */ }
    }
    return null;
  }

  /** The Zoom user RTMS is started for: the configured S2S host, or the OAuth token's own user. */
  async rtmsParticipantUserId(token: string): Promise<string> {
    if (this.s2sMode()) return (await this.exclusive(S2S_OWNER, () => this.s2sAccount())).id;
    const profile = await this.call('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${token}` } }, 'PROFILE');
    return typeof profile?.id === 'string' ? profile.id : '';
  }

  // Creates the meeting for one key on first use (never repeats a create whose outcome is
  // uncertain — see the 4xx-only reset below), and just returns it otherwise. Shared by
  // `start` (the account's own "default" meeting) and `link` (any key — typically a real
  // InterviewRound.id — just a URL to attach to a scheduled round). Neither ever hosts via
  // the Meeting SDK (see `start`), so `join_before_host` is on: nobody holds host role to
  // admit anyone from a waiting room, so a waiting room would strand every participant.
  // Must be `type: 2` (scheduled) — Zoom silently forces join_before_host to false on
  // instant (type 1) meetings regardless of what's sent here or set on the account.
  private async ensureMeeting(owner: string, account: Account, key: string, topic: string): Promise<MeetingInfo> {
    if (account.pendingKey === key) throw new BadRequestException({ code: 'ZOOM_CREATE_UNCERTAIN_CHECK_ACCOUNT' });
    const existing = account.meetings?.[key];
    if (existing) return existing;
    const headers = { Authorization: `Bearer ${account.access}`, 'Content-Type': 'application/json' };
    account.pendingKey = key; await this.save(owner, account);
    const settings = {
      use_pmi: false,
      host_video: false,
      participant_video: false,
      join_before_host: true,
      waiting_room: false,
      auto_recording: 'none',
      ...(account.email ? { meeting_invitees: [{ email: account.email }] } : {}),
    };
    const meeting = await this.call(this.meetingsUrl(account), { method: 'POST', headers, body: JSON.stringify({ topic, type: 2, settings }) }, 'CREATE').catch(async error => {
      const status = error.getResponse?.().providerStatus;
      if (status >= 400 && status < 500) { account.pendingKey = undefined; await this.save(owner, account); }
      throw error;
    });
    if (!meeting.id || !meeting.join_url || !meeting.password) throw new ServiceUnavailableException({ code: 'ZOOM_CREATE_UNCERTAIN_CHECK_ACCOUNT' });
    const info: MeetingInfo = { id: String(meeting.id), password: meeting.password, joinUrl: meeting.join_url };
    account.meetings = { ...(account.meetings || {}), [key]: info };
    account.pendingKey = undefined;
    await this.save(owner, account);
    return info;
  }

  // `key` defaults to the account's own "default" meeting (Live Interview opened on its
  // own, no specific round in mind); passing a real InterviewRound.id instead joins —
  // and, if Schedule already generated one, reuses — that round's own meeting, so joining
  // from a round's "Join link" always lands in the same room that link points to.
  //
  // By default the interviewer joins as an ordinary attendee (role 0, no ZAK): only the one
  // connected (licensed) account owns and hosts every meeting, so interviewers need no Zoom
  // license or authorization of their own. That relies on join_before_host + no waiting room
  // (see ensureMeeting) and on Zoom accepting an RTMS start with the host's token while the
  // host is absent. ZOOM_INTERVIEWER_JOIN_AS=host restores the previous behaviour — joining
  // as the host (role 1 + a ZAK from the connected account) — if RTMS turns out to need it.
  async start(identity: Identity, key?: string, topic?: string) {
    this.enabled(); const owner = this.store(identity);
    return this.exclusive(owner, async () => {
      const account = await this.account(owner);
      const meeting = await this.ensureMeeting(owner, account, key?.trim() || DEFAULT_MEETING_KEY, topic?.trim() || 'HireOS Interview');
      // Host join needs the host's own ZAK, which S2S mode doesn't fetch — always attendee there.
      if (!this.s2sMode() && this.config.get<string>('ZOOM_INTERVIEWER_JOIN_AS')?.trim() === 'host') {
        const zak = await this.zak(account);
        return { ...this.signatures.hostConfig(meeting.id, meeting.password, account.name, zak), joinUrl: meeting.joinUrl };
      }
      return { ...this.signatures.attendeeConfig(meeting.id, meeting.password, 'HireOS Interviewer'), joinUrl: meeting.joinUrl };
    });
  }

  /** Ensures the meeting for `roundId` exists and returns just its link. Each round gets
   * its own independent Zoom meeting, created once and reused on every subsequent call. */
  async link(identity: Identity, roundId: string, topic?: string) {
    this.enabled(); const owner = this.store(identity);
    return this.exclusive(owner, async () => {
      const account = await this.account(owner);
      const meeting = await this.ensureMeeting(owner, account, roundId, topic?.trim() || 'HireOS Interview');
      return { meetingNumber: meeting.id, joinUrl: meeting.joinUrl };
    });
  }

  /** Deletes the Zoom-side meeting for one key (best-effort) and forgets it locally, so its
   * join link stops working and a later call for the same key creates a fresh meeting.
   * Used when a round is marked complete — never throws, since a round can be completed
   * without Zoom ever having been in play for it. */
  async endMeeting(identity: Identity, key: string): Promise<{ ended: boolean }> {
    if (this.config.get('NODE_ENV') === 'production' || this.config.get('ZOOM_DEV_ENABLED') !== 'true') return { ended: false };
    const owner = this.store(identity);
    return this.exclusive(owner, async () => {
      const account = await this.read(owner);
      const meeting = account?.meetings?.[key];
      if (!account || !meeting) return { ended: false };
      try {
        const fresh = this.s2sMode() || account.expires < Date.now() + 60000 ? await this.account(owner) : account;
        const headers = { Authorization: `Bearer ${fresh.access}`, 'Content-Type': 'application/json' };
        // Zoom refuses to delete a meeting that is still in progress (3002), and an attendee-only
        // room has nobody who can end it for everyone — so end it first (needs the
        // meeting:update:status scope; a meeting that isn't running just rejects this), then delete.
        await fetch(`https://api.zoom.us/v2/meetings/${meeting.id}/status`, { method: 'PUT', headers, body: JSON.stringify({ action: 'end' }), signal: AbortSignal.timeout(20000) })
          .then(async (response) => { if (!response.ok && response.status !== 404) this.logger.warn(`Zoom meeting end for key ${key} (meeting ${meeting.id}) -> ${response.status}: ${(await response.text()).slice(0, 200)}`); });
        const deleted = await fetch(`https://api.zoom.us/v2/meetings/${meeting.id}`, { method: 'DELETE', headers, signal: AbortSignal.timeout(20000) });
        if (!deleted.ok && deleted.status !== 404) this.logger.warn(`Zoom meeting delete for key ${key} (meeting ${meeting.id}) -> ${deleted.status}: ${(await deleted.text()).slice(0, 200)}`);
      } catch (error) {
        this.logger.warn(`Zoom meeting delete failed for key ${key} (meeting ${meeting.id}): ${error instanceof Error ? error.message : error}`);
      }
      const latest = await this.read(owner);
      if (latest?.meetings?.[key]) { delete latest.meetings[key]; await this.save(owner, latest); }
      return { ended: true };
    });
  }

  /** Ends the meeting for one key right away (everyone is removed) once the interviewer leaves,
   * instead of waiting for the last participant to go. The meeting itself is kept, so the same
   * round can be rejoined; it is only deleted when the round is completed (endMeeting).
   * Needs the meeting:update:status scope; a meeting that isn't running is reported, not thrown. */
  async endMeetingNow(identity: Identity, key?: string): Promise<{ ended: boolean; reason?: string }> {
    this.enabled(); const owner = this.store(identity);
    return this.exclusive(owner, async () => {
      const account = await this.account(owner);
      const meeting = account.meetings?.[key?.trim() || DEFAULT_MEETING_KEY];
      if (!meeting) return { ended: false, reason: 'NO_MEETING' };
      const response = await fetch(`https://api.zoom.us/v2/meetings/${meeting.id}/status`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${account.access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
        signal: AbortSignal.timeout(20000),
      }).catch(() => null);
      if (response?.ok) return { ended: true };
      const detail = response ? `${response.status}: ${(await response.text()).slice(0, 200)}` : 'request failed';
      this.logger.warn(`Zoom meeting end for key ${key || DEFAULT_MEETING_KEY} (meeting ${meeting.id}) -> ${detail}`);
      return { ended: false, reason: response ? `ZOOM_END_${response.status}` : 'ZOOM_END_UNCERTAIN' };
    });
  }

  /** Clears one meeting so the next `start`/`link` for that key creates a fresh one.
   * Defaults to the account's own "default" (Live Interview) meeting when no key is given. */
  async resetMeeting(identity: Identity, key?: string) {
    this.enabled(); const owner = this.store(identity);
    return this.exclusive(owner, async () => {
      const account = await this.read(owner);
      if (!account) throw new BadRequestException({ code: 'ZOOM_CONNECT_REQUIRED' });
      const target = key?.trim() || DEFAULT_MEETING_KEY;
      if (account.meetings) delete account.meetings[target];
      if (account.pendingKey === target) account.pendingKey = undefined;
      await this.save(owner, account);
      return { reset: true };
    });
  }
}
