/**
 * Thinking UI
 * Visible chain-of-thought reasoning display
 */

import { logger } from '../observability/logger';

export interface ThinkingStep {
    id: string;
    content: string;
    type: 'observation' | 'reasoning' | 'decision' | 'action';
    timestamp: Date;
    duration?: number;
}

export interface ThinkingSession {
    id: string;
    query: string;
    steps: ThinkingStep[];
    finalAnswer?: string;
    startedAt: Date;
    completedAt?: Date;
    visible: boolean;
}

export interface ThinkingUIConfig {
    enabled: boolean;
    maxSteps: number;
    streamDelay: number; // ms between steps for visual effect
    autoCollapse: boolean;
    collapseDelay: number;
}

export type ThinkingCallback = (step: ThinkingStep) => void;

export class ThinkingUI {
    private config: ThinkingUIConfig;
    private sessions: Map<string, ThinkingSession> = new Map();
    private callbacks: ThinkingCallback[] = [];
    private currentSession: ThinkingSession | null = null;

    constructor(config?: Partial<ThinkingUIConfig>) {
        this.config = {
            enabled: true,
            maxSteps: 50,
            streamDelay: 100,
            autoCollapse: true,
            collapseDelay: 5000,
            ...config
        };
    }

    /**
     * Register callback for thinking updates
     */
    onThinking(callback: ThinkingCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Remove callback
     */
    offThinking(callback: ThinkingCallback): void {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    }

    /**
     * Start a new thinking session
     */
    startSession(query: string): string {
        const sessionId = this.generateId();

        const session: ThinkingSession = {
            id: sessionId,
            query,
            steps: [],
            startedAt: new Date(),
            visible: true
        };

        this.sessions.set(sessionId, session);
        this.currentSession = session;

        logger.debug('Thinking session started', { sessionId });
        return sessionId;
    }

    /**
     * Add a thinking step
     */
    addStep(
        content: string,
        type: ThinkingStep['type'] = 'reasoning',
        sessionId?: string
    ): ThinkingStep {
        const session = sessionId
            ? this.sessions.get(sessionId)
            : this.currentSession;

        if (!session) {
            throw new Error('No active thinking session');
        }

        const step: ThinkingStep = {
            id: `step_${session.steps.length + 1}`,
            content,
            type,
            timestamp: new Date()
        };

        // Calculate duration from previous step
        if (session.steps.length > 0) {
            const prevStep = session.steps[session.steps.length - 1];
            prevStep.duration = step.timestamp.getTime() - prevStep.timestamp.getTime();
        }

        session.steps.push(step);

        // Enforce max steps
        if (session.steps.length > this.config.maxSteps) {
            session.steps = session.steps.slice(-this.config.maxSteps);
        }

        // Notify callbacks
        this.notifyCallbacks(step);

        return step;
    }

    /**
     * Complete a thinking session
     */
    completeSession(answer: string, sessionId?: string): void {
        const session = sessionId
            ? this.sessions.get(sessionId)
            : this.currentSession;

        if (!session) return;

        session.finalAnswer = answer;
        session.completedAt = new Date();

        // Auto collapse after delay
        if (this.config.autoCollapse) {
            setTimeout(() => {
                session.visible = false;
            }, this.config.collapseDelay);
        }

        if (this.currentSession?.id === session.id) {
            this.currentSession = null;
        }

        logger.debug('Thinking session completed', {
            sessionId: session.id,
            steps: session.steps.length
        });
    }

    /**
     * Parse thinking from model response
     * Supports various thinking formats
     */
    parseThinking(response: string): { thinking: string; answer: string } {
        // Try <thinking> tags first
        const thinkingTagMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
        const answerTagMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);

        if (thinkingTagMatch) {
            return {
                thinking: thinkingTagMatch[1].trim(),
                answer: answerTagMatch?.[1].trim() ||
                    response.replace(thinkingTagMatch[0], '').replace(/<\/?answer>/g, '').trim()
            };
        }

        // Try DeepSeek-R1 format with [思考] or [Thinking]
        const deepseekMatch = response.match(/\[(?:思考|Thinking)\]([\s\S]*?)\[(?:回答|Answer)\]([\s\S]*)/);
        if (deepseekMatch) {
            return {
                thinking: deepseekMatch[1].trim(),
                answer: deepseekMatch[2].trim()
            };
        }

        // Try Claude's extended thinking format
        const claudeMatch = response.match(/^(.*?)\n\n---\n\n([\s\S]*)$/);
        if (claudeMatch && claudeMatch[1].length > 100) {
            return {
                thinking: claudeMatch[1].trim(),
                answer: claudeMatch[2].trim()
            };
        }

        // No thinking detected
        return {
            thinking: '',
            answer: response
        };
    }

