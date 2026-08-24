/**
 * Authorized Browser Job Contract & Security Gates (CF-06)
 *
 * Implements bounded, transparent browser automation and QA execution.
 * Enforces origin allowlists, state-changing action approval verification,
 * resource budgets, and strict exclusion of stealth/evasion mechanisms.
 */

import * as crypto from 'crypto';

export type BrowserJobStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type BrowserActionType =
  | 'navigate'
  | 'click'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'screenshot'
  | 'extract_dom'
  | 'extract_text'
  | 'submit_form'
  | 'upload_file'
  | 'account_mutation'
  | 'custom_eval';

export interface BrowserJobBudget {
  maxDurationMs: number;
  maxActions: number;
  maxRedirects: number;
  maxResponseSizeBytes: number;
  maxDownloadBytes: number;
}

export const DEFAULT_BROWSER_JOB_BUDGET: BrowserJobBudget = {
  maxDurationMs: 60000,
  maxActions: 50,
  maxRedirects: 5,
  maxResponseSizeBytes: 10 * 1024 * 1024, // 10MB
  maxDownloadBytes: 25 * 1024 * 1024      // 25MB
};

export interface BrowserJobAction {
  id: string;
  type: BrowserActionType;
  target?: string; // URL, CSS selector, or xpath
  value?: string;  // Text input, direction, or evaluated script
  files?: string[]; // For upload_file
  timeoutMs?: number;
  isStateChanging?: boolean;
  metadata?: Record<string, any>;
}

export interface StateChangingApproval {
  actionId: string;
  approvedBy: string;
  approvalDigest: string;
  approvedAt: string;
}

export interface BrowserJobEvidence {
  jobId: string;
  screenshots: Array<{ path: string; timestamp: string; stepId?: string }>;
  domSnapshots: Array<{ timestamp: string; url: string; content: string }>;
  networkLogs: Array<{
    timestamp: string;
    method: string;
    url: string;
    status?: number;
    headers: Record<string, string>;
    requestBody?: string;
    responseSize?: number;
  }>;
  consoleLogs: Array<{ timestamp: string; level: string; message: string }>;
  actionsExecuted: Array<{
    action: BrowserJobAction;
    durationMs: number;
    success: boolean;
    error?: string;
  }>;
}

export interface AuthorizedBrowserJob {
  readonly jobId: string;
  readonly purpose: string;
  readonly requesterId: string;
  readonly originAllowlist: string[];
  readonly allowedSchemes: string[];
  readonly budget: BrowserJobBudget;
  readonly actions: BrowserJobAction[];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly jobDigest: string;

  status: BrowserJobStatus;
  currentActionIndex: number;
  approvals: Record<string, StateChangingApproval>;
  evidence?: BrowserJobEvidence;
  error?: string;
}

export interface CreateBrowserJobOptions {
  jobId?: string;
  purpose: string;
  requesterId: string;
  originAllowlist: string[];
  allowedSchemes?: string[];
  budget?: Partial<BrowserJobBudget>;
  actions?: BrowserJobAction[];
  ttlMs?: number;
  prohibitedFeatures?: Record<string, boolean>;
}

export class BrowserSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrowserSecurityError';
  }
}

export class StealthFeatureDisallowedError extends BrowserSecurityError {
  constructor(featureName: string) {
    super(`Disallowed stealth/evasion feature '${featureName}': stealth, CAPTCHA bypass, fingerprint spoofing, and proxy rotation are strictly prohibited.`);
    this.name = 'StealthFeatureDisallowedError';
  }
}

export class OriginNotAllowedError extends BrowserSecurityError {
  constructor(url: string, originAllowlist: string[]) {
    super(`Target URL '${url}' does not match any allowed origin in [${originAllowlist.join(', ')}]. Access failed closed.`);
    this.name = 'OriginNotAllowedError';
  }
}

export class StateChangingApprovalRequiredError extends BrowserSecurityError {
  constructor(actionId: string, actionType: string) {
    super(`Action '${actionId}' of type '${actionType}' is state-changing and requires a verified cryptographic approval digest before execution.`);
    this.name = 'StateChangingApprovalRequiredError';
  }
}

