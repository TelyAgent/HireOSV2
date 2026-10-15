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
 */

export type RenderNetwork = {
  /** Throws when the URL may not be fetched (non-http(s), private address, ...). */
  assertPublic: (url: URL) => Promise<void>;
  fetch: typeof fetch;
};

export type RenderResult = { html: string } | { blocked: 'private_address' };

const RENDER_TIMEOUT_MS = 20_000;
const MAX_RENDER_REQUESTS = 200;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;
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

export async function renderPage(url: URL, browserPath: string, network: RenderNetwork): Promise<RenderResult> {
  return withRenderSlot(async () => {
    const { chromium } = await import('playwright-core');
    const browser = await chromium.launch({
      executablePath: browserPath,
      timeout: RENDER_TIMEOUT_MS,
      // Anything the route handler doesn't fulfill (it fulfills or aborts every http(s) request) has nowhere to go.
      args: ['--proxy-server=127.0.0.1:9', '--proxy-bypass-list=<-loopback>', '--disable-dev-shm-usage'],
    });
    try {
      return await render(browser, url, network);
    } finally {
      await browser.close().catch(() => undefined);
    }
  });
}

async function render(browser: Browser, url: URL, network: RenderNetwork): Promise<RenderResult> {
  const deadline = Date.now() + RENDER_TIMEOUT_MS;
  const remaining = () => Math.max(1, deadline - Date.now());
  const context = await browser.newContext({ serviceWorkers: 'block', locale: 'zh-CN', acceptDownloads: false });
  const state = { requests: 0, bytes: 0, documentBlocked: false };
  let mainPage: Page | null = null;
  context.on('page', (page) => {
    // Pop-ups a page opens are never part of the posting.
    if (mainPage && page !== mainPage) void page.close().catch(() => undefined);
  });
  await context.route('**/*', (route) => handleRoute(route, network, state, remaining));
  mainPage = await context.newPage();
  try {
    const response = await mainPage.goto(url.href, { waitUntil: 'domcontentloaded', timeout: remaining() }).catch(() => null);
    if (state.documentBlocked) return { blocked: 'private_address' };
    if (!response) return { html: '' };
    // Content arrives from XHRs after the shell loads. Analytics keep many pages from ever going network-idle,
    // so also stop once the text is long enough and has stopped changing, and always at the deadline.
    const page = mainPage;
    await Promise.race([
      page.waitForLoadState('networkidle', { timeout: remaining() }).catch(() => undefined),
      // The loser keeps polling until the page closes; its rejection then must not go unhandled.
      waitForStableText(page, deadline).catch(() => undefined),
    ]);
    if (state.documentBlocked) return { blocked: 'private_address' };
    return { html: await mainPage.content() };
  } finally {
    await context.close().catch(() => undefined);
  }
}

const STABLE_TEXT_CHARS = 200;
const STABLE_POLL_MS = 500;
const STABLE_POLLS = 3;

async function waitForStableText(page: Page, deadline: number): Promise<void> {
  let last = -1;
  let same = 0;
  while (Date.now() + STABLE_POLL_MS < deadline) {
    await page.waitForTimeout(STABLE_POLL_MS);
    const length = await page.evaluate(() => document.body?.textContent?.length ?? 0).catch(() => -1);
    same = length >= STABLE_TEXT_CHARS && length === last ? same + 1 : 0;
    if (same >= STABLE_POLLS) return;
    last = length;
  }
}

async function handleRoute(
  route: Route,
  network: RenderNetwork,
  state: { requests: number; bytes: number; documentBlocked: boolean },
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
      target = next;
      if (target.protocol !== 'http:' && target.protocol !== 'https:') return await route.abort('blockedbyclient');
      // Like a browser: 303, and 301/302 after POST, continue as GET without a body.
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
      response = null;
    }
    if (!response) return await route.abort('blockedbyclient');
    const content = await readCapped(response, Math.min(MAX_RESPONSE_BYTES, MAX_TOTAL_BYTES - state.bytes));
    if (content === null) return await route.abort('blockedbyclient');
    state.bytes += content.byteLength;
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

/** Returns null when the response is larger than `limit`. */
async function readCapped(response: Response, limit: number): Promise<Buffer | null> {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
