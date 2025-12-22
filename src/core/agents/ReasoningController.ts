/**
 * Reasoning Controller
 * Adjustable reasoning effort (low/medium/high) for inference control
 * Maps to model parameters like temperature, thinking tokens, and response style
 */

import { logger } from '../observability/logger';

export type ReasoningLevel = 'low' | 'medium' | 'high';

export interface ReasoningConfig {
    level: ReasoningLevel;
    temperature: number;
    maxThinkingTokens: number;
    requiresExplanation: boolean;
    chainOfThought: boolean;
    minConfidence: number;
}

export interface ReasoningResult {
    answer: string;
    reasoning?: string;
    confidence: number;
    thinkingSteps?: string[];
    level: ReasoningLevel;
    tokensUsed: {
        thinking: number;
        output: number;
    };
}

const REASONING_PRESETS: Record<ReasoningLevel, ReasoningConfig> = {
    low: {
        level: 'low',
        temperature: 0.3,
        maxThinkingTokens: 256,
        requiresExplanation: false,
        chainOfThought: false,
        minConfidence: 0.5
    },
    medium: {
        level: 'medium',
        temperature: 0.5,
        maxThinkingTokens: 1024,
        requiresExplanation: true,
        chainOfThought: true,
        minConfidence: 0.7
    },
    high: {
        level: 'high',
        temperature: 0.7,
        maxThinkingTokens: 4096,
        requiresExplanation: true,
        chainOfThought: true,
        minConfidence: 0.85
    }
};

export class ReasoningController {
    private currentLevel: ReasoningLevel = 'medium';
    private customConfigs: Map<string, ReasoningConfig> = new Map();

    constructor(defaultLevel?: ReasoningLevel) {
        if (defaultLevel) {
            this.currentLevel = defaultLevel;
        }
    }

    /**
     * Set the current reasoning level
     */
    setLevel(level: ReasoningLevel): void {
        this.currentLevel = level;
        logger.info('Reasoning level set', { level });
    }

    /**
     * Get the current reasoning level
     */
    getLevel(): ReasoningLevel {
        return this.currentLevel;
    }

    /**
     * Get configuration for a specific level
     */
    getConfig(level?: ReasoningLevel): ReasoningConfig {
        const targetLevel = level || this.currentLevel;
        return this.customConfigs.get(targetLevel) || REASONING_PRESETS[targetLevel];
    }

    /**
     * Set custom configuration for a level
     */
    setCustomConfig(level: ReasoningLevel, config: Partial<ReasoningConfig>): void {
        const baseConfig = REASONING_PRESETS[level];
        this.customConfigs.set(level, { ...baseConfig, ...config, level });
    }

    /**
     * Build a prompt with reasoning instructions based on level
     */
    buildReasoningPrompt(basePrompt: string, level?: ReasoningLevel): string {
        const config = this.getConfig(level);

        let enhancedPrompt = basePrompt;

        if (config.chainOfThought) {
            enhancedPrompt = this.addChainOfThoughtInstructions(enhancedPrompt, config);
        }

        if (config.requiresExplanation) {
            enhancedPrompt = this.addExplanationRequirement(enhancedPrompt);
        }

        return enhancedPrompt;
    }

    /**
     * Add chain-of-thought instructions
     */
    private addChainOfThoughtInstructions(prompt: string, config: ReasoningConfig): string {
        const cotPrefix = config.level === 'high'
            ? `Think through this step-by-step with detailed reasoning:

1. First, understand what's being asked
2. Break down the problem into components
3. Consider multiple approaches
4. Evaluate each approach
5. Choose the best solution and explain why

Question: `
            : `Think step-by-step:

`;

        return cotPrefix + prompt;
    }

    /**
     * Add requirement for explanation
     */
    private addExplanationRequirement(prompt: string): string {
        return prompt + '\n\nProvide your reasoning along with the answer.';
    }

    /**
     * Parse reasoning from model response
     */
    parseReasoningResponse(response: string, level?: ReasoningLevel): ReasoningResult {
        const config = this.getConfig(level);

        // Try to extract thinking/reasoning sections
        const thinkingMatch = response.match(/<thinking>([\s\S]*?)<\/thinking>/);
        const answerMatch = response.match(/<answer>([\s\S]*?)<\/answer>/);

        let reasoning: string | undefined;
        let answer: string;
        let thinkingSteps: string[] = [];

        if (thinkingMatch && answerMatch) {
            reasoning = thinkingMatch[1].trim();
            answer = answerMatch[1].trim();
            thinkingSteps = this.extractSteps(reasoning);
        } else {
            // Try to split by common patterns
            const splitPatterns = [
                /(?:therefore|thus|so|in conclusion|the answer is)[,:]?\s*/i,
                /\n\n(?=\w)/
            ];

            let found = false;
            for (const pattern of splitPatterns) {
                const parts = response.split(pattern);
                if (parts.length >= 2) {
                    reasoning = parts.slice(0, -1).join(' ').trim();
                    answer = parts[parts.length - 1].trim();
                    thinkingSteps = this.extractSteps(reasoning);
                    found = true;
                    break;
                }
            }

            if (!found) {
                answer = response;
            }
        }

        // Estimate confidence based on reasoning quality
        const confidence = this.estimateConfidence(answer, reasoning, config);

        return {
            answer,
            reasoning,
            confidence,
            thinkingSteps: thinkingSteps.length > 0 ? thinkingSteps : undefined,
            level: config.level,
            tokensUsed: {
                thinking: reasoning ? this.estimateTokens(reasoning) : 0,
                output: this.estimateTokens(answer)
            }
        };
    }

