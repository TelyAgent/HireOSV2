import { BadRequestException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

const MAX_EXTRACTED_CHARS = 12_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

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

const BLOCKED_MESSAGE = '这个网站开启了人机验证，无法自动读取职位内容。请打开链接复制 JD 全文，粘贴到下方。';

function linkError(message: string): BadRequestException {
  return new BadRequestException({ code: 'LINK_UNREADABLE', message });
}

async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw linkError('只支持 http 或 https 链接。');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw linkError('无法解析这个链接的域名。');
  for (const { address, family } of addresses) {
    const mapped = family === 6 && address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : null;
    const blocked = mapped && isIP(mapped) === 4
      ? PRIVATE_RANGES.check(mapped, 'ipv4')
      : PRIVATE_RANGES.check(address, family === 6 ? 'ipv6' : 'ipv4');
    if (blocked) throw linkError('不支持访问内网地址。');
  }
}

/** Fetches a public job posting page and returns its readable text (plain text only, like file extraction). */
export async function extractTextFromLink(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);
  let response: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; HireOS-JD/1.0)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5' },
    }).catch(() => {
      throw linkError('打开这个链接失败，请检查链接是否可以公开访问。');
    });
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    break;
  }
  if (response && [401, 403, 429].includes(response.status)) throw linkError(BLOCKED_MESSAGE);
  if (!response || !response.ok) throw linkError(`打开这个链接失败（${response?.status ?? '无响应'}），请改为粘贴 JD 文案。`);

  const contentType = response.headers.get('content-type') || '';
  if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) throw linkError('这个链接不是网页，请改为粘贴 JD 文案。');
  const body = await readLimited(response);
  const isHtml = /html/i.test(contentType);
  // Job boards publish schema.org JobPosting for search engines; it is cleaner than the page chrome around it.
  const text = (isHtml && jobPostingText(body)) || (isHtml ? htmlToText(body) : body);
  const trimmed = text.trim();
  if (looksLikeBotChallenge(trimmed)) throw linkError(BLOCKED_MESSAGE);
  if (trimmed.length < 20) throw linkError('没有从这个页面读取到职位内容，请改为粘贴 JD 文案。');
  return trimmed.length > MAX_EXTRACTED_CHARS ? trimmed.slice(0, MAX_EXTRACTED_CHARS) : trimmed;
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