    /**
     * Extract steps from thinking text
     */
    extractSteps(thinking: string): ThinkingStep[] {
        const steps: ThinkingStep[] = [];

        // Try numbered steps
        const numberedPattern = /(?:^|\n)\s*(?:\d+[\.\):]|\-|\*)\s*(.+?)(?=\n\s*(?:\d+[\.\):]|\-|\*)|$)/gs;
        let match;
        let index = 0;

        while ((match = numberedPattern.exec(thinking)) !== null) {
            const content = match[1].trim();
            if (content.length > 5) {
                steps.push({
                    id: `step_${++index}`,
                    content,
                    type: this.classifyStepType(content),
                    timestamp: new Date()
                });
            }
        }

        // If no numbered steps, split by sentences
        if (steps.length === 0) {
            const sentences = thinking.split(/[.!?]+\s+/);
            for (const sentence of sentences) {
                if (sentence.length > 10) {
                    steps.push({
                        id: `step_${steps.length + 1}`,
                        content: sentence.trim(),
                        type: this.classifyStepType(sentence),
                        timestamp: new Date()
                    });
                }
            }
        }

        return steps;
    }

    /**
     * Classify step type based on content
     */
    private classifyStepType(content: string): ThinkingStep['type'] {
        const lower = content.toLowerCase();

        // Observation indicators
        if (lower.includes('i see') || lower.includes('notice') ||
            lower.includes('looking at') || lower.includes('the input')) {
            return 'observation';
        }

        // Decision indicators
        if (lower.includes('therefore') || lower.includes('conclude') ||
            lower.includes('deciding') || lower.includes('best approach')) {
            return 'decision';
        }

        // Action indicators
        if (lower.includes('will') || lower.includes('let me') ||
            lower.includes('going to') || lower.includes('should')) {
            return 'action';
        }

        return 'reasoning';
    }

    /**
     * Format thinking for display
     */
    formatForDisplay(session: ThinkingSession): string {
        const parts: string[] = [];

        parts.push(`## 🧠 Thinking Process`);
        parts.push(`Query: ${session.query}\n`);

        for (const step of session.steps) {
            const icon = this.getStepIcon(step.type);
            const duration = step.duration ? ` (${step.duration}ms)` : '';
            parts.push(`${icon} ${step.content}${duration}`);
        }

        if (session.finalAnswer) {
            parts.push(`\n## ✅ Answer`);
            parts.push(session.finalAnswer);
        }

        return parts.join('\n');
    }

    /**
     * Get icon for step type
     */
    private getStepIcon(type: ThinkingStep['type']): string {
        const icons: Record<ThinkingStep['type'], string> = {
            observation: '👁️',
            reasoning: '🔍',
            decision: '⚖️',
            action: '⚡'
        };
        return icons[type];
    }

    /**
     * Get session by ID
     */
    getSession(sessionId: string): ThinkingSession | undefined {
        return this.sessions.get(sessionId);
    }

    /**
     * Get current session
     */
    getCurrentSession(): ThinkingSession | null {
        return this.currentSession;
    }

    /**
     * Toggle visibility
     */
    toggleVisibility(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.visible = !session.visible;
            return session.visible;
        }
        return false;
    }

    /**
     * Notify all callbacks
     */
    private notifyCallbacks(step: ThinkingStep): void {
        for (const callback of this.callbacks) {
            try {
                callback(step);
            } catch (error) {
                logger.warn('Thinking callback error', { error });
            }
        }
    }

    /**
     * Clear old sessions
     */
    clearOldSessions(maxAge: number = 3600000): number {
        const cutoff = Date.now() - maxAge;
        let cleared = 0;

        for (const [id, session] of this.sessions) {
            if (session.startedAt.getTime() < cutoff) {
                this.sessions.delete(id);
                cleared++;
            }
        }

        return cleared;
    }

    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `think_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get statistics
     */
    getStats(): {
        enabled: boolean;
        activeSessions: number;
        totalSteps: number;
        callbackCount: number;
    } {
        let totalSteps = 0;
        for (const session of this.sessions.values()) {
            totalSteps += session.steps.length;
        }

        return {
            enabled: this.config.enabled,
            activeSessions: this.sessions.size,
            totalSteps,
            callbackCount: this.callbacks.length
        };
    }
}

// Default instance
export const thinkingUI = new ThinkingUI();