    /**
     * Extract numbered steps from reasoning
     */
    private extractSteps(reasoning: string): string[] {
        const stepPattern = /(?:^|\n)\s*(?:\d+[\.\):]|\-|\*)\s*(.+)/g;
        const steps: string[] = [];
        let match;

        while ((match = stepPattern.exec(reasoning)) !== null) {
            steps.push(match[1].trim());
        }

        return steps;
    }

    /**
     * Estimate confidence based on response characteristics
     */
    private estimateConfidence(
        answer: string,
        reasoning: string | undefined,
        config: ReasoningConfig
    ): number {
        let confidence = 0.5;

        // Longer answers with more detail tend to be more confident
        if (answer.length > 100) confidence += 0.1;
        if (answer.length > 500) confidence += 0.1;

        // Presence of reasoning increases confidence
        if (reasoning) {
            confidence += 0.15;

            // More detailed reasoning
            if (reasoning.length > 200) confidence += 0.1;
        }

        // Check for uncertainty indicators
        const uncertaintyWords = [
            'maybe', 'perhaps', 'possibly', 'might', 'could be',
            'not sure', 'uncertain', 'unclear', 'i think', 'seems like'
        ];

        const lowerAnswer = answer.toLowerCase();
        for (const word of uncertaintyWords) {
            if (lowerAnswer.includes(word)) {
                confidence -= 0.1;
                break;
            }
        }

        // Check for confidence indicators
        const confidenceWords = [
            'definitely', 'certainly', 'absolutely', 'clearly',
            'without doubt', 'confirmed', 'proven'
        ];

        for (const word of confidenceWords) {
            if (lowerAnswer.includes(word)) {
                confidence += 0.1;
                break;
            }
        }

        // Clamp between 0 and 1
        return Math.max(0, Math.min(1, confidence));
    }

    /**
     * Estimate token count from text
     */
    private estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    /**
     * Determine if reasoning meets quality threshold
     */
    meetsQualityThreshold(result: ReasoningResult): boolean {
        const config = this.getConfig(result.level);

        if (result.confidence < config.minConfidence) {
            logger.warn('Reasoning below confidence threshold', {
                confidence: result.confidence,
                required: config.minConfidence,
                level: result.level
            });
            return false;
        }

        if (config.requiresExplanation && !result.reasoning) {
            logger.warn('Reasoning required but not provided', {
                level: result.level
            });
            return false;
        }

        return true;
    }

    /**
     * Get model parameters for current reasoning level
     */
    getModelParameters(level?: ReasoningLevel): {
        temperature: number;
        max_tokens: number;
        presence_penalty?: number;
        frequency_penalty?: number;
    } {
        const config = this.getConfig(level);

        return {
            temperature: config.temperature,
            max_tokens: config.maxThinkingTokens + 2048, // Thinking + output
            presence_penalty: config.level === 'high' ? 0.1 : 0,
            frequency_penalty: config.level === 'high' ? 0.1 : 0
        };
    }

    /**
     * Suggest reasoning level based on task complexity
     */
    suggestLevel(prompt: string): ReasoningLevel {
        const lowerPrompt = prompt.toLowerCase();

        // High complexity indicators
        const highIndicators = [
            'analyze', 'evaluate', 'compare', 'contrast', 'synthesize',
            'complex', 'detailed', 'comprehensive', 'in-depth',
            'multiple', 'factors', 'considerations', 'trade-offs',
            'architecture', 'design', 'strategy', 'plan'
        ];

        // Low complexity indicators
        const lowIndicators = [
            'simple', 'quick', 'brief', 'short', 'fast',
            'yes or no', 'true or false', 'what is', 'define',
            'list', 'name', 'who', 'when', 'where'
        ];

        let score = 0;

        for (const indicator of highIndicators) {
            if (lowerPrompt.includes(indicator)) score++;
        }

        for (const indicator of lowIndicators) {
            if (lowerPrompt.includes(indicator)) score--;
        }

        // Also consider length
        if (prompt.length > 500) score++;
        if (prompt.length > 1000) score++;

        if (score >= 3) return 'high';
        if (score <= -2) return 'low';
        return 'medium';
    }
}

// Export singleton instance
export const reasoningController = new ReasoningController();
