/**
 * Pydoll CDP Adapter Contract (CF-06)
 *
 * Local-only, disabled-by-default adapter for transparent Chrome DevTools Protocol automation.
 * Strictly excludes stealth, fingerprint spoofing, proxy evasion, and CAPTCHA bypass capabilities.
 */

import { BrowserSecurityError, StealthFeatureDisallowedError } from './AuthorizedBrowserJob';

export interface PydollAdapterConfig {
  enabled: boolean;
  environment: 'LOCAL_TRUSTED' | 'HOSTED';
  cdpHost: string;
  cdpPort: number;
  connectionTimeoutMs: number;
  options?: Record<string, any>;
}

export const DEFAULT_PYDOLL_CONFIG: PydollAdapterConfig = {
  enabled: false, // Disabled by default
  environment: 'LOCAL_TRUSTED',
  cdpHost: '127.0.0.1',
  cdpPort: 9222,
  connectionTimeoutMs: 10000
};

export class PydollAdapter {
  private config: PydollAdapterConfig;
  private connected = false;

  constructor(config?: Partial<PydollAdapterConfig>) {
    this.config = {
      ...DEFAULT_PYDOLL_CONFIG,
      ...config
    };
  }

  /**
   * Validate configuration and security boundaries
   */
  public validate(): void {
    // 1. Must not be used in hosted mode
    if (this.config.environment === 'HOSTED') {
      throw new BrowserSecurityError('PydollAdapter is strictly LOCAL_ONLY and prohibited in HOSTED environments.');
    }

    // 2. Must be explicitly enabled
    if (!this.config.enabled) {
      throw new BrowserSecurityError('PydollAdapter is disabled by default. Enable explicitly in LOCAL_TRUSTED mode configuration.');
    }

    // 3. Must be loopback / private CDP endpoint
    const host = this.config.cdpHost.toLowerCase();
    const isLoopback = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (!isLoopback) {
      throw new BrowserSecurityError(`PydollAdapter CDP host must be a local loopback interface (got '${host}').`);
    }

    // 4. Verify no stealth/evasion options in custom options
    if (this.config.options) {
      const disallowed = ['stealth', 'fingerprint', 'rotateProxy', 'bypassCaptcha', 'evasion'];
      for (const d of disallowed) {
        if (this.config.options[d]) {
          throw new StealthFeatureDisallowedError(d);
        }
      }
    }
  }

  /**
   * Connect to transparent CDP instance
   */
  public async connect(): Promise<boolean> {
    this.validate();
    // Transparent connection mock / implementation
    this.connected = true;
    return true;
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close connection
   */
  public async disconnect(): Promise<void> {
    this.connected = false;
  }

  /**
   * Get metadata
   */
  public getDescriptor(): {
    id: string;
    displayName: string;
    enabled: boolean;
    localOnly: boolean;
    stealthExcluded: boolean;
  } {
    return {
      id: 'pydoll_cdp_adapter',
      displayName: 'Pydoll CDP Adapter (Transparent)',
      enabled: this.config.enabled,
      localOnly: true,
      stealthExcluded: true
    };
  }
}
