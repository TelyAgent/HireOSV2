// zoom-meeting-demo — fully standalone closed-loop RTMS test harness.
// No NestJS, no Prisma, no dependency on any other project's code or files.
// Has its own OAuth flow, its own meeting creation, its own RTMS start call, its own
// webhook receiver, and a tiny static frontend to drive all of it from a browser.
//
// Port: 3101 — a one-off demo, not a registered HireOS subsystem, so it deliberately
// stays out of PORTS.md's 3xxx allocation range. Doesn't clash with anything.
//
// The one thing that does NOT run on 3101 by default: real Zoom traffic. Zoom's
// registered redirect/webhook URL is https://<ngrok-domain>/... -> whatever local port
// ngrok is currently forwarding to. To actually receive a real OAuth callback or a real
// webhook from Zoom, point the existing ngrok tunnel at this port instead of 3001:
//
//   node server.mjs                      # runs on 3101, no other process needs to stop
//   (in another terminal) kill the running `ngrok http 3001` and run: ngrok http 3101
//   open http://127.0.0.1:3101
//
// Same static domain, so nothing in the Zoom Marketplace app needs to change — just
// which local port it points at. Switch ngrok back to `ngrok http 3001` when done.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { join, extname } from 'node:path';
import rtms from '@zoom/rtms';
import { saveAccount, loadAccount, getFreshAccessToken } from './crypto-store.mjs';

const PORT = Number(process.env.PORT || 3101);
const env = { ...process.env };
try {
  const text = await readFile(join(process.cwd(), '.env'), 'utf8');
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].trim();
  }
} catch { /* no .env yet — /api/status will report not-configured */ }

const OAUTH_REDIRECT = env.ZOOM_OAUTH_REDIRECT_URI || '';
const WEBHOOK_PATH = '/api/meetings/webhooks/zoom';
const CALLBACK_PATH = '/api/integrations/zoom/callback';

// ---- shared in-memory log, polled by the browser UI ----
const logs = [];
const pendingStarts = new Map();
function log(...args) {
  const line = `${new Date().toISOString()} | ${args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')}`;
  console.log(line);
  logs.push(line);
  if (logs.length > 500) logs.shift();
}

const oauthState = new Set(); // single-use state tokens

async function requireToken(res, { force = false } = {}) {
  const token = await getFreshAccessToken(env, { force }).catch((e) => {
    log('token refresh failed:', e.message);
    return null;
  });
  if (!token) {
    json(res, 401, {
      error: 'Zoom authorization expired — click Connect Zoom to authorize this app again',
      code: 'ZOOM_REAUTH_REQUIRED',
    });
  }
  return token;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

// ---- RTMS webhook handling (the actual closed loop) ----
const clients = new Map();

function verifyWebhookSignature(body, req) {
  const secret = env.ZM_RTMS_WEBHOOK_SECRET || '';
  const timestamp = req.headers['x-zm-request-timestamp'];
  const signature = req.headers['x-zm-signature'];
  if (!secret || typeof timestamp !== 'string' || typeof signature !== 'string') return false;
  const expected = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${JSON.stringify(body)}`).digest('hex')}`;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

function handleWebhookBody(body, req, res) {
  log(
    'WEBHOOK',
    body?.event ?? '(no event field)',
    `signature=${req.headers['x-zm-signature'] ? 'present' : 'missing'}`,
    `timestamp=${req.headers['x-zm-request-timestamp'] ? 'present' : 'missing'}`,
    'ua=' + (req.headers['user-agent'] || '-'),
  );

  if (body?.event === 'endpoint.url_validation') {
    const plainToken = body.payload?.plainToken;
    const encryptedToken = createHmac('sha256', env.ZM_RTMS_WEBHOOK_SECRET || '').update(plainToken).digest('hex');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ plainToken, encryptedToken }));
    log('-> answered endpoint.url_validation');
    return;
  }

  if (!verifyWebhookSignature(body, req)) {
    log('-> rejected webhook: invalid or missing signature');
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid webhook signature' }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));

  const event = body?.event;
  const payload = body?.payload || {};
  log('EVENT_PAYLOAD', payload);

  if (event === 'meeting.rtms_stopped') {
    clients.get(payload.rtms_stream_id)?.leave();
    clients.delete(payload.rtms_stream_id);
    log('left stream', payload.rtms_stream_id);
    return;
  }
  if (event !== 'meeting.rtms_started') return;

  const startKey = payload.meeting_id || payload.meeting_uuid || payload.rtms_stream_id;
  if (startKey) {
    clearTimeout(pendingStarts.get(String(startKey)));
    pendingStarts.delete(String(startKey));
  }
  log('*** RTMS STARTED — joining media stream ***', payload);
  const client = new rtms.Client();
  clients.set(payload.rtms_stream_id, client);
  client.onTranscriptData((data, _size, _ts, metadata) => {
    const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
    if (text.trim()) log('TRANSCRIPT', `[${metadata?.userName || 'unknown'}]`, text);
  });
  client.onJoinConfirm(() => log('*** JOIN CONFIRMED — receiving live media ***'));
  client.onLeave((reason) => { clients.delete(payload.rtms_stream_id); log('left:', reason ?? '(no reason)'); });
  try {
    client.setTranscriptParams({ enableLid: true });
    log('client.join() returned', client.join(payload));
  } catch (error) {
    log('client.join() threw', error instanceof Error ? error.message : error);
  }
}

