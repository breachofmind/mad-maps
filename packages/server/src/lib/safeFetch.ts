import dns from 'node:dns/promises';
import net from 'node:net';

// Blocks the common private/loopback/link-local/reserved IPv4 and IPv6
// ranges so a fetch driven by a user-supplied URL (the "custom URL" add-
// layer flow) can't be pointed at internal infrastructure (localhost,
// cloud metadata endpoints, RFC1918 ranges, etc).
function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 192 && b === 0 && parts[2] === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true;
    return false;
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('::ffff:')) {
      return isPrivateOrReservedIp(normalized.slice('::ffff:'.length));
    }
    return false;
  }
  return true;
}

export class UnsafeUrlError extends Error {}

// Resolves the URL's hostname and rejects it if it points at a private or
// reserved address, then performs the fetch. This doesn't protect against
// DNS rebinding between the check and the actual connection, which is an
// accepted limitation for this use case (proxying read-only public GeoJSON
// endpoints, not an arbitrary-request proxy).
export async function safeFetch(url: string, init: RequestInit): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError(`Unsupported protocol: ${parsed.protocol}`);
  }
  if (parsed.hostname === 'localhost') {
    throw new UnsafeUrlError('Requests to localhost are not allowed');
  }

  const literalIpVersion = net.isIP(parsed.hostname);
  const addresses = literalIpVersion
    ? [parsed.hostname]
    : (await dns.lookup(parsed.hostname, { all: true })).map((entry) => entry.address);

  if (addresses.length === 0 || addresses.some(isPrivateOrReservedIp)) {
    throw new UnsafeUrlError('Requests to private or reserved addresses are not allowed');
  }

  return fetch(url, init);
}
