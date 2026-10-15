// #64 -- reading a job link: script-rendered pages are rendered in a browser; every request it makes is
// checked like the plain fetch, so the server still can't be used to reach internal hosts.
// The network is injected: DNS and HTTP are served from the fixtures below, nothing goes to the internet.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { extractTextFromLink } = require('../dist/copilot/link-extract');

const PUBLIC_IP = '93.184.216.34';
const HOSTS = {
  'jobs.example.test': PUBLIC_IP,
  'cdn.example.test': PUBLIC_IP,
  'intranet.example.test': '10.0.0.8',
};

const SHELL = '<!doctype html><html><head><title>Careers</title></head><body><div id="app"></div><script src="https://cdn.example.test/app.js"></script></body></html>';

// The page loads its posting with a POST that needs the cookie the shell set, like the Alibaba campus site.
// It also tries to reach an internal host directly and through a public redirect; neither may succeed.
const APP_JS = `
(async () => {
  const leak = (text) => { const p = document.createElement('p'); p.textContent = text; document.body.appendChild(p); };
  fetch('http://intranet.example.test/secret').then((r) => r.text()).then(leak).catch(() => {});
  fetch('https://cdn.example.test/bounce').then((r) => r.text()).then(leak).catch(() => {});
  const img = new Image(); img.src = 'http://intranet.example.test/pixel.gif';
  const res = await fetch('/position/detail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 42 }) });
  const job = await res.json();
  document.getElementById('app').innerHTML =
    '<h1>' + job.title + '</h1><div>' + job.locations + '</div><h2>职位描述</h2><ul>' + job.duties.map((d) => '<li>' + d + '</li>').join('') + '</ul>';
})();`;

const JOB = {
  title: 'AI应用算法工程师',
  locations: '北京 / 广州 / 杭州 / 上海',
  duties: ['深入业务与产品共创需求，将诉求转化为可执行的AI任务定义', '搭建高效的数据采集、清洗与标注工程流水线', '面向业务目标设计评测指标与Rubric，搭建自动化评测框架'],
};

function html(body, extra = {}) {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', ...extra } });
}

