import { BadRequestException, Logger } from '@nestjs/common';
import type { LookupAddress } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { Agent, fetch as pinnedFetch } from 'undici';
import { renderPage, type Renderer } from './link-render';

const MAX_EXTRACTED_CHARS = 12_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;
const MIN_CONTENT_CHARS = 20;
// Below this the fetched HTML is treated as a script-rendered shell (e.g. only `<div id="app"></div>`) and the
// page is rendered in a browser instead (#64). A real posting is far longer than this.
const MIN_STATIC_CHARS = 200;

// The URL comes straight from the user, so the server must not be usable to reach internal hosts.
// 198.18.0.0/15 is deliberately allowed: fake-ip proxies (Clash/Surge) resolve every public host into it.
const PRIVATE_RANGES = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) PRIVATE_RANGES.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) {
  PRIVATE_RANGES.addSubnet(net, prefix, 'ipv6');
}

function isPrivateAddress(address: string, family: number): boolean {
  const mapped = family === 6 && address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : null;
  return mapped && isIP(mapped) === 4 ? PRIVATE_RANGES.check(mapped, 'ipv4') : PRIVATE_RANGES.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * The DNS lookup every connection of `defaultNetwork` makes: it resolves and checks in one step, so the socket
 * connects to exactly the address that was checked. A separate check before fetch would leave a window for a
 * name to resolve to a public address for the check and to an internal one for the connection (#64 review, #137).
 */
export function publicLookup(resolve: (host: string) => Promise<LookupAddress[]> = (host) => lookup(host, { all: true })) {
  return (hostname: string, options: { all?: boolean }, callback: LookupCallback) => {
    resolve(hostname).then(
      (addresses) => {
        if (!addresses.length) return callback(Object.assign(new Error(`no address for ${hostname}`), { code: 'ENOTFOUND' }), []);
        if (addresses.some((a) => isPrivateAddress(a.address, a.family))) {
          return callback(Object.assign(new Error(`${hostname} resolves to an internal address`), { code: PRIVATE_CODE }), []);
        }
        if (options.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      (error: NodeJS.ErrnoException) => callback(error, []),
    );
  };
}

const PRIVATE_CODE = 'EHIREOS_PRIVATE_ADDRESS';
const pinnedAgent = new Agent({ connect: { lookup: publicLookup() } });

/** Errors (or their causes) from a connection `publicLookup` refused. */
function isPrivateRefusal(error: unknown): boolean {
  for (let e = error as { code?: unknown; cause?: unknown } | undefined; e; e = e.cause as typeof e) {
    if (e.code === PRIVATE_CODE) return true;
  }
  return false;
}

const logger = new Logger('LinkExtract');

const PASTE_HINT = '请打开链接复制 JD 全文，粘贴到下方。';
const BLOCKED_MESSAGE = `这个网站开启了人机验证，无法自动读取职位内容。${PASTE_HINT}`;
const PRIVATE_MESSAGE = '不支持访问内网地址。';
const SCRIPT_PAGE_MESSAGE = `这个页面的职位内容由网页脚本加载，当前无法自动读取。${PASTE_HINT}`;
const LOGIN_MESSAGE = `这个页面需要登录才能查看职位内容，无法自动读取。${PASTE_HINT}`;
const NO_CONTENT_MESSAGE = `页面已打开，但没有找到职位内容，可能需要登录，或职位已下线。${PASTE_HINT}`;

/** Network access used to read a link; injectable so tests run without the internet. */
export type LinkNetwork = {
  lookup: (host: string) => Promise<Array<{ address: string; family: number }>>;
  fetch: typeof fetch;
};

export type LinkExtractOptions = {
  network?: LinkNetwork;
  /**
   * Browser used to render script-loaded pages. Defaults to the `jd-renderer` service (JD_LINK_RENDERER_URL),
   * else a local Chromium (JD_LINK_BROWSER_PATH, for development). `null`, or neither set, disables rendering.
   */
  renderer?: Renderer | null;
  /** How long a page gets to render its posting; tests use less. */
  renderTimeoutMs?: number;
};

function configuredRenderer(): Renderer | null {
  const url = process.env.JD_LINK_RENDERER_URL?.trim();
  if (url) return { kind: 'remote', url };
  const executablePath = process.env.JD_LINK_BROWSER_PATH?.trim();
  return executablePath ? { kind: 'local', executablePath } : null;
}

/** Real network: each connection goes to the address `publicLookup` checked (an IP literal is checked up front). */
export const defaultNetwork: LinkNetwork = {
  lookup: (host) => lookup(host, { all: true }),
  fetch: ((input: string | URL, init?: RequestInit) =>
    pinnedFetch(input, { ...(init as object), dispatcher: pinnedAgent })) as unknown as typeof fetch,
};

function linkError(message: string): BadRequestException {
  return new BadRequestException({ code: 'LINK_UNREADABLE', message });
}

async function assertPublicUrl(url: URL, network: LinkNetwork): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw linkError('只支持 http 或 https 链接。');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await network.lookup(host).catch(() => []);
  if (addresses.length === 0) throw linkError('无法解析这个链接的域名。');
  // An early, readable refusal; the connection itself is pinned to a checked address by `publicLookup`.
  if (addresses.some(({ address, family }) => isPrivateAddress(address, family))) throw linkError(PRIVATE_MESSAGE);
}

/**
 * Fetches a public job posting page and returns its readable text (plain text only, like file extraction).
 * Pages whose posting is loaded by scripts are rendered in a sandboxed browser (#64).
 */
export async function extractTextFromLink(rawUrl: string, options: LinkExtractOptions = {}): Promise<string> {
  const network = options.network ?? defaultNetwork;
  let url = new URL(rawUrl);
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url, network);
    response = await network.fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HireOS-JD/1.0)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
    }).catch((error: unknown) => {
      throw linkError(isPrivateRefusal(error) ? PRIVATE_MESSAGE : '打开这个链接失败，请检查链接是否可以公开访问。');
    });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    break;
  }
  if (response && response.status >= 300 && response.status < 400) throw linkError(`这个链接跳转次数过多，请改为粘贴 JD 文案。`);
  if (response && [401, 403, 429].includes(response.status)) throw linkError(BLOCKED_MESSAGE);
  if (!response || !response.ok) throw linkError(`打开这个链接失败（${response?.status ?? '无响应'}），请改为粘贴 JD 文案。`);

  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) throw linkError('这个链接不是网页，请改为粘贴 JD 文案。');
  const body = await readLimited(response);
  const isHtml = /html/i.test(contentType);
  // Job boards publish schema.org JobPosting for search engines; it is cleaner than the page chrome around it.
  const posting = isHtml ? jobPostingText(body) : null;
  let text = (posting || (isHtml ? htmlToText(body) : body)).trim();
  if (looksLikeBotChallenge(text)) throw linkError(BLOCKED_MESSAGE);
  if (looksLikeLoginWall(text)) throw linkError(LOGIN_MESSAGE);
  // Render when the HTML is too thin to be the posting, or is an app shell whose posting arrives by script even
  // if other static text (a company intro) is long (#64 review). Structured JobPosting data needs no render.
  const scriptShell = isHtml && !posting && looksLikeScriptShell(body);
  if (isHtml && !posting && (text.length < MIN_STATIC_CHARS || scriptShell)) text = await preferRendered(text, scriptShell, url, network, options);
  if (text.length < MIN_CONTENT_CHARS) throw linkError(NO_CONTENT_MESSAGE);
  return text.length > MAX_EXTRACTED_CHARS ? text.slice(0, MAX_EXTRACTED_CHARS) : text;
}

