/**
 * Local Endpoint Security Policy
 * Enforces strict allowlisting, SSRF prevention, and hosted-mode rejection
 * for separately operated local model endpoints.
 */

import { RuntimeProfile } from '../../config/EnvironmentDefinitions';

export class LocalEndpointSecurityError extends Error {
  constructor(message: string, public readonly code: string = 'LOCAL_ENDPOINT_SECURITY_VIOLATION') {
    super(message);
    this.name = 'LocalEndpointSecurityError';
  }
}

export interface LocalEndpointValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

const DEFAULT_LOOPBACK_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]'
]);

const BLOCKED_METADATA_HOSTS = new Set([
  '169.254.169.254', // AWS / GCP / Azure metadata
  '169.254.170.2',   // AWS ECS task metadata
  'metadata.google.internal',
  'metadata',
  'instance-data'
]);

export class LocalEndpointPolicy {
  /**
   * Validate whether an endpoint URL is permissible under current runtime profile.
   */
  static validate(
    urlString: string,
    profile: RuntimeProfile = 'local',
    customAllowlist: string[] = []
  ): LocalEndpointValidationResult {
    if (!urlString || typeof urlString !== 'string') {
      return { valid: false, reason: 'Endpoint URL must be a non-empty string' };
    }

    if (profile === 'hosted') {
      return {
        valid: false,
        reason: 'Local model endpoints and process-management controls are strictly rejected in HOSTED mode'
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      return { valid: false, reason: `Malformed endpoint URL: ${urlString}` };
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return {
        valid: false,
        reason: `Unsupported URL protocol '${parsed.protocol}'. Only http: and https: are allowed.`
      };
    }

    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // Check blocked cloud metadata endpoints (SSRF protection)
    if (BLOCKED_METADATA_HOSTS.has(hostname) || hostname.startsWith('169.254.')) {
      return {
        valid: false,
        reason: `Blocked target host '${hostname}' (cloud metadata service / link-local addresses are forbidden)`
      };
    }

    // Check wildcard or unbound addresses
    if (hostname === '0.0.0.0' || hostname === '::' || hostname === '0') {
      return {
        valid: false,
        reason: `Invalid target host '${hostname}' (wildcard binding addresses not allowed for outbound client connections)`
      };
    }

    // Build allowed set
    const effectiveAllowlist = new Set<string>([...DEFAULT_LOOPBACK_HOSTS]);
    for (const entry of customAllowlist) {
      if (entry && typeof entry === 'string') {
        effectiveAllowlist.add(entry.trim().toLowerCase().replace(/^\[|\]$/g, ''));
      }
    }

    const isAllowed = effectiveAllowlist.has(hostname) || this.isPrivateIpAllowed(hostname, effectiveAllowlist);

    if (!isAllowed) {
      return {
        valid: false,
        reason: `Host '${hostname}' is not in the configured local model allowlist (${Array.from(effectiveAllowlist).join(', ')})`
      };
    }

    // Normalize URL without trailing slash
    const normalizedUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '');

    return {
      valid: true,
      normalizedUrl
    };
  }

  /**
   * Assert validation or throw LocalEndpointSecurityError
   */
  static assert(
    urlString: string,
    profile: RuntimeProfile = 'local',
    customAllowlist: string[] = []
  ): string {
    const result = this.validate(urlString, profile, customAllowlist);
    if (!result.valid || !result.normalizedUrl) {
      throw new LocalEndpointSecurityError(result.reason || 'Local endpoint policy validation failed');
    }
    return result.normalizedUrl;
  }

  private static isPrivateIpAllowed(hostname: string, allowlist: Set<string>): boolean {
    if (allowlist.has(hostname)) return true;

    // Check standard private IPv4 ranges: 10.x.x.x, 172.16-31.x.x, 192.168.x.x only if allowlist includes 'private' or range
    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const octet1 = parseInt(ipv4Match[1], 10);
      const octet2 = parseInt(ipv4Match[2], 10);
      const isPrivate =
        octet1 === 10 ||
        (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
        (octet1 === 192 && octet2 === 168);

      if (isPrivate && (allowlist.has('private') || allowlist.has('lan') || allowlist.has('localnet'))) {
        return true;
      }
    }

    return false;
  }
}