function fixtureNetwork() {
  const requested = [];
  const network = {
    lookup: async (host) => (HOSTS[host] ? [{ address: HOSTS[host], family: 4 }] : []),
    fetch: async (input, init = {}) => {
      const url = new URL(String(input));
      const headers = new Headers(init.headers || {});
      requested.push({ url: url.href, method: init.method || 'GET', cookie: headers.get('cookie') });
      if (url.hostname === 'intranet.example.test') return new Response('SECRET-INTERNAL-DATA', { status: 200 });
      switch (`${url.hostname}${url.pathname}`) {
        case 'jobs.example.test/position/42':
          return html(SHELL, { 'set-cookie': 'csrf=token-1; Path=/' });
        case 'jobs.example.test/position/detail':
          if (init.method !== 'POST' || !/csrf=token-1/.test(headers.get('cookie') || '')) return new Response('{}', { status: 403 });
          return new Response(JSON.stringify(JOB), { status: 200, headers: { 'content-type': 'application/json' } });
        case 'cdn.example.test/app.js':
          return new Response(APP_JS, { status: 200, headers: { 'content-type': 'application/javascript' } });
        case 'cdn.example.test/bounce':
          return new Response('', { status: 302, headers: { location: 'http://intranet.example.test/secret' } });
        case 'jobs.example.test/empty-shell':
          return html('<!doctype html><html><body><div id="app"></div><script>document.title = "x";</script></body></html>');
        case 'jobs.example.test/to-intranet':
          return new Response('', { status: 301, headers: { location: 'http://intranet.example.test/admin' } });
        case 'jobs.example.test/hang':
          return html('<html><body><div id="app"></div><script>setTimeout(() => { for (;;) {} }, 50);</script></body></html>');
        case 'jobs.example.test/loading':
          return html('<html><body><p>Welcome to Example Careers. Please wait while we load the job.</p><div id="app"></div><script src="https://cdn.example.test/challenge.js"></script></body></html>');
        case 'cdn.example.test/challenge.js':
          return new Response('document.body.innerHTML = "<h1>Verify you are human</h1>";', { status: 200, headers: { 'content-type': 'application/javascript' } });
        case 'jobs.example.test/loading-empty':
          return html('<html><body><p>Welcome to Example Careers. Please wait while we load the job.</p><script>document.body.innerHTML = "";</script></body></html>');
        case 'jobs.example.test/delayed':
          // The network goes idle first; the posting is requested a moment later.
          return html(SHELL.replace('app.js', 'delayed.js'), { 'set-cookie': 'csrf=token-1; Path=/' });
        case 'cdn.example.test/delayed.js':
          return new Response(`setTimeout(() => { ${APP_JS} }, 1200);`, { status: 200, headers: { 'content-type': 'application/javascript' } });
        case 'jobs.example.test/to-login':
          return html('<html><body><div id="app"></div><script>setTimeout(() => { location.href = "/login"; }, 100);</script></body></html>');
        case 'jobs.example.test/login':
          return new Response('<html><body><h1>Forbidden</h1><p>Your session has expired. We could not show this page.</p></body></html>', { status: 403, headers: { 'content-type': 'text/html' } });
        case 'jobs.example.test/login-wall':
          return html('<html><body><div id="app"></div><script>document.getElementById("app").innerHTML = "<h2>Please sign in to view this job posting.</h2><p>Enter your email and password.</p>";</script></body></html>');
        case 'jobs.example.test/big-inline-script':
          // 600+ characters of inline script, and the posting only arrives after 2.5 s.
          return html(`<html><body><div id="app"></div><script>/* ${'x'.repeat(600)} */ setTimeout(() => { ${APP_JS} }, 2500);</script></body></html>`, { 'set-cookie': 'csrf=token-1; Path=/' });
        case 'jobs.example.test/sign-in-to-apply':
          return html('<html><body><h1>运营专员</h1><p>地点：杭州</p><ul><li>负责社群日常运营与活动策划</li><li>两年以上运营经验</li></ul><button>Sign in to apply</button></body></html>');
        case 'jobs.example.test/short-static':
          return html('<html><body><h1>运营专员</h1><p>地点：杭州</p><ul><li>负责社群日常运营与活动策划</li><li>两年以上运营经验</li></ul></body></html>');
        case 'jobs.example.test/static':
          return html(`<html><body><h1>Sales Manager</h1><p>${'Own B2B sales in Singapore, remote-friendly, 4+ years. '.repeat(8)}</p></body></html>`);
        default:
          return new Response('not found', { status: 404 });
      }
    },
  };
  return { network, requested };
}

/** CI runners ship Chrome; locally use JD_LINK_BROWSER_PATH or a Playwright-downloaded Chromium. */
function findBrowser() {
  const candidates = [process.env.JD_LINK_BROWSER_PATH, process.env.CHROME_BIN, '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'];
  const cache = path.join(os.homedir(), process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright');
  if (fs.existsSync(cache)) {
    for (const dir of fs.readdirSync(cache).filter((d) => d.startsWith('chromium')).sort().reverse()) {
      for (const sub of fs.readdirSync(path.join(cache, dir))) {
        for (const bin of ['chrome-headless-shell', 'chrome', 'Chromium.app/Contents/MacOS/Chromium', 'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing']) {
          candidates.push(path.join(cache, dir, sub, bin));
        }
      }
    }
  }
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

const browserPath = findBrowser();
const needsBrowser = browserPath ? {} : { skip: 'no Chromium found (set JD_LINK_BROWSER_PATH)' };
const renderer = browserPath && { kind: 'local', executablePath: browserPath };

async function rejectsWith(promise, pattern) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.response?.code, 'LINK_UNREADABLE');
    assert.match(error.response.message, pattern);
    return true;
  });
}

