/**
 * Alerting System - Proactive alerts
 * Research: MIT Systems Group, Observability Best Practices
 */

import { logger } from '../core/observability/logger';

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: Alert['severity'];
  message: string;
}

export class AlertingSystem {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];

  /**
   * Register alert rule
   */
  registerRule(rule: AlertRule): void {
    this.rules.push(rule);
    logger.info('Alert rule registered', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Check metrics and trigger alerts
   */
  check(metrics: any): Alert[] {
    const triggered: Alert[] = [];

    for (const rule of this.rules) {
      try {
        if (rule.condition(metrics)) {
          const alert = this.createAlert(rule, metrics);
          this.alerts.push(alert);
          triggered.push(alert);
          logger.warn('Alert triggered', { alertId: alert.id, name: alert.name, severity: alert.severity });
        }
      } catch (error: any) {
        logger.error('Alert rule evaluation failed', { ruleId: rule.id, error: error.message });
      }
    }

    return triggered;
  }

  /**
   * Create alert from rule
   */
  private createAlert(rule: AlertRule, metrics: any): Alert {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: rule.name,
      severity: rule.severity,
      message: rule.message,
      timestamp: new Date(),
      resolved: false,
      metadata: { metrics }
    };
  }

  /**
   * Resolve alert
   */
  resolve(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info('Alert resolved', { alertId, name: alert.name });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: Alert['severity']): Alert[] {
    return this.alerts.filter(a => a.severity === severity && !a.resolved);
  }
}

