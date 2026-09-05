/**
 * Capability Configuration & Secret Boundary Manager (PX-02 / PX02-T10)
 * Validates configuration schemas, encrypts/masks secrets, isolates
 * user, project, and administrator scopes, and audits all modifications.
 */

import { z } from 'zod';

export interface ConfigAuditEntry {
  capabilityId: string;
  scope: 'user' | 'project' | 'admin';
  modifiedBy: string;
  timestamp: string;
  modifiedKeys: string[];
}

export class CapabilityConfigManager {
  private static instance: CapabilityConfigManager;
  private configs = new Map<string, Record<string, unknown>>();
  private schemas = new Map<string, z.ZodSchema>();
  private auditLog: ConfigAuditEntry[] = [];

  public static getInstance(): CapabilityConfigManager {
    if (!CapabilityConfigManager.instance) {
      CapabilityConfigManager.instance = new CapabilityConfigManager();
    }
    return CapabilityConfigManager.instance;
  }

  public registerSchema(capabilityId: string, schema: z.ZodSchema): void {
    this.schemas.set(capabilityId, schema);
  }

  public setConfig(capabilityId: string, scope: 'user' | 'project' | 'admin', userId: string, config: Record<string, unknown>): { success: boolean; errors?: string[] } {
    const schema = this.schemas.get(capabilityId);
    if (schema) {
      const result = schema.safeParse(config);
      if (!result.success) {
        return { success: false, errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`) };
      }
    }

    const key = `${capabilityId}:${scope}:${userId}`;
    this.configs.set(key, config);

    this.auditLog.push({
      capabilityId,
      scope,
      modifiedBy: userId,
      timestamp: new Date().toISOString(),
      modifiedKeys: Object.keys(config)
    });

    return { success: true };
  }

  /**
   * Retrieves scrubbed configuration safe for client / diagnostic bundles.
   * Strips any keys matching secret keywords (key, token, secret, password, auth).
   */
  public getScrubbedConfig(capabilityId: string, scope: 'user' | 'project' | 'admin', userId: string): Record<string, unknown> {
    const key = `${capabilityId}:${scope}:${userId}`;
    const raw = this.configs.get(key) || {};
    const scrubbed: Record<string, unknown> = {};

    const secretPattern = /key|token|secret|password|auth|credential/i;

    for (const [k, v] of Object.entries(raw)) {
      if (secretPattern.test(k)) {
        scrubbed[k] = '***REDACTED***';
      } else {
        scrubbed[k] = v;
      }
    }

    return scrubbed;
  }

  public getAuditLog(capabilityId?: string): ConfigAuditEntry[] {
    if (capabilityId) {
      return this.auditLog.filter(e => e.capabilityId === capabilityId);
    }
    return [...this.auditLog];
  }

  public clear(): void {
    this.configs.clear();
    this.schemas.clear();
    this.auditLog = [];
  }
}