test('#64 AC-5: a page whose initial HTML has no posting is rendered, and the posting the script loads is read', needsBrowser, async () => {
  const { network, requested } = fixtureNetwork();
  const text = await extractTextFromLink('https://jobs.example.test/position/42', { network, renderer, renderTimeoutMs: 4000 });

  assert.match(text, /AI应用算法工程师/);
  assert.match(text, /北京 \/ 广州 \/ 杭州 \/ 上海/);
  for (const duty of JOB.duties) assert.ok(text.includes(duty), `missing duty: ${duty}`);
  // The posting request carried the cookie the shell set.
  assert.ok(requested.some((r) => r.url.endsWith('/position/detail') && r.method === 'POST' && /csrf=token-1/.test(r.cookie || '')));
});

test('#64 AC-5: inside the rendered page, internal hosts stay unreachable, directly or via a public redirect', needsBrowser, async () => {
  const { network, requested } = fixtureNetwork();
  const text = await extractTextFromLink('https://jobs.example.test/position/42', { network, renderer, renderTimeoutMs: 4000 });

  assert.doesNotMatch(text, /SECRET-INTERNAL-DATA/);
  assert.deepEqual(requested.filter((r) => r.url.includes('intranet.example.test')), []);
  assert.ok(requested.some((r) => r.url === 'https://cdn.example.test/bounce'), 'the redirecting request was made, and its target refused');
});

test('#64 AC-3: a rendered page that still has no posting is refused with the reason and the paste path', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('https://jobs.example.test/empty-shell', { network, renderer, renderTimeoutMs: 4000 }), /没有找到职位内容.*粘贴/);
});

test('#64 AC-3: without a browser configured, a script-rendered page says so and points to pasting the JD', async () => {
  const { network } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('https://jobs.example.test/position/42', { network, renderer: null }), /网页脚本加载.*粘贴/);
});

test('#64 AC-5: internal addresses, non-http schemes and redirects into the intranet are still refused', async () => {
  const { network, requested } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('http://127.0.0.1:3005/health', { network, renderer, renderTimeoutMs: 4000 }), /内网地址/);
  await rejectsWith(extractTextFromLink('http://[::ffff:10.0.0.1]/', { network, renderer, renderTimeoutMs: 4000 }), /内网地址/);
  await rejectsWith(extractTextFromLink('http://intranet.example.test/admin', { network, renderer, renderTimeoutMs: 4000 }), /内网地址/);
  await rejectsWith(extractTextFromLink('ftp://jobs.example.test/file', { network, renderer, renderTimeoutMs: 4000 }), /http 或 https/);
  await rejectsWith(extractTextFromLink('https://jobs.example.test/to-intranet', { network, renderer, renderTimeoutMs: 4000 }), /内网地址/);
  assert.deepEqual(requested.filter((r) => r.url.includes('intranet.example.test')), []);
});

test('#64: a static page with its posting in the HTML is read without starting a browser', async () => {
  const { network } = fixtureNetwork();
  // The renderer points nowhere: rendering would fail, so success proves it wasn't needed.
  const text = await extractTextFromLink('https://jobs.example.test/static', { network, renderer: { kind: 'local', executablePath: '/nonexistent/chromium' } });
  assert.match(text, /Sales Manager/);
  assert.match(text, /Singapore/);
});

