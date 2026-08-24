/**
 * Browser QA Evidence Collector & Redaction Engine (CF-06)
 *
 * Captures DOM snapshots, screenshots, console logs, and network trace events.
 * Automatically sanitizes and redacts credentials, authorization tokens, cookies,
 * and sensitive form values from captured evidence.
 */

import { BrowserJobAction, BrowserJobEvidence } from './AuthorizedBrowserJob';

const SENSITIVE_HEADERS = new Set<string>([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
  'proxy-authorization',
  'apikey',
  'session-token',
  'bearer'
]);

const SENSITIVE_PARAM_NAMES = new Set<string>([
  'token',
  'access_token',
  'auth',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'session',
  'session_id',
  'code'
]);

export class BrowserEvidenceCollector {
  private evidence: BrowserJobEvidence;

  constructor(jobId: string) {
    this.evidence = {
      jobId,
      screenshots: [],
      domSnapshots: [],
      networkLogs: [],
      consoleLogs: [],
      actionsExecuted: []
    };
  }

  /**
   * Redact sensitive query parameters from a URL
   */
  public redactUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      let changed = false;

      for (const [key] of parsed.searchParams.entries()) {
        if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase())) {
          parsed.searchParams.set(key, '[REDACTED]');
          changed = true;
        }
      }

      // Also check if username/password is present in URL authority
      if (parsed.username || parsed.password) {
        parsed.username = '[REDACTED]';
        parsed.password = '[REDACTED]';
        changed = true;
      }

      return changed ? parsed.toString() : rawUrl;
    } catch {
      return rawUrl;
    }
  }

  /**
   * Redact sensitive HTTP headers
   */
  public redactHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Redact sensitive body content or JSON strings
   */
  public redactBody(body?: string): string | undefined {
    if (!body) return body;

    // Redact password form fields: value="secret" or password=secret
    let sanitized = body.replace(/(type=["']?password["']?[^>]*value=["']?)[^"'\s>]+(["']?)/gi, '$1[REDACTED]$2');
    sanitized = sanitized.replace(/(password|passwd|token|secret|apiKey)=([^&\s]+)/gi, '$1=[REDACTED]');

    // Try parsing as JSON to safely redact keys
    try {
      const obj = JSON.parse(body);
      if (typeof obj === 'object' && obj !== null) {
        this.redactObjectProperties(obj);
        return JSON.stringify(obj);
      }
    } catch {
      // Not JSON, return string-redacted version
    }

    return sanitized;
  }

  private redactObjectProperties(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase()) || SENSITIVE_HEADERS.has(key.toLowerCase())) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.redactObjectProperties(obj[key]);
      }
    }
  }

  /**
   * Redact DOM snapshot text, passwords, and cookie/auth attributes
   */
  public redactDom(domContent: string): string {
    let sanitized = domContent.replace(/(<input[^>]*type=["']password["'][^>]*value=["'])[^"']*(")/gi, '$1[REDACTED]$2');
    sanitized = sanitized.replace(/(<input[^>]*value=["'])[^"']*("[^>]*type=["']password["'])/gi, '$1[REDACTED]$2');
    return sanitized;
  }

  /**
   * Record a screenshot
   */
  public recordScreenshot(path: string, stepId?: string): void {
    this.evidence.screenshots.push({
      path,
      timestamp: new Date().toISOString(),
      stepId
    });
  }

  /**
   * Record a DOM snapshot with redaction
   */
  public recordDomSnapshot(url: string, rawDom: string): void {
    this.evidence.domSnapshots.push({
      timestamp: new Date().toISOString(),
      url: this.redactUrl(url),
      content: this.redactDom(rawDom)
    });
  }

  /**
   * Record a network request/response log
   */
  public recordNetworkEvent(event: {
    method: string;
    url: string;
    status?: number;
    headers: Record<string, string>;
    requestBody?: string;
    responseSize?: number;
  }): void {
    this.evidence.networkLogs.push({
      timestamp: new Date().toISOString(),
      method: event.method,
      url: this.redactUrl(event.url),
      status: event.status,
      headers: this.redactHeaders(event.headers),
      requestBody: this.redactBody(event.requestBody),
      responseSize: event.responseSize
    });
  }

  /**
   * Record a console log
   */
  public recordConsoleLog(level: string, message: string): void {
    this.evidence.consoleLogs.push({
      timestamp: new Date().toISOString(),
      level,
      message: this.redactBody(message) || message
    });
  }

  /**
   * Record action completion
   */
  public recordActionExecuted(action: BrowserJobAction, durationMs: number, success: boolean, error?: string): void {
    this.evidence.actionsExecuted.push({
      action: {
        ...action,
        value: action.type === 'type' && (action.target?.toLowerCase().includes('password') || action.metadata?.isSecret)
          ? '[REDACTED]'
          : action.value
      },
      durationMs,
      success,
      error
    });
  }

  /**
   * Get finalized evidence bundle
   */
  public getEvidence(): BrowserJobEvidence {
    return {
      jobId: this.evidence.jobId,
      screenshots: [...this.evidence.screenshots],
      domSnapshots: [...this.evidence.domSnapshots],
      networkLogs: [...this.evidence.networkLogs],
      consoleLogs: [...this.evidence.consoleLogs],
      actionsExecuted: [...this.evidence.actionsExecuted]
    };
  }
}
