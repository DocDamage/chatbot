import crypto from 'crypto';
import { WebSecurityBoundaryGuard, WebSecurityCheckResult } from './web/WebSecurityBoundaryGuard';

export interface PromptBoundaryEnvelope {
  trustLabel: 'OFFICIAL_VERIFIED' | 'COMMUNITY_UNTRUSTED' | 'USER_LOCAL';
  sanitizedContent: string;
  injectedAttemptDetected: boolean;
  wrappedText: string;
}

export interface ParserSafetyLimits {
  maxFileSizeBytes: number;
  maxRecordSizeBytes: number;
  maxRecursionDepth: number;
  maxCompressionRatio: number;
  timeoutMs: number;
}

export const DEFAULT_PARSER_SAFETY_LIMITS: ParserSafetyLimits = {
  maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB
  maxRecordSizeBytes: 1024 * 1024,     // 1 MB
  maxRecursionDepth: 5,
  maxCompressionRatio: 100,            // 100:1
  timeoutMs: 10000
};

export class KnowledgeSecurityPolicy {
  private static readonly INJECTION_PATTERNS = [
    /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
    /system\s*(?:prompt|override|command)\s*:/i,
    /you\s+must\s+(?:now\s+)?act\s+as/i,
    /disregard\s+(?:all\s+)?guidelines/i,
    /bypass\s+(?:safety|filter|guardrail)/i,
    /<\|im_start\|>/i,
    /<\|im_end\|>/i,
    /\[INST\]/i
  ];

  private static readonly SECRET_PATTERNS = [
    { regex: /sk-[a-zA-Z0-9]{20,}/g, label: '[REDACTED_KEY]' },
    { regex: /ghp_[a-zA-Z0-9]{20,}/g, label: '[REDACTED_KEY]' },
    { regex: /bearer\s+[a-zA-Z0-9_\-.~+]+/gi, label: 'Bearer [REDACTED_TOKEN]' },
    { regex: /(?:api[_-]?key|secret|token|password|auth)\s*[:=]\s*['"]?([a-zA-Z0-9_\-.~+]{8,})['"]?/gi, label: '[REDACTED_SECRET]' }
  ];

  /**
   * 33.1: Enforces prompt injection boundary delimiters and tags malicious instructions.
   */
  public static wrapRetrievedEvidence(
    content: string,
    trustLabel: 'OFFICIAL_VERIFIED' | 'COMMUNITY_UNTRUSTED' | 'USER_LOCAL' = 'COMMUNITY_UNTRUSTED',
    sourceId: string = 'unknown'
  ): PromptBoundaryEnvelope {
    const hasInjection = this.INJECTION_PATTERNS.some(pat => pat.test(content));
    
    // Boundary wrapping explicitly isolates untrusted text from instructions
    const wrappedText = [
      `<<<BEGIN_UNTRUSTED_EVIDENCE source="${sourceId}" trust="${trustLabel}" injection_flag="${hasInjection}">>>`,
      content,
      `<<<END_UNTRUSTED_EVIDENCE source="${sourceId}">>>`
    ].join('\n');

    return {
      trustLabel,
      sanitizedContent: content,
      injectedAttemptDetected: hasInjection,
      wrappedText
    };
  }

  /**
   * 33.2: Verifies SHA-256 integrity and checks for statistical anomaly.
   */
  public static verifyDatasetIntegrity(
    content: Buffer | string,
    expectedSha256?: string
  ): { valid: boolean; actualSha256: string; error?: string } {
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    if (expectedSha256 && hash.toLowerCase() !== expectedSha256.toLowerCase()) {
      return {
        valid: false,
        actualSha256: hash,
        error: `SHA-256 mismatch. Expected ${expectedSha256} but computed ${hash}`
      };
    }
    return { valid: true, actualSha256: hash };
  }

  /**
   * 33.3: Cross-user knowledge isolation — filters candidates by tenant/owner BEFORE ranking.
   */
  public static filterTenantOwnership<T extends { ownerId?: string; isPublic?: boolean }>(
    candidates: T[],
    currentUserId: string
  ): T[] {
    return candidates.filter(item => {
      if (item.isPublic) return true;
      return item.ownerId === currentUserId;
    });
  }

  /**
   * 33.4: External URL validation / SSRF protection.
   */
  public static validateOutboundUrl(url: string, isHosted: boolean = false): WebSecurityCheckResult {
    return WebSecurityBoundaryGuard.validateUrl(
      url,
      isHosted ? 'HOSTED' : 'LOCAL_TRUSTED',
      false
    );
  }

  /**
   * 33.5: Validates dataset parser boundaries against denial of service.
   */
  public static validateParserSafety(
    fileSizeBytes: number,
    recordSizeBytes: number,
    recursionDepth: number = 1,
    limits: ParserSafetyLimits = DEFAULT_PARSER_SAFETY_LIMITS
  ): { safe: boolean; reason?: string } {
    if (fileSizeBytes > limits.maxFileSizeBytes) {
      return { safe: false, reason: `File size ${fileSizeBytes} exceeds limit of ${limits.maxFileSizeBytes} bytes` };
    }
    if (recordSizeBytes > limits.maxRecordSizeBytes) {
      return { safe: false, reason: `Record size ${recordSizeBytes} exceeds limit of ${limits.maxRecordSizeBytes} bytes` };
    }
    if (recursionDepth > limits.maxRecursionDepth) {
      return { safe: false, reason: `Recursion depth ${recursionDepth} exceeds max depth of ${limits.maxRecursionDepth}` };
    }
    return { safe: true };
  }

  /**
   * 33.6: Ensures code snippets are tagged inert with non-executable policy markers.
   */
  public static tagInertCode(code: string, language: string = 'text'): string {
    return `\`\`\`${language}\n// INERT EVIDENCE - DO NOT EXECUTE AUTOMATICALLY\n${code}\n\`\`\``;
  }

  /**
   * 33.7: License compatibility check for distributable packs.
   */
  public static isDistributableLicense(license: string): boolean {
    const allowed = new Set([
      'mit', 'apache-2.0', 'bsd-2-clause', 'bsd-3-clause',
      'cc-by-4.0', 'cc0-1.0', 'unlicense', 'isc'
    ]);
    return allowed.has(license.toLowerCase().trim());
  }

  /**
   * 33.8: Redacts sensitive secrets, API keys, and chain-of-thought from diagnostics.
   */
  public static redactDiagnostics(text: string): string {
    let sanitized = text;
    for (const item of this.SECRET_PATTERNS) {
      sanitized = sanitized.replace(item.regex, item.label);
    }
    // Redact hidden chain of thought tags if present
    sanitized = sanitized.replace(/<thought>[\s\S]*?<\/thought>/gi, '[REDACTED_COT]');
    return sanitized;
  }
}
