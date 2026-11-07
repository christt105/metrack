import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';
import { ImageRejectedError } from './ImageRejectedError.js';
import type { UrlGuard } from './UrlGuard.js';

const PRIVATE = new BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 3],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
  ['::', 127],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  PRIVATE.addSubnet(network, prefix, 'ipv6');
}

/**
 * Lets the server fetch only http and https URLs whose host resolves to public addresses, so a URL a user
 * types cannot reach the home network or the server itself.
 */
export class PublicAddressGuard implements UrlGuard {
  constructor(
    private readonly resolve: (host: string) => Promise<string[]> = async (host) =>
      (await lookup(host, { all: true })).map((entry) => entry.address),
  ) {}

  async check(url: URL): Promise<void> {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw refused();
    const host = url.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    try {
      addresses = isIP(host) === 0 ? await this.resolve(host) : [host];
    } catch {
      throw new ImageRejectedError('url_not_allowed', 'That address could not be resolved');
    }
    if (addresses.length === 0 || addresses.some((address) => isPrivate(address))) throw refused();
  }
}

function isPrivate(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped !== undefined) return PRIVATE.check(mapped, 'ipv4');
  return PRIVATE.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');
}

function refused(): ImageRejectedError {
  return new ImageRejectedError(
    'url_not_allowed',
    'Images can only come from public web addresses',
  );
}
