import { URL } from 'url';

export interface WebSecurityCheckResult {
  isAllowed: boolean;
  sanitizedUrl?: string;
  rejectionReason?: string;
}

export class WebSecurityBoundaryGuard {
  private static readonly BLOCKED_HOSTS_AND_IPS = [
    '169.254.169.254', // AWS/GCP/Azure link-local metadata
    'metadata.google.internal',
    '100.100.100.200', // Alibaba metadata
    'instance-data'
  ];

  private static readonly PRIVATE_IP_RANGES = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^::1$/,
    /^fc00:/
  ];

  public static validateUrl(
    targetUrl: string,
    deploymentProfile: 'HOSTED' | 'LOCAL_TRUSTED' = 'LOCAL_TRUSTED',
    allowPrivateNetwork: boolean = false
  ): WebSecurityCheckResult {
    let parsed: URL;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return {
        isAllowed: false,
        rejectionReason: `Invalid URL format: ${targetUrl}`
      };
    }

    // Protocol check
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isAllowed: false,
        rejectionReason: `Protocol ${parsed.protocol} is disallowed. Only http/https supported.`
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 1. Cloud metadata SSRF blocking (all profiles)
    if (this.BLOCKED_HOSTS_AND_IPS.includes(hostname)) {
      return {
        isAllowed: false,
        rejectionReason: `Access to cloud metadata endpoint ${hostname} is strictly blocked.`
      };
    }

    // 2. Hosted profile private network SSRF blocking
    if (deploymentProfile === 'HOSTED' && !allowPrivateNetwork) {
      if (hostname === 'localhost' || this.PRIVATE_IP_RANGES.some(r => r.test(hostname))) {
        return {
          isAllowed: false,
          rejectionReason: `Hosted profile blocks access to internal or loopback IP addresses: ${hostname}`
        };
      }
    }

    return {
      isAllowed: true,
      sanitizedUrl: parsed.toString()
    };
  }

  public static sanitizeHtmlForImport(rawHtml: string): string {
    return rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/\bon[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');
  }
}
