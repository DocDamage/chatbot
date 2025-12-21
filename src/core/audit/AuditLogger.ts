/**
 * Audit Logger - Comprehensive audit logging for security and compliance
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';

export type AuditEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.create'
  | 'user.update'
  | 'user.delete'
  | 'api_key.create'
  | 'api_key.revoke'
  | 'conversation.create'
  | 'conversation.delete'
  | 'document.add'
  | 'document.delete'
  | 'admin.action'
  | 'security.violation'
  | 'rate_limit.exceeded'
  | 'error.occurred';

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  success: boolean;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export class AuditLogger {
  private events: AuditEvent[] = [];
  private maxEvents: number = 10000;
  private db?: Database;

  constructor(db?: Database) {
    this.db = db;
  }

  /**
   * Log an audit event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: AuditEvent = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...event,
      timestamp: new Date(),
    };

    this.events.push(fullEvent);

    // Maintain max events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // Persist to database
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO audit_logs
           (id, type, user_id, session_id, ip_address, user_agent, action, resource, resource_id, success, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fullEvent.id,
            fullEvent.type,
            fullEvent.userId || null,
            fullEvent.sessionId || null,
            fullEvent.ipAddress || null,
            fullEvent.userAgent || null,
            fullEvent.action,
            fullEvent.resource || null,
            fullEvent.resourceId || null,
            fullEvent.success ? 1 : 0,
            JSON.stringify(fullEvent.metadata || {}),
            fullEvent.timestamp.toISOString(),
          ]
        );
      } catch (error: any) {
        logger.warn('Failed to persist audit log', { error: error.message });
      }
    }

    // Log to application logger
    const level = fullEvent.success ? 'info' : 'warn';
    logger.log(level, 'Audit event', {
      type: fullEvent.type,
      action: fullEvent.action,
      userId: fullEvent.userId,
      success: fullEvent.success,
    });
  }

  /**
   * Query audit logs
   */
  async query(filters: {
    type?: AuditEventType;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    success?: boolean;
    limit?: number;
  }): Promise<AuditEvent[]> {
    let results = Array.from(this.events);

    // Apply filters
    if (filters.type) {
      results = results.filter(e => e.type === filters.type);
    }
    if (filters.userId) {
      results = results.filter(e => e.userId === filters.userId);
    }
    if (filters.startDate) {
      results = results.filter(e => e.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      results = results.filter(e => e.timestamp <= filters.endDate!);
    }
    if (filters.success !== undefined) {
      results = results.filter(e => e.success === filters.success);
    }

    // Sort and limit
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return results.slice(0, filters.limit || 100);
  }

  /**
   * Get audit statistics
   */
  getStats(timeRange: { start: Date; end: Date }): {
    totalEvents: number;
    eventsByType: Map<AuditEventType, number>;
    successRate: number;
    uniqueUsers: number;
  } {
    const relevant = this.events.filter(
      e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );

    const eventsByType = new Map<AuditEventType, number>();
    let successCount = 0;
    const uniqueUsers = new Set<string>();

    for (const event of relevant) {
      eventsByType.set(event.type, (eventsByType.get(event.type) || 0) + 1);
      if (event.success) successCount++;
      if (event.userId) uniqueUsers.add(event.userId);
    }

    return {
      totalEvents: relevant.length,
      eventsByType,
      successRate: relevant.length > 0 ? (successCount / relevant.length) * 100 : 0,
      uniqueUsers: uniqueUsers.size,
    };
  }
}