const STATE_CHANGING_ACTION_TYPES = new Set<BrowserActionType>([
  'submit_form',
  'upload_file',
  'account_mutation',
  // Arbitrary page JavaScript can submit forms or mutate accounts and must
  // never bypass the same approval boundary as explicit mutation actions.
  'custom_eval'
]);

/**
 * Determine if an action is inherently state-changing or explicitly marked as such
 */
export function isStateChangingAction(action: BrowserJobAction): boolean {
  if (action.isStateChanging === true) {
    return true;
  }
  return STATE_CHANGING_ACTION_TYPES.has(action.type);
}

/**
 * Validates that no stealth, evasion, or anti-detection capabilities are requested
 */
export function validateNoStealthOrEvasion(options: Record<string, any>): void {
  const disallowedKeys = [
    'stealth',
    'bypassCaptcha',
    'captchaBypass',
    'spoofFingerprint',
    'fingerprintSpoofing',
    'rotateProxy',
    'evasionMode',
    'antiDetection',
    'bypassCloudflare',
    'bypassWaf'
  ];

  for (const key of disallowedKeys) {
    if (options[key] === true || (typeof options[key] === 'object' && options[key] !== null)) {
      throw new StealthFeatureDisallowedError(key);
    }
  }

  // Check nested metadata in actions
  if (Array.isArray(options.actions)) {
    for (const action of options.actions) {
      if (action.metadata) {
        for (const key of disallowedKeys) {
          if (action.metadata[key] === true) {
            throw new StealthFeatureDisallowedError(key);
          }
        }
      }
    }
  }
}

/**
 * Origin allowlist checker
 * Matches full URLs against allowlist rules (exact host, port, protocol, or wildcard subdomains)
 */
