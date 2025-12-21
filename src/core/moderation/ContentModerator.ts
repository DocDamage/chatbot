/**
 * Content Moderator - Enhanced content moderation with custom rules
 */

import { logger } from '../observability/logger';

export interface ModerationRule {
  id: string;
  name: string;
  pattern: string | RegExp;
  action: 'block' | 'warn' | 'flag';
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

export interface ModerationResult {
  allowed: boolean;
  blocked: boolean;
  warnings: string[];
  flags: string[];
  matchedRules: string[];
  severity: 'low' | 'medium' | 'high' | 'critical' | null;
}

export class ContentModerator {
  private rules: Map<string, ModerationRule> = new Map();
  private defaultRules: ModerationRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default moderation rules
   */
  private initializeDefaultRules(): void {
    const defaults: Omit<ModerationRule, 'id'>[] = [
      {
        name: 'Profanity Filter',
        pattern: /\b(shit|fuck|damn|hell)\b/gi,
        action: 'warn',
        severity: 'medium',
        enabled: true,
      },
      {
        name: 'Spam Detection',
        pattern: /(.)\1{10,}/, // Repeated characters
        action: 'flag',
        severity: 'low',
        enabled: true,
      },
      {
        name: 'URL Detection',
        pattern: /https?:\/\/[^\s]+/g,
        action: 'flag',
        severity: 'low',
        enabled: true,
      },
    ];

    for (const rule of defaults) {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.defaultRules.push({ id, ...rule });
      this.rules.set(id, { id, ...rule });
    }
  }

  /**
   * Add custom moderation rule
   */
  addRule(rule: Omit<ModerationRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: ModerationRule = { id, ...rule };
    this.rules.set(id, fullRule);
    logger.info('Moderation rule added', { id, name: rule.name });
    return id;
  }

  /**
   * Remove moderation rule
   */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      logger.info('Moderation rule removed', { ruleId });
    }
    return deleted;
  }

  /**
   * Moderate content
   */
  moderate(content: string): ModerationResult {
    const result: ModerationResult = {
      allowed: true,
      blocked: false,
      warnings: [],
      flags: [],
      matchedRules: [],
      severity: null,
    };

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const pattern = typeof rule.pattern === 'string'
        ? new RegExp(rule.pattern, 'gi')
        : rule.pattern;

      if (pattern.test(content)) {
        result.matchedRules.push(rule.id);

        // Update severity
        if (!result.severity || this.compareSeverity(rule.severity, result.severity) > 0) {
          result.severity = rule.severity;
        }

        // Apply action
        switch (rule.action) {
          case 'block':
            result.blocked = true;
            result.allowed = false;
            break;
          case 'warn':
            result.warnings.push(rule.name);
            break;
          case 'flag':
            result.flags.push(rule.name);
            break;
        }
      }
    }

    if (result.blocked) {
      logger.warn('Content blocked by moderation', {
        matchedRules: result.matchedRules,
        severity: result.severity,
      });
    }

    return result;
  }

  /**
   * Compare severity levels
   */
  private compareSeverity(
    a: 'low' | 'medium' | 'high' | 'critical',
    b: 'low' | 'medium' | 'high' | 'critical'
  ): number {
    const levels = { low: 1, medium: 2, high: 3, critical: 4 };
    return levels[a] - levels[b];
  }

  /**
   * Get all rules
   */
  getRules(): ModerationRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Enable/disable rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;
    logger.info('Rule enabled/disabled', { ruleId, enabled });
    return true;
  }
}

