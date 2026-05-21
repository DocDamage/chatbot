/**
 * Webhook Service - Event notifications
 */

import axios from 'axios';
import { logger } from '../observability/logger';
import { retry } from '../../utils/retry';

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  createdAt: Date;
  lastTriggered?: Date;
  failureCount: number;
}

export interface WebhookEvent {
  type: string;
  payload: any;
  timestamp: Date;
}

export class WebhookService {
  private webhooks: Map<string, Webhook> = new Map();
  private eventQueue: WebhookEvent[] = [];

  /**
   * Register a webhook
   */
  register(webhook: Omit<Webhook, 'id' | 'createdAt' | 'failureCount'>): Webhook {
    const id = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newWebhook: Webhook = {
      id,
      ...webhook,
      createdAt: new Date(),
      failureCount: 0,
    };

    this.webhooks.set(id, newWebhook);
    logger.info('Webhook registered', { id, url: webhook.url, events: webhook.events });

    return newWebhook;
  }

  /**
   * Unregister a webhook
   */
  unregister(webhookId: string): boolean {
    const deleted = this.webhooks.delete(webhookId);
    if (deleted) {
      logger.info('Webhook unregistered', { webhookId });
    }
    return deleted;
  }

  /**
   * Trigger webhook for an event
   */
  async trigger(event: WebhookEvent): Promise<void> {
    const matchingWebhooks = Array.from(this.webhooks.values())
      .filter(wh => wh.active && wh.events.includes(event.type));

    if (matchingWebhooks.length === 0) {
      logger.debug('No webhooks registered for event', { type: event.type });
      return;
    }

    // Trigger all matching webhooks in parallel
    await Promise.all(
      matchingWebhooks.map(webhook => this.sendWebhook(webhook, event))
    );
  }

  /**
   * Send webhook with retry logic
   */
  private async sendWebhook(webhook: Webhook, event: WebhookEvent): Promise<void> {
    const payload: {
      event: string;
      data: any;
      timestamp: string;
      signature?: string;
    } = {
      event: event.type,
      data: event.payload,
      timestamp: event.timestamp.toISOString(),
    };

    // Sign payload if secret is provided
    if (webhook.secret) {
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(payload))
        .digest('hex');
      payload['signature'] = signature;
    }

    const result = await retry(
      async () => {
        const response = await axios.post(webhook.url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Chatbot-Webhook/1.0',
          },
          timeout: 10000,
        });

        if (response.status >= 200 && response.status < 300) {
          return { success: true };
        }

        throw new Error(`Webhook returned status ${response.status}`);
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1000,
        retryableErrors: (error: any) => {
          // Retry on network errors and 5xx responses
          return error.code === 'ECONNREFUSED' || 
                 error.code === 'ETIMEDOUT' ||
                 (error.response && error.response.status >= 500);
        },
      }
    );

    if (result.success) {
      webhook.lastTriggered = new Date();
      webhook.failureCount = 0;
      logger.info('Webhook triggered successfully', { 
        webhookId: webhook.id, 
        event: event.type 
      });
    } else {
      webhook.failureCount++;
      logger.error('Webhook trigger failed', { 
        webhookId: webhook.id, 
        event: event.type,
        error: result.error?.message,
        attempts: result.attempts,
      });

      // Deactivate webhook after too many failures
      if (webhook.failureCount >= 5) {
        webhook.active = false;
        logger.warn('Webhook deactivated due to failures', { webhookId: webhook.id });
      }
    }
  }

  /**
   * List all webhooks
   */
  list(): Webhook[] {
    return Array.from(this.webhooks.values());
  }

  /**
   * Get webhook by ID
   */
  get(webhookId: string): Webhook | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Update webhook
   */
  update(webhookId: string, updates: Partial<Webhook>): Webhook | null {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return null;

    const updated = { ...webhook, ...updates };
    this.webhooks.set(webhookId, updated);
    logger.info('Webhook updated', { webhookId });

    return updated;
  }
}