export function isOriginAllowed(targetUrl: string, originAllowlist: string[], allowedSchemes: string[] = ['http:', 'https:']): boolean {
  try {
    const parsed = new URL(targetUrl);

    if (!allowedSchemes.includes(parsed.protocol)) {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    const port = parsed.port ? `:${parsed.port}` : '';
    const origin = `${parsed.protocol}//${host}${port}`;

    for (const pattern of originAllowlist) {
      const trimmed = pattern.trim().toLowerCase();

      // Wildcard origin (e.g. * or *://*)
      if (trimmed === '*' || trimmed === '*://*') {
        return true;
      }

      // Check scheme-specific wildcard e.g., https://*.example.com or http://localhost:*
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const ruleUrl = new URL(trimmed.replace(/\*/g, 'wildcard-placeholder'));
          if (parsed.protocol !== ruleUrl.protocol) {
            continue;
          }

          const ruleHostPattern = trimmed
            .split('://')[1]
            .split('/')[0];

          if (matchHostPattern(host + port, ruleHostPattern)) {
            return true;
          }
        } catch {
          // If not a standard URL, match as pattern
          if (matchHostPattern(origin, trimmed)) {
            return true;
          }
        }
      } else {
        // Plain domain pattern like example.com or *.example.com or localhost:3000
        if (matchHostPattern(host + port, trimmed) || matchHostPattern(host, trimmed)) {
          return true;
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}

function matchHostPattern(actual: string, pattern: string): boolean {
  if (pattern === '*' || pattern === actual) return true;
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2);
    return actual.endsWith('.' + suffix) || actual === suffix;
  }
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${escaped}$`, 'i');
    return regex.test(actual);
  }
  return actual === pattern;
}

/**
 * Deterministically compute the SHA-256 digest of an AuthorizedBrowserJob contract
 */
export function computeBrowserJobDigest(job: {
  jobId: string;
  purpose: string;
  requesterId: string;
  originAllowlist: string[];
  allowedSchemes: string[];
  budget: BrowserJobBudget;
  actions: BrowserJobAction[];
  createdAt: string;
  expiresAt: string;
}): string {
  const normalized = {
    jobId: job.jobId,
    purpose: job.purpose,
    requesterId: job.requesterId,
    originAllowlist: [...job.originAllowlist].sort(),
    allowedSchemes: [...job.allowedSchemes].sort(),
    budget: job.budget,
    actions: job.actions.map(a => ({
      id: a.id,
      type: a.type,
      target: a.target || '',
      value: a.value || '',
      files: a.files ? [...a.files].sort() : [],
      isStateChanging: isStateChangingAction(a)
    })),
    createdAt: job.createdAt,
    expiresAt: job.expiresAt
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

/**
 * Compute the SHA-256 approval digest for a state-changing action
 */
export function computeActionApprovalDigest(jobId: string, action: BrowserJobAction, approverId: string): string {
  const payload = {
    jobId,
    actionId: action.id,
    type: action.type,
    target: action.target || '',
    value: action.value || '',
    files: action.files || [],
    approverId
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Create a new AuthorizedBrowserJob with cryptographic digest and safety validation
 */
export function createAuthorizedBrowserJob(options: CreateBrowserJobOptions): AuthorizedBrowserJob {
  validateNoStealthOrEvasion(options);

  if (!options.originAllowlist || options.originAllowlist.length === 0) {
    throw new BrowserSecurityError('Origin allowlist cannot be empty. AuthorizedBrowserJob requires explicit origin containment.');
  }
  if (options.originAllowlist.some(pattern => ['*', '*://*'].includes(pattern.trim()))) {
    throw new BrowserSecurityError('Global wildcard origins are prohibited; enumerate the authorized origins explicitly.');
  }

  const jobId = options.jobId || `bjob-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const createdAt = new Date().toISOString();
  const ttlMs = options.ttlMs ?? 15 * 60 * 1000; // default 15 mins
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();

  const allowedSchemes = options.allowedSchemes || ['http:', 'https:'];
  if (allowedSchemes.some(scheme => scheme !== 'http:' && scheme !== 'https:')) {
    throw new BrowserSecurityError('Authorized browser jobs support only http: and https: URL schemes.');
  }
  const budget: BrowserJobBudget = {
    ...DEFAULT_BROWSER_JOB_BUDGET,
    ...options.budget
  };
  if (!Number.isFinite(budget.maxDurationMs) || budget.maxDurationMs <= 0 ||
      !Number.isInteger(budget.maxActions) || budget.maxActions <= 0 ||
      !Number.isInteger(budget.maxRedirects) || budget.maxRedirects < 0 ||
      !Number.isFinite(budget.maxResponseSizeBytes) || budget.maxResponseSizeBytes <= 0 ||
      !Number.isFinite(budget.maxDownloadBytes) || budget.maxDownloadBytes <= 0) {
    throw new BrowserSecurityError('Browser job budgets must use positive finite limits (maxRedirects may be zero).');
  }

  const actions = (options.actions || []).map((action, idx) => {
    const actionId = action.id || `action-${idx + 1}`;
    return {
      ...action,
      id: actionId,
      isStateChanging: isStateChangingAction(action)
    };
  });

  const jobDigest = computeBrowserJobDigest({
    jobId,
    purpose: options.purpose,
    requesterId: options.requesterId,
    originAllowlist: options.originAllowlist,
    allowedSchemes,
    budget,
    actions,
    createdAt,
    expiresAt
  });

  return {
    jobId,
    purpose: options.purpose,
    requesterId: options.requesterId,
    originAllowlist: [...options.originAllowlist],
    allowedSchemes: [...allowedSchemes],
    budget,
    actions,
    createdAt,
    expiresAt,
    jobDigest,
    status: 'queued',
    currentActionIndex: 0,
    approvals: {}
  };
}

/**
 * Verify cryptographic integrity of an AuthorizedBrowserJob
 */
export function verifyBrowserJobIntegrity(job: AuthorizedBrowserJob): boolean {
  const expected = computeBrowserJobDigest({
    jobId: job.jobId,
    purpose: job.purpose,
    requesterId: job.requesterId,
    originAllowlist: job.originAllowlist,
    allowedSchemes: job.allowedSchemes,
    budget: job.budget,
    actions: job.actions,
    createdAt: job.createdAt,
    expiresAt: job.expiresAt
  });

  return expected === job.jobDigest;
}
