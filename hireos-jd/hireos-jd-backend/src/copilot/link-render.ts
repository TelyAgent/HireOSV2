import type { Browser, Page, Route } from 'playwright-core';

/**
 * Renders a public job page whose content is loaded by scripts (#64), and returns the rendered HTML. The caller
 * turns it into text the same way as fetched HTML; innerText would depend on CSS, and a page can keep its body
 * hidden until the fonts and images this renderer skips have loaded.
 *
 * The browser never touches the network itself: it runs behind a dead proxy, and every request it makes is
 * intercepted and either refused or fetched by Node, after the same public-address check as the plain fetch.
 * Node follows redirects itself and checks every hop: the browser does not route the follow-up request of a
 * fulfilled 3xx, which would otherwise hit the dead proxy.
 *
 * In deployment the browser runs in its own container (hireos-jd/jd-renderer): no secrets, no database, on an
 * internal network without internet access. This service connects to it remotely; interception still happens
 * here, so the renderer never needs network access. Local development may launch a Chromium binary directly.
 */

/** The `jd-renderer` service's Playwright endpoint, or a local Chromium binary. */
export type Renderer = { kind: 'remote'; url: string } | { kind: 'local'; executablePath: string };

export type RenderNetwork = {
  /** Throws when the URL may not be fetched (non-http(s), private address, ...). */
  assertPublic: (url: URL) => Promise<void>;
  fetch: typeof fetch;
};

/** The rendered page, or why it can't be read: an internal address, or an HTTP error status of the page itself. */
export type RenderResult = { html: string } | { blocked: 'private_address' } | { status: number };

/** How long a page gets to show its posting. */
export const RENDER_TIMEOUT_MS = 20_000;
/** On top of the render time: the most launch and teardown may add, whatever the page does. */
const HARD_STOP_GRACE_MS = 5_000;
const MAX_RENDER_REQUESTS = 200;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
const MAX_CONCURRENT_RENDERS = 2;
const MAX_REDIRECTS = 5;
// Not needed to read a page's text, and the bulk of its bytes.
const SKIPPED_RESOURCES = new Set(['image', 'media', 'font', 'ping', 'websocket', 'eventsource', 'manifest', 'other']);
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'POST']);
// Set by the browser or by fetch itself; forwarding them would be rejected or wrong.
const DROPPED_REQUEST_HEADERS = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'keep-alive', 'upgrade', 'expect', 'te', 'trailer']);

let running = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_RENDERS) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await run();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

// Anything the route handler doesn't fulfill (it fulfills or aborts every http(s) request) has nowhere to go.
const DEAD_PROXY = { server: '127.0.0.1:9', bypass: '<-loopback>' };

async function openBrowser(renderer: Renderer): Promise<Browser> {
  const { chromium } = await import('playwright-core');
  if (renderer.kind === 'remote') {
    // The renderer starts a fresh browser per connection; closing this connection ends that browser.
    return chromium.connect(renderer.url, {
      timeout: RENDER_TIMEOUT_MS,
      headers: { 'x-playwright-launch-options': JSON.stringify({ proxy: DEAD_PROXY }) },
    });
  }
  return chromium.launch({
    executablePath: renderer.executablePath,
    timeout: RENDER_TIMEOUT_MS,
    proxy: DEAD_PROXY,
    args: ['--disable-dev-shm-usage'],
    // The page is untrusted: a local browser gets none of the service's environment (database URL, API keys).
    env: { PATH: process.env.PATH ?? '/usr/bin:/bin', HOME: '/tmp', TMPDIR: '/tmp' },
  });
}

