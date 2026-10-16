import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Where a mail connection may go (#128). A user-entered IMAP/SMTP host is resolved once, every address it resolves
 * to must be public, and the connection is made to that address (TLS still checks the host name), so a DNS answer
 * that changes between the check and the connection can't reach an internal service. Loopback, private, link-local,
 * shared, multicast and reserved ranges are refused. A self-hosted mail server on a private network is allowed only
 * when its host name is listed in MAIL_PRIVATE_HOST_ALLOWLIST (comma-separated; empty by default) — the default
 * policy pending the Owner's confirmation on #128.
 */
const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96]] as const) {
  blocked.addSubnet(net, prefix, 'ipv6');
}

export class MailTargetError extends Error {}

/** Whether an address is one a mail connection must not reach (IPv4-mapped IPv6 judged as its IPv4 address). */
export function isBlockedAddress(address: string): boolean {
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return blocked.check(mapped[1], 'ipv4');
  const family = isIP(address);
  if (!family) return true;
  return blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function allowlisted(host: string): boolean {
  const list = (process.env.MAIL_PRIVATE_HOST_ALLOWLIST ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return list.includes(host.trim().toLowerCase());
}

/** The address to connect to for a user-entered mail host, or a MailTargetError saying why it can't be used. */
export async function resolveMailTarget(host: string, resolve: typeof lookup = lookup): Promise<{ address: string; servername: string | undefined }> {
  const name = host.trim();
  if (!name) throw new MailTargetError('Enter the mail server address.');
  const literal = isIP(name.replace(/^\[|\]$/g, '')) ? name.replace(/^\[|\]$/g, '') : null;
  let addresses: string[];
  if (literal) addresses = [literal];
  else {
    try {
      addresses = (await resolve(name, { all: true, verbatim: true })).map((a) => a.address);
    } catch {
      throw new MailTargetError('The mail server address could not be found. Check the host name.');
    }
  }
  if (!addresses.length) throw new MailTargetError('The mail server address could not be found. Check the host name.');
  if (!allowlisted(name) && addresses.some(isBlockedAddress)) {
    throw new MailTargetError('This mail server is on a private or local network, which is not allowed. Use the provider\'s public server address.');
  }
  return { address: addresses[0], servername: literal ? undefined : name };
}