/** No browser to render with, or the render broke down (connection, crash, timeout) — says nothing about the page. */
class RenderUnavailable extends Error {}

/**
 * A short static page may be a script-rendered shell or simply a short posting, and only rendering tells.
 * Once a page has been rendered, the rendered page is what counts: static text such as "please wait while we
 * load the job" is not a posting, and an empty render is reported as no content (AC-3). The static text is
 * used only when no render could be done at all (#64 review).
 */
async function preferRendered(staticText: string, scriptShell: boolean, url: URL, network: LinkNetwork, options: LinkExtractOptions): Promise<string> {
  try {
    return await renderedText(url, network, options);
  } catch (error) {
    if (!(error instanceof RenderUnavailable)) throw error;
    // A shell's own text ("please wait while we load the job") is not the posting.
    if (!scriptShell && staticText.length >= MIN_CONTENT_CHARS) return staticText;
    throw linkError(SCRIPT_PAGE_MESSAGE);
  }
}

/** The HTML is an app shell whose content arrives by script: an empty mount point, or a "please enable JavaScript". */
function looksLikeScriptShell(html: string): boolean {
  return hasEmptyMountPoint(html) || /<noscript\b[^>]*>[\s\S]*?(enable|turn on|启用|开启|打开)[\s\S]{0,20}javascript/i.test(html);
}

/**
 * The app's mount point is (still) empty. After rendering this alone tells that the posting never loaded: a
 * `<noscript>` notice stays in the HTML even when scripts ran and filled the page (#64 review).
 */