export async function renderPage(url: URL, renderer: Renderer, network: RenderNetwork, timeoutMs = RENDER_TIMEOUT_MS): Promise<RenderResult> {
  const hardStopMs = timeoutMs + HARD_STOP_GRACE_MS;
  return withRenderSlot(async () => {
    const browser = await openBrowser(renderer);
    // A page can hang its renderer (e.g. a busy loop), and then calls like page.content() never return. The hard
    // stop closes the browser — which fails whatever is still pending — and gives up on the render either way,
    // so a render slot is always released (#64 review).
    let hardStop: NodeJS.Timeout | undefined;
    const stopped = new Promise<never>((_, reject) => {
      hardStop = setTimeout(() => {
        void browser.close().catch(() => undefined);
        reject(new Error(`render exceeded ${hardStopMs}ms`));
      }, hardStopMs);
    });
    try {
      return await Promise.race([render(browser, url, network, timeoutMs), stopped]);
    } finally {
      clearTimeout(hardStop);
      await browser.close().catch(() => undefined);
    }
  });
}

type RenderState = {
  requests: number;
  bytes: number;
  documentBlocked: boolean;
  documentRedirects: number;
  /** Where the first load was redirected to, for `render` to navigate on. */
  redirectTo?: string;
  /** The first load is done: later page redirects are navigated on by the route handler. */
  loaded: boolean;
};

async function render(browser: Browser, url: URL, network: RenderNetwork, timeoutMs: number): Promise<RenderResult> {
  const deadline = Date.now() + timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'zh-CN', acceptDownloads: false });
  const state: RenderState = { requests: 0, bytes: 0, documentBlocked: false, documentRedirects: 0, loaded: false };
  let mainPage: Page | null = null;
  context.on('page', (page) => {
    // Pop-ups a page opens are never part of the posting.
    if (mainPage && page !== mainPage) void page.close().catch(() => undefined);
  });
  await context.route('**/*', (route) => handleRoute(route, network, state, remaining));
  mainPage = await context.newPage();
  const page = mainPage;
  // The status of the document the page ends up on: a script may navigate to a login or error page (#64 review).
  let documentStatus = 0;
  page.on('response', (response) => {
    if (response.request().isNavigationRequest() && response.frame() === page.mainFrame()) documentStatus = response.status();
  });
  try {
    let response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: remaining() }).catch(() => null);
    while (!response && state.redirectTo && !state.documentBlocked) {
      const next = state.redirectTo;
      state.redirectTo = undefined;
      response = await page.goto(next, { waitUntil: 'domcontentloaded', timeout: remaining() }).catch(() => null);
    }
    state.loaded = true;
    if (state.documentBlocked) return { blocked: 'private_address' };
    if (!response) return { html: '' };
    // The posting arrives from scripts, possibly after a pause with the network idle (a timer, a lazy request),
    // so idle network is no sign it has loaded. Stop once the text is long enough and has stopped changing,
    // else at the deadline (#64 review).
    await waitForStableText(page, deadline, () => documentStatus >= 400 || state.documentBlocked).catch(() => undefined);
    if (state.documentBlocked) return { blocked: 'private_address' };
    if (documentStatus >= 400) return { status: documentStatus };
    return { html: await page.content() };
  } finally {
    await context.close().catch(() => undefined);
  }
}

const STABLE_TEXT_CHARS = 200;
const STABLE_POLL_MS = 500;
const STABLE_POLLS = 3;

/** Until the text is long enough and settled, `done()` (e.g. the page landed on an error status), or the deadline. */
async function waitForStableText(page: Page, deadline: number, done: () => boolean): Promise<void> {
  let last = -1;
  let same = 0;
  while (Date.now() + STABLE_POLL_MS < deadline) {
    await page.waitForTimeout(STABLE_POLL_MS);
    if (done()) return;
    // Visible-content text only: inline scripts and styles count toward textContent but are no posting (#64 review).
    const length = await page
      .evaluate(() => {
        const body = document.body?.cloneNode(true) as HTMLElement | undefined;
        if (!body) return 0;
        body.querySelectorAll('script, style, noscript, template, svg').forEach((node) => node.remove());
        return (body.textContent ?? '').replace(/\s+/g, ' ').trim().length;
      })
      .catch(() => -1);
    same = length >= STABLE_TEXT_CHARS && length === last ? same + 1 : 0;
    if (same >= STABLE_POLLS) return;
    last = length;
  }
}

