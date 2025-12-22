/**
 * Approval Policy
 * Granular approval policies for AI actions
 */

import { logger } from '../observability/logger';

export type ApprovalLevel = 'untrusted' | 'on-failure' | 'on-request' | 'never';

export interface ApprovalRequest {
    id: string;
    action: string;
    description: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    context: Record<string, any>;
    requestedAt: Date;
    status: 'pending' | 'approved' | 'denied' | 'expired';
    respondedAt?: Date;
}

export interface ApprovalConfig {
    defaultLevel: ApprovalLevel;
    actionLevels: Record<string, ApprovalLevel>;
    autoApprovePatterns: string[];
    autoDenyPatterns: string[];
    requestTimeout: number; // ms
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

export class ApprovalPolicy {
    private config: ApprovalConfig;
    private pendingRequests: Map<string, ApprovalRequest> = new Map();
    private approvalHistory: ApprovalRequest[] = [];
    private handlers: ApprovalHandler[] = [];

    constructor(config?: Partial<ApprovalConfig>) {
        this.config = {
            defaultLevel: 'on-request',
            actionLevels: {},
            autoApprovePatterns: [],
            autoDenyPatterns: [],
            requestTimeout: 300000, // 5 minutes
            ...config
        };
    }

    /**
     * Set approval level for an action type
     */
    setApprovalLevel(action: string, level: ApprovalLevel): void {
        this.config.actionLevels[action] = level;
        logger.info('Approval level set', { action, level });
    }

    /**
     * Set default approval level
     */
    setDefaultLevel(level: ApprovalLevel): void {
        this.config.defaultLevel = level;
        logger.info('Default approval level set', { level });
    }

    /**
     * Register approval handler
     */
    registerHandler(handler: ApprovalHandler): void {
        this.handlers.push(handler);
    }

    /**
     * Check if action needs approval
     */
    needsApproval(action: string, context?: Record<string, any>): boolean {
        const level = this.getApprovalLevel(action);

        switch (level) {
            case 'never':
                return false;
            case 'untrusted':
                return true;
            case 'on-request':
                return true;
            case 'on-failure':
                return context?.failed === true;
            default:
                return true;
        }
    }

    /**
     * Request approval for an action
     */
    async requestApproval(
        action: string,
        description: string,
        context: Record<string, any> = {}
    ): Promise<boolean> {
        const level = this.getApprovalLevel(action);

        // Auto-approve for 'never' level
        if (level === 'never') {
            logger.debug('Auto-approved (never level)', { action });
            return true;
        }

        // Check auto-approve patterns
        if (this.matchesPatterns(action, this.config.autoApprovePatterns)) {
            logger.debug('Auto-approved (pattern match)', { action });
            return true;
        }

        // Check auto-deny patterns
        if (this.matchesPatterns(action, this.config.autoDenyPatterns)) {
            logger.debug('Auto-denied (pattern match)', { action });
            return false;
        }

        // Create approval request
        const request: ApprovalRequest = {
            id: this.generateId(),
            action,
            description,
            risk: this.assessRisk(action, context),
            context,
            requestedAt: new Date(),
            status: 'pending'
        };

        this.pendingRequests.set(request.id, request);

        logger.info('Approval requested', {
            id: request.id,
            action,
            risk: request.risk
        });

        // Process with handlers
        const approved = await this.processRequest(request);

        request.status = approved ? 'approved' : 'denied';
        request.respondedAt = new Date();

        this.pendingRequests.delete(request.id);
        this.approvalHistory.push(request);

        return approved;
    }

    /**
     * Approve a pending request by ID
     */
    approve(requestId: string): boolean {
        const request = this.pendingRequests.get(requestId);
        if (!request) return false;

        request.status = 'approved';
        request.respondedAt = new Date();

        logger.info('Request approved', { id: requestId });
        return true;
    }

    /**
     * Deny a pending request by ID
     */
    deny(requestId: string): boolean {
        const request = this.pendingRequests.get(requestId);
        if (!request) return false;

        request.status = 'denied';
        request.respondedAt = new Date();

        logger.info('Request denied', { id: requestId });
        return true;
    }

    /**
     * Get pending requests
     */
    getPendingRequests(): ApprovalRequest[] {
        return Array.from(this.pendingRequests.values());
    }

    /**
     * Get approval history
     */
    getHistory(limit?: number): ApprovalRequest[] {
        const history = [...this.approvalHistory].reverse();
        return limit ? history.slice(0, limit) : history;
    }

    /**
     * Get approval level for action
     */
    private getApprovalLevel(action: string): ApprovalLevel {
        // Check specific action level
        if (this.config.actionLevels[action]) {
            return this.config.actionLevels[action];
        }

        // Check prefix matches
        for (const [pattern, level] of Object.entries(this.config.actionLevels)) {
            if (pattern.endsWith('*') && action.startsWith(pattern.slice(0, -1))) {
                return level;
            }
        }

        return this.config.defaultLevel;
    }

    /**
     * Assess risk level of action
     */
    private assessRisk(action: string, context: Record<string, any>): ApprovalRequest['risk'] {
        const lowerAction = action.toLowerCase();

        // Critical actions
        const criticalPatterns = ['delete', 'drop', 'remove', 'destroy', 'format'];
        if (criticalPatterns.some(p => lowerAction.includes(p))) {
            return 'critical';
        }

        // High risk actions
        const highPatterns = ['write', 'modify', 'update', 'execute', 'install'];
        if (highPatterns.some(p => lowerAction.includes(p))) {
            return 'high';
        }

        // Medium risk actions
        const mediumPatterns = ['create', 'send', 'post', 'upload'];
        if (mediumPatterns.some(p => lowerAction.includes(p))) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Check if action matches patterns
     */
    private matchesPatterns(action: string, patterns: string[]): boolean {
        const lowerAction = action.toLowerCase();

        for (const pattern of patterns) {
            const lowerPattern = pattern.toLowerCase();

            if (lowerPattern.includes('*')) {
                const regex = new RegExp(
                    '^' + lowerPattern.replace(/\*/g, '.*') + '$'
                );
                if (regex.test(lowerAction)) return true;
            } else if (lowerAction === lowerPattern) {
                return true;
            }
        }

        return false;
    }

    /**
     * Process request with handlers
     */
    private async processRequest(request: ApprovalRequest): Promise<boolean> {
        // If no handlers, auto-deny for safety
        if (this.handlers.length === 0) {
            logger.warn('No approval handlers registered, auto-denying');
            return false;
        }

        // Try each handler
        for (const handler of this.handlers) {
            try {
                const approved = await Promise.race([
                    handler(request),
                    this.timeout(this.config.requestTimeout)
                ]);

                if (typeof approved === 'boolean') {
                    return approved;
                }
            } catch (error) {
                logger.warn('Approval handler failed', { error });
            }
        }

        return false;
    }

    /**
     * Timeout promise
     */
    private timeout(ms: number): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Approval timeout')), ms);
        });
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `apr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    getStats(): {
        pending: number;
        approved: number;
        denied: number;
        avgResponseTime: number;
    } {
        const completed = this.approvalHistory.filter(r => r.respondedAt);
        const approved = completed.filter(r => r.status === 'approved').length;
        const denied = completed.filter(r => r.status === 'denied').length;

        const responseTimes = completed
            .filter(r => r.respondedAt)
            .map(r => r.respondedAt!.getTime() - r.requestedAt.getTime());

        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0;

        return {
            pending: this.pendingRequests.size,
            approved,
            denied,
            avgResponseTime
        };
    }
}

// Default instance
export const approvalPolicy = new ApprovalPolicy();
