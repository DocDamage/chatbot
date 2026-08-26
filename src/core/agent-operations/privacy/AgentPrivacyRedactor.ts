/**
 * Agent Privacy & Log Hardening Redactor (PX-06 / PX06-T09)
 * Redacts credentials, tokens, environment secrets, private home directory paths,
 * and sensitive clipboard/screen data from agent logs, communications, and evidence.
 */

export class AgentPrivacyRedactor {
  private static readonly SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /bearer/i,
    /private[_-]?key/i
  ];

  private static readonly SECRET_PATTERNS: RegExp[] = [
    // OpenAI / general API keys
    /sk-[a-zA-Z0-9]{20,}/g,
    // GitHub PAT
    /gh[pousr]-[a-zA-Z0-9]{36,}/g,
    // Slack tokens
    /xox[baprs]-[0-9a-zA-Z]{10,}/g,
    // AWS access key ID
    /AKIA[0-9A-Z]{16}/g,
    // Generic Bearer token
    /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
    // Key-value pattern: API_KEY="xyz" or token: "xyz"
    /(['"]?(?:api[_-]?key|password|secret|token|auth)['"]?\s*[:=]\s*['"])([^'"]+)(['"])/gi
  ];

  private static readonly USER_HOME_PATTERN = /([A-Za-z]:\\Users\\[^\\]+|(?:\/home|\/Users)\/[^\/]+)/g;

  /**
   * Redact sensitive string text
   */
  public static redactString(input: string, anonymizePaths = true): string {
    if (!input || typeof input !== 'string') return input;

    let output = input;

    // Redact recognized secret patterns
    for (const pattern of this.SECRET_PATTERNS) {
      if (pattern.toString().includes('Bearer')) {
        output = output.replace(pattern, 'Bearer [REDACTED_TOKEN]');
      } else if (pattern.toString().includes('api[_-]?key')) {
        output = output.replace(pattern, '$1[REDACTED_SECRET]$3');
      } else {
        output = output.replace(pattern, '[REDACTED_SECRET]');
      }
    }

    // Anonymize user home directory paths
    if (anonymizePaths) {
      output = output.replace(this.USER_HOME_PATTERN, '~');
    }

    return output;
  }

  /**
   * Recursively redact an object or array
   */
  public static redactObject<T>(input: T, anonymizePaths = true): T {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      return this.redactString(input, anonymizePaths) as unknown as T;
    }

    if (Array.isArray(input)) {
      return input.map(item => this.redactObject(item, anonymizePaths)) as unknown as T;
    }

    if (typeof input === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(input as Record<string, any>)) {
        if (this.isSensitiveKey(key)) {
          result[key] = '[REDACTED_SECRET]';
        } else {
          result[key] = this.redactObject(value, anonymizePaths);
        }
      }
      return result as T;
    }

    return input;
  }

  /**
   * Check if an object key name implies sensitive content
   */
  private static isSensitiveKey(key: string): boolean {
    return this.SENSITIVE_KEY_PATTERNS.some(p => p.test(key));
  }
}
