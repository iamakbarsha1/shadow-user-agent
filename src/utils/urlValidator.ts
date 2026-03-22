import { InvalidUrlError } from './errors';

/**
 * SSRF protection — URL validator for target URLs submitted by users.
 * Blocks private IP ranges, loopback addresses, metadata endpoints, and
 * non-HTTP(S) protocols. Whitelisting via ALLOWED_INTERNAL_HOSTS env var.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/** Exact hostnames that are always blocked */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '169.254.169.254', // AWS / GCP / Azure metadata endpoint
  'metadata.google.internal',
]);

/** Blocked ports (e.g. internal services, databases) */
const BLOCKED_PORTS = new Set([
  22,   // SSH
  3306, // MySQL
  5432, // PostgreSQL
  6379, // Redis
  27017, // MongoDB
]);

/**
 * Returns true if the hostname is a private or loopback IP address.
 * Covers IPv4 private ranges (10.x, 172.16-31.x, 192.168.x) and loopback.
 */
function isPrivateIp(hostname: string): boolean {
  const privateRanges = [
    /^127\./,                          // 127.0.0.0/8   loopback
    /^10\./,                            // 10.0.0.0/8    private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,  // 172.16-31.x   private
    /^192\.168\./,                       // 192.168.x.x   private
    /^169\.254\./,                       // 169.254.x.x   link-local
    /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // 100.64-127.x  CGNAT
    /^0\./,                              // 0.0.0.0/8
    /^fc[0-9a-f]{2}:/i,                  // IPv6 unique local
    /^fe80:/i,                           // IPv6 link-local
  ];

  return privateRanges.some((re) => re.test(hostname));
}

/**
 * Validates a target URL before the agent starts.
 *
 * @param rawUrl - Raw URL string from the API request
 * @throws InvalidUrlError if the URL is blocked or malformed
 */
export function validateTargetUrl(rawUrl: string): void {
  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new InvalidUrlError(rawUrl);
  }

  // Protocol check
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new InvalidUrlError(rawUrl);
  }

  // Strip IPv6 brackets — new URL('http://[::1]').hostname returns '[::1]'
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  // Exact blocked hostname check
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new InvalidUrlError(rawUrl);
  }

  // Private IP range check — unless explicitly whitelisted
  if (isPrivateIp(hostname)) {
    const allowedHosts = (process.env.ALLOWED_INTERNAL_HOSTS || '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (!allowedHosts.includes(hostname)) {
      throw new InvalidUrlError(rawUrl);
    }
  }

  // Blocked port check
  if (parsed.port) {
    const port = parseInt(parsed.port, 10);
    if (BLOCKED_PORTS.has(port)) {
      throw new InvalidUrlError(rawUrl);
    }
  }
}
