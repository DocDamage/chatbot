/**
 * Alert Notification Dispatcher (CF-10)
 *
 * Dispatches structured webhook alerts to external endpoints (Slack, PagerDuty, Webhooks)
 * when capability error budgets are depleted, SLOs are breached, or automated rollbacks occur.
 */

import { logger } from '../../observability/logger';

export interface AlertPayload {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  capabilityId: string;
  title: string;
  message: string;
  owner: string;
  metadata?: Record<string, any>;
}

export class AlertNotificationDispatcher {
  private static instance: AlertNotificationDispatcher;
  private webhookUrls: string[] = [];
  private alertHistory: AlertPayload[] = [];

  private constructor() {
    const defaultWebhook = process.env.CAPABILITY_ALERT_WEBHOOK_URL;
    if (defaultWebhook) {
      this.webhookUrls.push(defaultWebhook);
    }
  }

  public static getInstance(): AlertNotificationDispatcher {
    if (!AlertNotificationDispatcher.instance) {
      AlertNotificationDispatcher.instance = new AlertNotificationDispatcher();
    }
    return AlertNotificationDispatcher.instance;
  }

  public registerWebhookUrl(url: string): void {
    if (!this.webhookUrls.includes(url)) {
      this.webhookUrls.push(url);
    }
  }

  /**
   * Dispatch an alert payload to all registered webhook endpoints
   */
  public async dispatchAlert(alert: AlertPayload): Promise<{ deliveredCount: number; errors: string[] }> {
    this.alertHistory.push(alert);
    logger.warn(`[CAPABILITY ALERT ${alert.severity.toUpperCase()}]: ${alert.title} - ${alert.message}`, {
      capabilityId: alert.capabilityId,
      owner: alert.owner
    });

    let deliveredCount = 0;
    const errors: string[] = [];

    for (const url of this.webhookUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(alert)
        });
        if (response.ok) {
          deliveredCount++;
        } else {
          errors.push(`HTTP ${response.status} from webhook ${url}`);
        }
      } catch (err: any) {
        errors.push(`Webhook dispatch error for ${url}: ${err.message}`);
      }
    }

    return { deliveredCount, errors };
  }

  public getAlertHistory(limit = 100): AlertPayload[] {
    return this.alertHistory.slice(-limit);
  }
}