const webhookHandler = rtms.createWebhookHandler(handleWebhookBody, WEBHOOK_PATH);

// ---- static file serving for the tiny frontend ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
async function serveStatic(req, res) {
  const path = req.url === '/' ? '/index.html' : req.url;
  try {
    const file = await readFile(join(process.cwd(), 'public', path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'POST' && url.pathname === WEBHOOK_PATH) return webhookHandler(req, res);

  if (url.pathname === '/api/oauth/authorize') {
    if (!env.ZM_RTMS_CLIENT || !OAUTH_REDIRECT) return json(res, 400, { error: 'ZM_RTMS_CLIENT / ZOOM_OAUTH_REDIRECT_URI missing in .env' });
    const state = randomBytes(16).toString('hex');
    oauthState.add(state);
    const authUrl = new URL('https://zoom.us/oauth/authorize');
    authUrl.search = new URLSearchParams({ response_type: 'code', client_id: env.ZM_RTMS_CLIENT, redirect_uri: OAUTH_REDIRECT, state }).toString();
    res.writeHead(302, { Location: authUrl.toString() }); res.end();
    return;
  }

  if (url.pathname === CALLBACK_PATH) {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !oauthState.has(state)) { res.writeHead(400); res.end('Invalid OAuth callback'); return; }
    oauthState.delete(state);
    try {
      const tokenRes = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: OAUTH_REDIRECT, client_id: env.ZM_RTMS_CLIENT, client_secret: env.ZM_RTMS_SECRET }),
      });
      const tokens = await tokenRes.json();
      if (!tokens.access_token) throw new Error(JSON.stringify(tokens).slice(0, 300));
      const profile = await fetch('https://api.zoom.us/v2/users/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then(r => r.json());
      await saveAccount({ id: profile.id, name: profile.display_name || profile.email, access: tokens.access_token, refresh: tokens.refresh_token, expires: Date.now() + tokens.expires_in * 1000 });
      log('OAuth connected:', profile.email);
      res.writeHead(302, { Location: '/' }); res.end();
    } catch (error) {
      log('OAuth callback failed:', error.message);
      res.writeHead(500); res.end('OAuth failed — see server logs');
    }
    return;
  }

  if (url.pathname === '/api/status') {
    const account = await loadAccount();
    if (!account) return json(res, 200, { connected: false, name: null, authorization: 'missing' });
    const token = await getFreshAccessToken(env).catch(() => null);
    if (!token) return json(res, 200, { connected: false, name: account.name || null, authorization: 'expired' });
    const profileResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const profile = await profileResponse.json().catch(() => ({}));
    if (!profileResponse.ok) {
      return json(res, 200, {
        connected: false,
        name: account.name || null,
        authorization: profile.code === 124 ? 'expired' : 'invalid',
        error: profile.message,
      });
    }
    return json(res, 200, { connected: true, name: profile.display_name || account.name || null, authorization: 'valid' });
  }

  if (req.method === 'POST' && url.pathname === '/api/meeting') {
    const token = await requireToken(res); if (!token) return;
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const body = await new Promise((resolve) => {
      let b = '';
      req.on('data', c => b += c);
      req.on('end', () => {
        try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); }
      });
    });
    let meeting;
    if (!body.reuse) {
      let meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST', headers,
        body: JSON.stringify({ topic: 'zoom-meeting-demo', type: 2, settings: { join_before_host: true, waiting_room: false, auto_recording: 'none' } }),
      });
      meeting = await meetingResponse.json().catch(() => ({}));
      if (meetingResponse.status === 401 && meeting.code === 124) {
        const freshToken = await requireToken(res, { force: true }); if (!freshToken) return;
        meetingResponse = await fetch('https://api.zoom.us/v2/users/me/meetings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${freshToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic: 'zoom-meeting-demo', type: 2, settings: { join_before_host: true, waiting_room: false, auto_recording: 'none' } }),
        });
        meeting = await meetingResponse.json().catch(() => ({}));
      }
    } else {
      const list = await fetch('https://api.zoom.us/v2/users/me/meetings?type=scheduled&page_size=5', { headers }).then(r => r.json());
      meeting = list.meetings?.[0];
    }
    if (!meeting?.id) {
      const reauth = meeting?.code === 124;
      return json(res, reauth ? 401 : 502, {
        error: reauth ? 'Zoom authorization expired — click Connect Zoom and authorize the app again' : 'Zoom did not return a meeting',
        code: reauth ? 'ZOOM_REAUTH_REQUIRED' : meeting?.code,
        body: meeting,
      });
    }
    log('meeting ready:', meeting.id, meeting.join_url);
    return json(res, 200, {
      id: meeting.id,
      uuid: meeting.uuid,
      joinUrl: meeting.join_url,
      startUrl: meeting.start_url,
      topic: meeting.topic,
    });
  }

  if (url.pathname === '/api/meeting/status' && req.method === 'GET') {
    const token = await requireToken(res); if (!token) return;
    const meetingId = url.searchParams.get('id');
    if (!meetingId) return json(res, 400, { error: 'id required' });
    const r = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await r.json().catch(() => ({}));
    log('meeting status ->', r.status, body.status || body.message || '');
    return json(res, r.ok ? 200 : r.status, {
      ok: r.ok,
      id: body.id,
      uuid: body.uuid,
      status: body.status,
      hostId: body.host_id,
      message: body.message,
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/rtms/start') {
    const token = await requireToken(res); if (!token) return;
    const body = await new Promise((resolve) => { let b = ''; req.on('data', c => b += c); req.on('end', () => resolve(JSON.parse(b || '{}'))); });
    if (!body.meetingId) return json(res, 400, { error: 'meetingId required' });
    const meResponse = await fetch('https://api.zoom.us/v2/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const me = await meResponse.json().catch(() => ({}));
    if (!meResponse.ok || !me.id) {
      log('RTMS start could not resolve authenticated Zoom user:', meResponse.status, me);
      return json(res, 502, { error: 'could not resolve authenticated Zoom user', body: me });
    }
    const meetingResponse = await fetch(`https://api.zoom.us/v2/meetings/${encodeURIComponent(body.meetingId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const meetingInfo = await meetingResponse.json().catch(() => ({}));
    if (!meetingResponse.ok || !meetingInfo.id) {
      log('RTMS start could not resolve meeting:', meetingResponse.status, meetingInfo);
      return json(res, meetingResponse.status || 502, { error: 'could not resolve meeting before RTMS start', body: meetingInfo });
    }
    const clientId = env.ZM_RTMS_CLIENT?.trim() || '';
    log('RTMS start request:', {
      meetingId: String(body.meetingId),
      participantUserId: String(me.id),
      clientIdPrefix: clientId.slice(0, 8),
      meetingStatus: meetingInfo.status,
      meetingHostId: String(meetingInfo.host_id || ''),
      participantMatchesMeetingHost: String(meetingInfo.host_id || '') === String(me.id),
    });
    const r = await fetch(`https://api.zoom.us/v2/live_meetings/${body.meetingId}/rtms_app/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'start',
        settings: {
          client_id: clientId,
          participant_user_id: String(me.id),
        },
      }),
    });
    const text = await r.text();
    log('RTMS start ->', r.status, text, {
      trackingId: r.headers.get('x-zm-trackingid') || r.headers.get('x-zm-request-id') || null,
      requestId: r.headers.get('x-request-id') || null,
    });
    if (r.ok) {
      const timeoutKey = String(body.meetingId);
      clearTimeout(pendingStarts.get(timeoutKey));
      pendingStarts.set(timeoutKey, setTimeout(() => {
        pendingStarts.delete(timeoutKey);
        log(`RTMS diagnostic: API returned ${r.status}, but no meeting.rtms_started within 20s for meeting ${body.meetingId}`);
        log('RTMS diagnostic: verify meeting status is started, host is actually in the meeting, and app has meeting.rtms_started subscription plus Allow apps to access meeting content approval');
      }, 20_000).unref());
    }
    return json(res, r.ok ? 200 : r.status, { ok: r.ok, status: r.status, body: text });
  }

  if (url.pathname === '/api/logs') return json(res, 200, { logs });

  return serveStatic(req, res);
});

server.listen(PORT, '127.0.0.1', () => {
  log(`zoom-meeting-demo listening on http://127.0.0.1:${PORT}`);
  log('webhook secret configured:', env.ZM_RTMS_WEBHOOK_SECRET ? 'yes' : 'NO');
  log('rtms client configured:', env.ZM_RTMS_CLIENT ? 'yes' : 'NO');
});
