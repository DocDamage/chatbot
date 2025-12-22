/**
 * Universal LLM Handler
 * Single entry point for all LLM interactions across the chatbot
 * Automatically uses the best available model (free or paid)
 */

import { logger } from '../observability/logger';
import { LLMAdapter, LLMGenerateOptions, LLMResponse } from '../providers/LLMAdapter';
import { OllamaAdapter } from '../providers/OllamaAdapter';
import { HuggingFaceAdapter } from '../providers/HuggingFaceAdapter';

export interface UniversalLLMConfig {
    preferFree: boolean;
    fallbackToTemplate: boolean;
    timeout: number;
    maxRetries: number;
}

export interface LLMCapabilities {
    vision: boolean;
    streaming: boolean;
    functionCalling: boolean;
    maxTokens: number;
    costPerToken: number;
}

export class UniversalLLM {
    private adapters: Map<string, LLMAdapter> = new Map();
    private primaryAdapter: LLMAdapter | null = null;
    private config: UniversalLLMConfig;
    private initialized: boolean = false;

    constructor(config?: Partial<UniversalLLMConfig>) {
        this.config = {
            preferFree: true,
            fallbackToTemplate: true,
            timeout: 60000,
            maxRetries: 2,
            ...config
        };
    }

    /**
     * Initialize and discover all available LLMs
     */
    async initialize(): Promise<{ available: string[]; primary: string }> {
        const available: string[] = [];

        // 1. Try Ollama (free, local) - highest priority if preferFree
        try {
            const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
            const ollamaModel = process.env.OLLAMA_MODEL || 'llama2';
            const ollama = new OllamaAdapter(ollamaUrl, ollamaModel);

            const { available: isAvailable, models } = await ollama.checkAvailability();
            if (isAvailable) {
                this.adapters.set('ollama', ollama);
                available.push(`ollama:${ollamaModel}`);
                if (models) {
                    available.push(...models.slice(1, 3).map(m => `ollama:${m}`));
                }

                if (this.config.preferFree) {
                    this.primaryAdapter = ollama;
                }
                logger.info('Ollama available', { models });
            }
        } catch (error) {
            logger.debug('Ollama not available');
        }

        // 2. Try HuggingFace (free with rate limits)
        try {
            const hfKey = process.env.HUGGINGFACE_API_KEY;
            const hfModel = process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2';
            const huggingface = new HuggingFaceAdapter(hfKey, hfModel);
            this.adapters.set('huggingface', huggingface);
            available.push(`huggingface:${hfModel}`);

            if (this.config.preferFree && !this.primaryAdapter) {
                this.primaryAdapter = huggingface;
            }
        } catch (error) {
            logger.debug('HuggingFace not available');
        }

        // 3. Try OpenAI (paid)
        if (process.env.OPENAI_API_KEY) {
            try {
                const { OpenAIAdapter } = await import('../providers/LLMAdapter');
                const openai = new OpenAIAdapter(
                    process.env.OPENAI_API_KEY,
                    process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
                );
                this.adapters.set('openai', openai);
                available.push(`openai:${openai.getModelName()}`);

                if (!this.config.preferFree || !this.primaryAdapter) {
                    this.primaryAdapter = openai;
                }
            } catch (error) {
                logger.debug('OpenAI not available');
            }
        }

        // 4. Fallback to template if nothing else available
        if (!this.primaryAdapter && this.config.fallbackToTemplate) {
            const { TemplateAdapter } = await import('../providers/LLMAdapter');
            const template = new TemplateAdapter();
            this.adapters.set('template', template);
            this.primaryAdapter = template;
            available.push('template');
            logger.warn('No LLM providers available, using template fallback');
        }

        this.initialized = true;
        const primary = this.primaryAdapter?.getModelName() || 'none';

        logger.info('UniversalLLM initialized', { available, primary });
        return { available, primary };
    }

    /**
     * Generate response using the best available LLM
     */
    async generate(options: LLMGenerateOptions): Promise<LLMResponse> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (!this.primaryAdapter) {
            throw new Error('No LLM adapters available');
        }

        let lastError: Error | null = null;
        const adaptersToTry = [this.primaryAdapter, ...this.adapters.values()];
        const tried = new Set<string>();

        for (const adapter of adaptersToTry) {
            const modelName = adapter.getModelName();
            if (tried.has(modelName)) continue;
            tried.add(modelName);

            try {
                const result = await Promise.race([
                    adapter.generate(options),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Timeout')), this.config.timeout)
                    )
                ]);
                return result;
            } catch (error: any) {
                lastError = error;
                logger.warn('LLM generation failed, trying next', {
                    model: modelName,
                    error: error.message
                });
            }
        }

        throw lastError || new Error('All LLM adapters failed');
    }

    /**
     * Generate with a specific provider
     */
    async generateWith(provider: string, options: LLMGenerateOptions): Promise<LLMResponse> {
        const adapter = this.adapters.get(provider);
        if (!adapter) {
            throw new Error(`Provider '${provider}' not available`);
        }
        return adapter.generate(options);
    }

    /**
     * Get a handler function for use by other services
     */
    getHandler(): (prompt: string, systemPrompt?: string) => Promise<string> {
        return async (prompt: string, systemPrompt?: string) => {
            const result = await this.generate({ prompt, systemPrompt });
            return result.content;
        };
    }

    /**
     * Get available providers
     */
    getAvailableProviders(): string[] {
        return Array.from(this.adapters.keys());
    }

    /**
     * Get primary adapter
     */
    getPrimaryAdapter(): LLMAdapter | null {
        return this.primaryAdapter;
    }

    /**
     * Set primary adapter
     */
    setPrimaryAdapter(provider: string): boolean {
        const adapter = this.adapters.get(provider);
        if (adapter) {
            this.primaryAdapter = adapter;
            logger.info('Primary adapter changed', { provider });
            return true;
        }
        return false;
    }

    /**
     * Register a custom adapter
     */
    registerAdapter(name: string, adapter: LLMAdapter, setAsPrimary: boolean = false): void {
        this.adapters.set(name, adapter);
        if (setAsPrimary) {
            this.primaryAdapter = adapter;
        }
        logger.info('Custom adapter registered', { name, setAsPrimary });
    }

    /**
     * Get stats
     */
    getStats(): {
        initialized: boolean;
        primaryAdapter: string | null;
        availableAdapters: string[];
        config: UniversalLLMConfig;
    } {
        return {
            initialized: this.initialized,
            primaryAdapter: this.primaryAdapter?.getModelName() || null,
            availableAdapters: Array.from(this.adapters.keys()),
            config: this.config
        };
    }
}

// Default instance
let defaultInstance: UniversalLLM | null = null;

export function getUniversalLLM(): UniversalLLM {
    if (!defaultInstance) {
        defaultInstance = new UniversalLLM();
    }
    return defaultInstance;
}

export async function initializeUniversalLLM(config?: Partial<UniversalLLMConfig>): Promise<UniversalLLM> {
    defaultInstance = new UniversalLLM(config);
    await defaultInstance.initialize();
    return defaultInstance;
}