async function handleRoute(
  route: Route,
  network: RenderNetwork,
  state: RenderState,
  remaining: () => number,
): Promise<void> {
  const request = route.request();
  const isDocument = request.isNavigationRequest() && isMainFrame(route);
  let target: URL;
  try {
    target = new URL(request.url());
  } catch {
    return route.abort('blockedbyclient');
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return route.abort('blockedbyclient');
  if (SKIPPED_RESOURCES.has(request.resourceType())) return route.abort('blockedbyclient');
  if (!ALLOWED_METHODS.has(request.method())) return route.abort('blockedbyclient');
  if (++state.requests > MAX_RENDER_REQUESTS) return route.abort('blockedbyclient');
  try {
    const postData = request.method() === 'POST' ? request.postDataBuffer() : null;
    const headers = Object.fromEntries(
      Object.entries(await request.allHeaders()).filter(([name]) => !DROPPED_REQUEST_HEADERS.has(name) && !name.startsWith(':') && !name.startsWith('proxy-')),
    );
    let method = request.method();
    let body: Uint8Array<ArrayBuffer> | undefined = postData ? new Uint8Array(postData) : undefined;
    let response: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      try {
        await network.assertPublic(target);
      } catch {
        if (isDocument) state.documentBlocked = true;
        return await route.abort('blockedbyclient');
      }
      response = await network.fetch(target, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(remaining()) });
      const location = response.headers.get('location');
      if (response.status < 300 || response.status >= 400 || !location) break;
      await response.body?.cancel().catch(() => undefined);
      const next = new URL(location, target);
      // The browser's cookies belong to the origin it asked; don't hand them to wherever that redirects.
      if (next.origin !== target.origin) {
        delete headers.cookie;
        delete headers.authorization;
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') return await route.abort('blockedbyclient');
      // A page redirect must change the browser's address, or relative scripts and APIs resolve against the old
      // one (#64 review): the browser navigates to the next hop itself, which is routed and checked like this one.
      if (isDocument) {
        if (++state.documentRedirects > MAX_REDIRECTS) return await route.abort('blockedbyclient');
        await route.abort('aborted').catch(() => undefined);
        if (state.loaded) {
          void request.frame().goto(next.href, { waitUntil: 'domcontentloaded', timeout: remaining() }).catch(() => undefined);
        } else {
          state.redirectTo = next.href; // the first load is followed up by `render`
        }
        return;
      }
      target = next;
      // Like a browser: 303, and 301/302 after POST, continue as GET without a body.
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      response = null;
    }
    if (!response) return await route.abort('blockedbyclient');
    const content = await readWithinBudget(response, MAX_RESPONSE_BYTES, state);
    if (content === null) return await route.abort('blockedbyclient');
    await route.fulfill({ status: response.status, headers: responseHeaders(response), body: content });
  } catch {
    await route.abort('failed').catch(() => undefined);
  }
}

function isMainFrame(route: Route): boolean {
  try {
    const frame = route.request().frame();
    return frame === frame.page().mainFrame();
  } catch {
    return false;
  }
}

/** fetch has already decoded the body, so the encoding/length headers no longer describe it. */
function responseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (name === 'content-encoding' || name === 'content-length' || name === 'set-cookie') return;
    headers[name] = value;
  });
  // Pages read their CSRF token from cookies set by the shell; the browser takes several cookies newline-separated.
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers['set-cookie'] = cookies.join('\n');
  return headers;
}

/**
 * Reads a response body, returning null once it exceeds `limit` or the render's shared byte budget is spent.
 * Requests run in parallel, so the budget is charged chunk by chunk as bytes arrive, not after a body is complete:
 * otherwise each of many concurrent responses could pass a check against the same remaining amount (#64 review).
 */
export async function readWithinBudget(response: Response, limit: number, budget: { bytes: number }): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    // Bytes already read stay charged even when the response is then dropped: they were received.
    budget.bytes += value.byteLength;
    if (size > limit || budget.bytes > MAX_TOTAL_BYTES) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