test('#64 review: parallel responses share one byte budget, so together they never exceed it', async () => {
  const { readWithinBudget, MAX_TOTAL_BYTES } = require('../dist/copilot/link-render');
  const MB = 1024 * 1024;
  // 8 MiB each, sent in 1 MiB chunks that interleave across the four responses.
  const streamed = () => {
    let sent = 0;
    return new Response(new ReadableStream({
      async pull(controller) {
        await new Promise((resolve) => setImmediate(resolve));
        if (sent >= 8) return controller.close();
        sent++;
        controller.enqueue(new Uint8Array(MB));
      },
    }));
  };
  const budget = { bytes: 0 };
  const bodies = await Promise.all([1, 2, 3, 4].map(() => readWithinBudget(streamed(), 10 * MB, budget)));
  const delivered = bodies.filter(Boolean).reduce((sum, body) => sum + body.byteLength, 0);
  assert.ok(delivered <= MAX_TOTAL_BYTES, `delivered ${delivered / MB} MiB`);
  assert.ok(bodies.some((body) => body === null), 'responses past the budget are dropped');
  assert.equal((await readWithinBudget(new Response(new Uint8Array(11 * MB)), 10 * MB, { bytes: 0 })), null, 'one response over its own limit is dropped');
});

test('#64 review: a short static posting is still read when rendering is unavailable or fails', async () => {
  const { network } = fixtureNetwork();
  for (const unavailable of [null, { kind: 'local', executablePath: '/nonexistent/chromium' }, { kind: 'remote', url: 'ws://127.0.0.1:9/' }]) {
    const text = await extractTextFromLink('https://jobs.example.test/short-static', { network, renderer: unavailable });
    assert.match(text, /运营专员/);
    assert.match(text, /杭州/);
    assert.ok(text.length < 200, 'short enough to have tried rendering');
  }
});

test('#64 review: a page that hangs its renderer is stopped, and the render slots are freed', needsBrowser, async () => {
  const { renderPage } = require('../dist/copilot/link-render');
  const { network } = fixtureNetwork();
  const renderNetwork = { assertPublic: async () => {}, fetch: network.fetch };
  const startedAt = Date.now();
  // Three hung renders against two slots: the third only starts once a slot is freed.
  const hung = await Promise.allSettled([1, 2, 3].map(() => renderPage(new URL('https://jobs.example.test/hang'), renderer, renderNetwork, 1000)));
  assert.deepEqual(hung.map((r) => r.status), ['rejected', 'rejected', 'rejected']);
  assert.ok(Date.now() - startedAt < 20_000, `stopped in ${Date.now() - startedAt}ms`);

  const text = await extractTextFromLink('https://jobs.example.test/position/42', { network, renderer, renderTimeoutMs: 4000 });
  assert.match(text, /AI应用算法工程师/, 'later renders still run');
});

test('#64 review: the browser does not inherit the service environment', () => {
  const source = require('node:fs').readFileSync(require.resolve('../dist/copilot/link-render'), 'utf8');
  assert.match(source, /env: \{ PATH: process\.env\.PATH/);
});

test('#64 review AC-3: what the render finds out (a human check) is reported, not hidden behind the loading text', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('https://jobs.example.test/loading', { network, renderer, renderTimeoutMs: 4000 }), /人机验证/);
  // With no render possible, the shell's loading text is not taken for a posting either.
  await rejectsWith(extractTextFromLink('https://jobs.example.test/loading', { network, renderer: null }), /网页脚本加载.*粘贴/);
});

test('#64 review AC-3: a page whose render is empty is no content, even if it said "loading" before', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('https://jobs.example.test/loading-empty', { network, renderer, renderTimeoutMs: 4000 }), /没有找到职位内容.*粘贴/);
});

test('#64: a short static posting that renders the same is read', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  const text = await extractTextFromLink('https://jobs.example.test/short-static', { network, renderer, renderTimeoutMs: 4000 });
  assert.match(text, /运营专员/);
});

test('#64 review: a posting requested after the network went idle is still waited for', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  const text = await extractTextFromLink('https://jobs.example.test/delayed', { network, renderer, renderTimeoutMs: 4000 });
  assert.match(text, /AI应用算法工程师/);
});

test('#64 review AC-3: a page that ends on an error status, or only asks to sign in, is refused with the reason', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  await rejectsWith(extractTextFromLink('https://jobs.example.test/to-login', { network, renderer, renderTimeoutMs: 3000 }), /需要登录.*粘贴/);
  await rejectsWith(extractTextFromLink('https://jobs.example.test/login-wall', { network, renderer, renderTimeoutMs: 3000 }), /需要登录.*粘贴/);
});