function hasEmptyMountPoint(html: string): boolean {
  return /<(div|main|section)\b[^>]*\bid=["'](app|root|__next|__nuxt|main-app)["'][^>]*>\s*<\/\1>/i.test(html);
}

async function renderedText(url: URL, network: LinkNetwork, options: LinkExtractOptions): Promise<string> {
  const renderer = options.renderer === undefined ? configuredRenderer() : options.renderer;
  if (!renderer) throw new RenderUnavailable('no renderer configured');
  // Checked per request, not cached per host: a name may resolve differently from one request to the next.
  const result = await renderPage(url, renderer, {
    assertPublic: (target) => assertPublicUrl(target, network),
    fetch: network.fetch,
  }, options.renderTimeoutMs).catch((error: unknown) => {
    if (error instanceof BadRequestException) throw error;
    // e.g. the renderer unreachable or crashed: the user gets the paste path, operators get the cause.
    logger.warn(`rendering ${url.origin} failed: ${error instanceof Error ? error.message : String(error)}`);
    throw new RenderUnavailable(error instanceof Error ? error.message : String(error));
  });
  if ('blocked' in result) throw linkError(PRIVATE_MESSAGE);
  if ('status' in result) {
    if ([401, 403, 429].includes(result.status)) throw linkError(result.status === 429 ? BLOCKED_MESSAGE : LOGIN_MESSAGE);
    throw linkError(`打开这个链接失败（${result.status}），请改为粘贴 JD 文案。`);
  }
  const posting = jobPostingText(result.html);
  const text = (posting || htmlToText(result.html)).trim();
  if (looksLikeBotChallenge(text)) throw linkError(BLOCKED_MESSAGE);
  if (looksLikeLoginWall(text)) throw linkError(LOGIN_MESSAGE);
  // Still an empty mount point after rendering: the posting never loaded, and what text there is is the page's
  // placeholder ("please wait while we load the job"), not the posting (#64 review AC-3).
  if (!posting && hasEmptyMountPoint(result.html)) throw linkError(NO_CONTENT_MESSAGE);
  return text;
}

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|head|nav|footer)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

// Anti-bot interstitials (Cloudflare, Jobright, etc.) return 200 with a short "checking your browser" page.
const CHALLENGE_PATTERNS = [
  /security check/i, /verify (that )?you are (a )?human/i, /are you a robot/i, /checking your browser/i,
  /just a moment/i, /captcha/i, /access denied/i, /enable javascript and cookies/i, /人机验证/, /安全验证/, /验证码/,
];

// A page that only asks to sign in before it shows anything (#64 review AC-3). Only phrases about seeing the
// content count: a posting with a "Sign in to apply" button is still a readable posting.
const LOGIN_PATTERNS = [
  /\b(sign|log)\s?in to (view|see|read|access)\b/i, /\blogin required\b/i,
  /(登录|登陆)后(查看|浏览|阅读)/, /(需要|请先?)(登录|登陆)(后|才能)(查看|浏览|阅读)/,
];
// A real posting runs well past this; a login wall is a sentence or two around a form.
const MAX_LOGIN_WALL_CHARS = 600;

function looksLikeLoginWall(text: string): boolean {
  return text.length < MAX_LOGIN_WALL_CHARS && LOGIN_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeBotChallenge(text: string): boolean {
  return text.length < 1500 && CHALLENGE_PATTERNS.some((pattern) => pattern.test(text));
}

type JsonLdNode = Record<string, unknown>;

function jobPostingText(html: string): string | null {
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const posting = findJobPosting(parsed);
    if (!posting) continue;
    const description = typeof posting.description === 'string' ? htmlToText(decodeEntities(posting.description)).trim() : '';
    if (description.length < 50) continue;
    const lines = [
      field('职位名称', posting.title),
      field('公司', (posting.hiringOrganization as JsonLdNode | undefined)?.name),
      field('工作地点', locationText(posting.jobLocation)),
      field('远程', posting.jobLocationType),
      field('雇佣类型', posting.employmentType),
    ].filter(Boolean);
    return [...lines, '', description].join('\n');
  }
  return null;
}

function findJobPosting(node: unknown): JsonLdNode | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findJobPosting(item);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const record = node as JsonLdNode;
  const type = record['@type'];
  if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) return record;
  return record['@graph'] ? findJobPosting(record['@graph']) : null;
}

function locationText(location: unknown): string | undefined {
  const places = Array.isArray(location) ? location : location ? [location] : [];
  const names = places
    .map((place) => {
      const address = (place as JsonLdNode)?.address as JsonLdNode | string | undefined;
      if (!address) return '';
      if (typeof address === 'string') return address;
      return [address.addressLocality, address.addressRegion, address.addressCountry]
        .map((part) => (part && typeof part === 'object' ? (part as JsonLdNode).name : part))
        .filter((part) => typeof part === 'string' && part)
        .join(', ');
    })
    .filter(Boolean);
  return names.length ? names.join(' / ') : undefined;
}

function field(label: string, value: unknown): string | null {
  const text = Array.isArray(value) ? value.filter((item) => typeof item === 'string').join(', ') : value;
  return typeof text === 'string' && text.trim() ? `${label}：${text.trim()}` : null;
}

function decodeEntities(text: string): string {
  return text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
}
