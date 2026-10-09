// S2S feasibility experiment: can a Server-to-Server OAuth app (no user ever clicking
// "authorize") create the interview meeting and start RTMS on it, with the stream delivered to
// the existing General app (ZM_RTMS_CLIENT)?
//
//   1. account_credentials token from the S2S app
//   2. look up the host user (ZOOM_S2S_HOST_USER), create a join-before-host meeting on it
//   3. wait until someone joins (the host never does), then start RTMS with the S2S token and
//      client_id = ZM_RTMS_CLIENT
//   4. delete the meeting on exit (Ctrl+C)
//
// The demo server (server.mjs, behind the ngrok tunnel) is the receiving half: it verifies the
// meeting.rtms_started webhook, connects to the stream and logs transcript lines. Run both:
//   terminal 1: node server.mjs
//   terminal 2: node s2s-experiment.mjs
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    // Drop a trailing " # comment" (values here never contain "#"), then surrounding quotes.
    .map((m) => [m[1], m[2].replace(/\s+#.*$/, '').trim().replace(/^["']|["']$/g, '')]),
);
// Optional host override: node s2s-experiment.mjs admin@sending.me
if (process.argv[2]) env.ZOOM_S2S_HOST_USER = process.argv[2];
const required = ['ZOOM_S2S_ACCOUNT_ID', 'ZOOM_S2S_CLIENT_ID', 'ZOOM_S2S_CLIENT_SECRET', 'ZOOM_S2S_HOST_USER', 'ZM_RTMS_CLIENT'];
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error(`Missing in .env: ${missing.join(', ')}`);
  process.exit(1);
}

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function s2sToken() {
  const basic = Buffer.from(`${env.ZOOM_S2S_CLIENT_ID}:${env.ZOOM_S2S_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_S2S_ACCOUNT_ID)}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) throw new Error(`token request failed (${res.status}): ${JSON.stringify(body)}`);
  log(`S2S token ok, expires in ${body.expires_in}s, scopes: ${body.scope}`);
  return body.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`https://api.zoom.us/v2${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, ok: res.ok, body: parsed };
}

let token;
let meetingId;

async function cleanup() {
  if (!meetingId) process.exit(0);
  log(`deleting meeting ${meetingId} ...`);
  const res = await api(token, 'DELETE', `/meetings/${meetingId}`).catch((error) => ({ status: 0, body: error.message }));
  log(`delete -> ${res.status}${res.ok ? '' : ` ${JSON.stringify(res.body)}`}`);
  process.exit(0);
}
process.on('SIGINT', () => { void cleanup(); });

token = await s2sToken();

const user = await api(token, 'GET', `/users/${encodeURIComponent(env.ZOOM_S2S_HOST_USER)}`);
if (!user.ok) throw new Error(`host lookup failed (${user.status}): ${JSON.stringify(user.body)}`);
log(`host: ${user.body.email} id=${user.body.id} type=${user.body.type} (1=Basic, 2=Licensed)`);

const created = await api(token, 'POST', `/users/${encodeURIComponent(user.body.id)}/meetings`, {
  topic: 'HireOS S2S RTMS experiment',
  type: 2,
  start_time: new Date(Date.now() + 60_000).toISOString(),
  duration: 30,
  settings: {
    join_before_host: true,
    jbh_time: 0,
    waiting_room: false,
    host_video: false,
    participant_video: false,
    auto_recording: 'none',
    meeting_invitees: [{ email: user.body.email }],
  },
});
if (!created.ok) throw new Error(`create meeting failed (${created.status}): ${JSON.stringify(created.body)}`);
meetingId = created.body.id;
log(`meeting created: ${meetingId}`);
log(`JOIN NOW (do not sign in as the host account): ${created.body.join_url}`);
log('waiting for the meeting to start ... (Ctrl+C to stop and delete the meeting)');

for (let i = 0; i < 180; i++) {
  const meeting = await api(token, 'GET', `/meetings/${meetingId}`);
  if (meeting.ok && meeting.body.status === 'started') break;
  if (i === 179) { log('meeting never started; giving up'); await cleanup(); }
  await sleep(5000);
}
log('meeting is started; requesting RTMS with the S2S token ...');

for (let attempt = 1; attempt <= 5; attempt++) {
  const res = await api(token, 'PATCH', `/live_meetings/${meetingId}/rtms_app/status`, {
    action: 'start',
    settings: { client_id: env.ZM_RTMS_CLIENT, participant_user_id: user.body.id },
  });
  log(`RTMS start attempt ${attempt} -> ${res.status} ${res.body ? JSON.stringify(res.body) : '(empty body)'}`);
  if (res.ok) break;
  await sleep(5000);
}

log('now watch the server.mjs terminal for meeting.rtms_started and transcript lines.');
log('speak in the meeting for a minute, then press Ctrl+C here to delete the meeting.');
// A bare never-resolving promise lets Node exit ("unsettled top-level await") before Ctrl+C,
// skipping the cleanup; an interval keeps the process alive until SIGINT.
setInterval(() => {}, 60_000);