test('#64 review: inline scripts don\'t count as content, so a slow posting is still waited for', needsBrowser, async () => {
  const { network } = fixtureNetwork();
  const text = await extractTextFromLink('https://jobs.example.test/big-inline-script', { network, renderer, renderTimeoutMs: 6000 });
  assert.match(text, /AI应用算法工程师/);
});

test('#64 review: a posting with a "Sign in to apply" button is read, not taken for a login wall', async () => {
  const { network } = fixtureNetwork();
  for (const r of [null, renderer]) {
    const text = await extractTextFromLink('https://jobs.example.test/sign-in-to-apply', { network, renderer: r || null, renderTimeoutMs: 3000 });
    assert.match(text, /运营专员/);
    assert.match(text, /Sign in to apply/);
  }
});

/** A `playwright run-server` like the jd-renderer container, when this machine has Playwright's own Chromium. */
async function startRenderServer() {
  const { chromium } = require('playwright-core');
  if (!fs.existsSync(chromium.executablePath())) return null;
  const { spawn } = require('node:child_process');
  const port = 39000 + Math.floor(Math.random() * 500);
  const child = spawn(process.execPath, [require('node:path').join(require('node:path').dirname(require.resolve('playwright-core/package.json')), 'cli.js'), 'run-server', '--port', String(port), '--host', '127.0.0.1'], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => String(chunk).includes('Listening') && resolve());
    child.on('exit', reject);
  });
  // run-server keeps running on SIGTERM; stop it for good so the test process can exit.
  const stop = () => new Promise((resolve) => { child.stdout.destroy(); child.once('exit', resolve); child.kill('SIGKILL'); });
  return { url: `ws://127.0.0.1:${port}/`, stop };
}

test('#64 review: the remote renderer (jd-renderer) reads the posting, with interception still done here', { timeout: 60_000 }, async (t) => {
  const server = await startRenderServer();
  if (!server) return t.skip('Playwright Chromium not installed (npx playwright-core install chromium)');
  try {
    const { network, requested } = fixtureNetwork();
    const text = await extractTextFromLink('https://jobs.example.test/position/42', { network, renderer: { kind: 'remote', url: server.url }, renderTimeoutMs: 4000 });
    assert.match(text, /AI应用算法工程师/);
    assert.doesNotMatch(text, /SECRET-INTERNAL-DATA/);
    assert.deepEqual(requested.filter((r) => r.url.includes('intranet.example.test')), []);
  } finally {
    await server.stop();
  }
});

test('#64 review: every connection goes to the address that was checked; a name that turns internal is refused', async () => {
  const { publicLookup, defaultNetwork } = require('../dist/copilot/link-extract');
  const call = (resolve, host, all) => new Promise((done) => publicLookup(resolve)(host, { all }, (error, address) => done({ error, address })));
  const pub = async () => [{ address: '93.184.216.34', family: 4 }];
  const internal = async () => [{ address: '10.0.0.8', family: 4 }];
  assert.equal((await call(pub, 'jobs.example.test', false)).address, '93.184.216.34');
  assert.deepEqual((await call(pub, 'jobs.example.test', true)).address, [{ address: '93.184.216.34', family: 4 }]);
  assert.match((await call(internal, 'jobs.example.test', false)).error.message, /internal address/);

  // The real network: a request whose name resolves to loopback is refused at connect time, check or no check.
  const http = require('node:http');
  const server = http.createServer((_req, res) => res.end('SECRET')).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  try {
    await assert.rejects(defaultNetwork.fetch(`http://localhost:${server.address().port}/`), (e) => /internal address/.test(String(e.cause?.message ?? e.message)));
    await rejectsWith(extractTextFromLink(`http://localhost:${server.address().port}/`, { renderer: null }), /内网地址/);
  } finally {
    server.close();
  }
});
