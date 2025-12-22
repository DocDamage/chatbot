/**
 * Multi-Agent Orchestrator
 * Coordinate multiple LLM providers (OpenAI, Claude, Gemini) to work together on tasks
 * 
 * Modes:
 * - Consensus: All agents vote on best solution
 * - Race: Fastest response wins
 * - Specialist: Route to best agent per domain
 */

import { logger } from '../observability/logger';

export interface AgentProvider {
    name: string;
    id: string;
    execute: (prompt: string, options?: AgentOptions) => Promise<AgentResponse>;
    specialties: string[];
    priority: number;
}

export interface AgentOptions {
    timeout?: number;
    maxTokens?: number;
    temperature?: number;
    reasoningLevel?: 'low' | 'medium' | 'high';
}

export interface AgentResponse {
    content: string;
    provider: string;
    latency: number;
    confidence?: number;
    reasoning?: string;
    tokens?: {
        input: number;
        output: number;
    };
}

export interface ConsensusResult {
    finalAnswer: string;
    votes: { provider: string; answer: string; vote: number }[];
    agreement: number;
    reasoning: string[];
}

export type OrchestrationMode = 'consensus' | 'race' | 'specialist' | 'parallel';

export interface OrchestrationConfig {
    mode: OrchestrationMode;
    timeout?: number;
    minAgreement?: number;
    fallbackProvider?: string;
    retryOnFailure?: boolean;
    maxRetries?: number;
}

export class MultiAgentOrchestrator {
    private providers: Map<string, AgentProvider> = new Map();
    private defaultConfig: OrchestrationConfig = {
        mode: 'consensus',
        timeout: 30000,
        minAgreement: 0.6,
        retryOnFailure: true,
        maxRetries: 2
    };

    constructor(config?: Partial<OrchestrationConfig>) {
        if (config) {
            this.defaultConfig = { ...this.defaultConfig, ...config };
        }
    }

    /**
     * Register an agent provider
     */
    registerProvider(provider: AgentProvider): void {
        this.providers.set(provider.id, provider);
        logger.info('Registered agent provider', {
            id: provider.id,
            name: provider.name,
            specialties: provider.specialties
        });
    }

    /**
     * Unregister an agent provider
     */
    unregisterProvider(providerId: string): boolean {
        const removed = this.providers.delete(providerId);
        if (removed) {
            logger.info('Unregistered agent provider', { id: providerId });
        }
        return removed;
    }

    /**
     * Get all registered providers
     */
    getProviders(): AgentProvider[] {
        return Array.from(this.providers.values());
    }

    /**
     * Execute task using specified orchestration mode
     */
    async execute(
        prompt: string,
        config?: Partial<OrchestrationConfig>,
        options?: AgentOptions
    ): Promise<AgentResponse | ConsensusResult> {
        const finalConfig = { ...this.defaultConfig, ...config };

        logger.info('Orchestrating multi-agent task', {
            mode: finalConfig.mode,
            providers: this.providers.size
        });

        switch (finalConfig.mode) {
            case 'consensus':
                return this.executeConsensus(prompt, finalConfig, options);
            case 'race':
                return this.executeRace(prompt, finalConfig, options);
            case 'specialist':
                return this.executeSpecialist(prompt, finalConfig, options);
            case 'parallel':
                return this.executeParallel(prompt, finalConfig, options);
            default:
                throw new Error(`Unknown orchestration mode: ${finalConfig.mode}`);
        }
    }

    /**
     * Consensus mode: All agents respond, vote on best answer
     */
    private async executeConsensus(
        prompt: string,
        config: OrchestrationConfig,
        options?: AgentOptions
    ): Promise<ConsensusResult> {
        const providers = Array.from(this.providers.values());
        if (providers.length === 0) {
            throw new Error('No providers registered');
        }

        // Get responses from all providers
        const responses = await this.getAllResponses(prompt, providers, config, options);

        if (responses.length === 0) {
            throw new Error('No responses received from any provider');
        }

        // If only one response, return it directly
        if (responses.length === 1) {
            return {
                finalAnswer: responses[0].content,
                votes: [{ provider: responses[0].provider, answer: responses[0].content, vote: 1 }],
                agreement: 1,
                reasoning: responses[0].reasoning ? [responses[0].reasoning] : []
            };
        }

        // Calculate similarity and vote
        const votes = await this.calculateVotes(responses);
        const bestAnswer = this.selectBestAnswer(votes, config.minAgreement || 0.6);

        return {
            finalAnswer: bestAnswer.answer,
            votes,
            agreement: bestAnswer.agreement,
            reasoning: responses
                .filter(r => r.reasoning)
                .map(r => `${r.provider}: ${r.reasoning}`)
        };
    }

    /**
     * Race mode: Return fastest response
     */
    private async executeRace(
        prompt: string,
        config: OrchestrationConfig,
        options?: AgentOptions
    ): Promise<AgentResponse> {
        const providers = Array.from(this.providers.values());
        if (providers.length === 0) {
            throw new Error('No providers registered');
        }

        // Race all providers
        const racePromises = providers.map(provider =>
            this.executeWithTimeout(provider, prompt, config.timeout || 30000, options)
        );

        try {
            // Return first successful response
            const result = await Promise.race(
                racePromises.map(p => p.catch(() => null))
                    .filter(p => p !== null)
            );

            if (!result) {
                throw new Error('All providers failed');
            }

            logger.info('Race mode winner', { provider: result.provider, latency: result.latency });
            return result;
        } catch (error) {
            // Fallback to first available
            for (const promise of racePromises) {
                try {
                    const result = await promise;
                    if (result) return result;
                } catch {
                    continue;
                }
            }
            throw new Error('All providers failed in race mode');
        }
    }

    /**
     * Specialist mode: Route to best provider based on task type
     */
    private async executeSpecialist(
        prompt: string,
        config: OrchestrationConfig,
        options?: AgentOptions
    ): Promise<AgentResponse> {
        const specialty = this.detectSpecialty(prompt);
        const bestProvider = this.findBestProvider(specialty);

        if (!bestProvider) {
            throw new Error(`No provider found for specialty: ${specialty}`);
        }

        logger.info('Specialist mode routing', {
            specialty,
            provider: bestProvider.id
        });

        return this.executeWithTimeout(
            bestProvider,
            prompt,
            config.timeout || 30000,
            options
        );
    }

    /**
     * Parallel mode: Execute all providers, return all responses
     */
    private async executeParallel(
        prompt: string,
        config: OrchestrationConfig,
        options?: AgentOptions
    ): Promise<ConsensusResult> {
        const providers = Array.from(this.providers.values());
        const responses = await this.getAllResponses(prompt, providers, config, options);

        // Return all responses without voting
        return {
            finalAnswer: responses[0]?.content || '',
            votes: responses.map(r => ({
                provider: r.provider,
                answer: r.content,
                vote: 1
            })),
            agreement: 1,
            reasoning: responses
                .filter(r => r.reasoning)
                .map(r => `${r.provider}: ${r.reasoning}`)
        };
    }

    /**
     * Get responses from all providers
     */
    private async getAllResponses(
        prompt: string,
        providers: AgentProvider[],
        config: OrchestrationConfig,
        options?: AgentOptions
    ): Promise<AgentResponse[]> {
        const promises = providers.map(provider =>
            this.executeWithTimeout(provider, prompt, config.timeout || 30000, options)
                .catch(error => {
                    logger.warn('Provider failed', {
                        provider: provider.id,
                        error: error.message
                    });
                    return null;
                })
        );

        const results = await Promise.all(promises);
        return results.filter((r): r is AgentResponse => r !== null);
    }

    /**
     * Execute provider with timeout
     */
    private async executeWithTimeout(
        provider: AgentProvider,
        prompt: string,
        timeout: number,
        options?: AgentOptions
    ): Promise<AgentResponse> {
        const startTime = Date.now();

        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeout);
        });

        try {
            const result = await Promise.race([
                provider.execute(prompt, options),
                timeoutPromise
            ]);

            return {
                ...result,
                provider: provider.id,
                latency: Date.now() - startTime
            };
        } catch (error: any) {
            throw new Error(`Provider ${provider.id} failed: ${error.message}`);
        }
    }

    /**
     * Calculate votes based on response similarity
     */
    private async calculateVotes(
        responses: AgentResponse[]
    ): Promise<{ provider: string; answer: string; vote: number }[]> {
        // Simple voting: each response gets 1 base vote
        // Bonus votes for similarity to other responses
        const votes = responses.map(response => {
            let vote = 1;

            // Add bonus for confidence
            if (response.confidence) {
                vote += response.confidence;
            }

            // Add bonus for responses that agree with others
            const similarities = responses
                .filter(r => r.provider !== response.provider)
                .map(r => this.calculateSimilarity(response.content, r.content));

            const avgSimilarity = similarities.length > 0
                ? similarities.reduce((a, b) => a + b, 0) / similarities.length
                : 0;

            vote += avgSimilarity;

            return {
                provider: response.provider,
                answer: response.content,
                vote
            };
        });

        return votes.sort((a, b) => b.vote - a.vote);
    }

    /**
     * Select best answer from votes
     */
    private selectBestAnswer(
        votes: { provider: string; answer: string; vote: number }[],
        minAgreement: number
    ): { answer: string; agreement: number } {
        const totalVotes = votes.reduce((sum, v) => sum + v.vote, 0);
        const topVote = votes[0];
        const agreement = topVote.vote / totalVotes;

        if (agreement < minAgreement && votes.length > 1) {
            logger.warn('Low consensus agreement', {
                agreement,
                minRequired: minAgreement
            });
        }

        return {
            answer: topVote.answer,
            agreement
        };
    }

    /**
     * Calculate text similarity (simple word overlap)
     */
    private calculateSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);

        return intersection.size / union.size; // Jaccard similarity
    }

    /**
     * Detect task specialty from prompt
     */
    private detectSpecialty(prompt: string): string {
        const lowerPrompt = prompt.toLowerCase();

        const specialties: { keyword: string; specialty: string }[] = [
            { keyword: 'code', specialty: 'coding' },
            { keyword: 'python', specialty: 'coding' },
            { keyword: 'javascript', specialty: 'coding' },
            { keyword: 'debug', specialty: 'coding' },
            { keyword: 'math', specialty: 'reasoning' },
            { keyword: 'calculate', specialty: 'reasoning' },
            { keyword: 'analyze', specialty: 'reasoning' },
            { keyword: 'creative', specialty: 'creative' },
            { keyword: 'write', specialty: 'creative' },
            { keyword: 'story', specialty: 'creative' },
            { keyword: 'research', specialty: 'research' },
            { keyword: 'summarize', specialty: 'research' },
            { keyword: 'explain', specialty: 'general' }
        ];

        for (const { keyword, specialty } of specialties) {
            if (lowerPrompt.includes(keyword)) {
                return specialty;
            }
        }

        return 'general';
    }

    /**
     * Find best provider for specialty
     */
    private findBestProvider(specialty: string): AgentProvider | undefined {
        const providers = Array.from(this.providers.values());

        // First, find providers that specialize in this area
        const specialists = providers.filter(p =>
            p.specialties.includes(specialty)
        );

        if (specialists.length > 0) {
            // Return highest priority specialist
            return specialists.sort((a, b) => b.priority - a.priority)[0];
        }

        // Fallback to highest priority general provider
        return providers.sort((a, b) => b.priority - a.priority)[0];
    }
}

/**
 * Factory functions for common provider configurations
 */
export function createOpenAIProvider(
    apiKey: string,
    model: string = 'gpt-4-turbo-preview'
): AgentProvider {
    return {
        id: 'openai',
        name: 'OpenAI',
        specialties: ['coding', 'general', 'reasoning'],
        priority: 3,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            // Placeholder - would use actual OpenAI SDK
            const { OpenAI } = await import('openai');
            const client = new OpenAI({ apiKey });

            const startTime = Date.now();
            const response = await client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: options?.maxTokens || 4096,
                temperature: options?.temperature || 0.7
            });

            return {
                content: response.choices[0]?.message?.content || '',
                provider: 'openai',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.usage?.prompt_tokens || 0,
                    output: response.usage?.completion_tokens || 0
                }
            };
        }
    };
}

export function createClaudeProvider(
    apiKey: string,
    model: string = 'claude-3-opus-20240229'
): AgentProvider {
    return {
        id: 'claude',
        name: 'Anthropic Claude',
        specialties: ['coding', 'creative', 'reasoning'],
        priority: 3,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const Anthropic = (await import('@anthropic-ai/sdk')).default;
            const client = new Anthropic({ apiKey });

            const startTime = Date.now();
            const response = await client.messages.create({
                model,
                max_tokens: options?.maxTokens || 4096,
                messages: [{ role: 'user', content: prompt }]
            });

            const textContent = response.content.find(c => c.type === 'text');

            return {
                content: textContent?.text || '',
                provider: 'claude',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.usage?.input_tokens || 0,
                    output: response.usage?.output_tokens || 0
                }
            };
        }
    };
}

export function createGeminiProvider(
    apiKey: string,
    model: string = 'gemini-pro'
): AgentProvider {
    return {
        id: 'gemini',
        name: 'Google Gemini',
        specialties: ['research', 'general', 'coding'],
        priority: 2,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const genAI = new GoogleGenerativeAI(apiKey);
            const gemini = genAI.getGenerativeModel({ model });

            const startTime = Date.now();
            const result = await gemini.generateContent(prompt);
            const response = result.response;

            return {
                content: response.text(),
                provider: 'gemini',
                latency: Date.now() - startTime
            };
        }
    };
}

/**
 * Create Ollama provider (FREE, LOCAL)
 */
export function createOllamaProvider(
    baseUrl: string = 'http://localhost:11434',
    model: string = 'llama3'
): AgentProvider {
    return {
        id: `ollama-${model}`,
        name: `Ollama ${model}`,
        specialties: ['general', 'coding', 'creative'],
        priority: 2, // Same priority as paid models when available
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            try {
                const response = await axios.post(`${baseUrl}/api/generate`, {
                    model,
                    prompt,
                    stream: false,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        num_predict: options?.maxTokens ?? 2048
                    }
                }, { timeout: options?.timeout || 60000 });

                return {
                    content: response.data.response || '',
                    provider: `ollama-${model}`,
                    latency: Date.now() - startTime,
                    tokens: {
                        input: response.data.prompt_eval_count || 0,
                        output: response.data.eval_count || 0
                    }
                };
            } catch (error: any) {
                throw new Error(`Ollama (${model}) failed: ${error.message}`);
            }
        }
    };
}

/**
 * Create HuggingFace provider (FREE with rate limits)
 */
export function createHuggingFaceProvider(
    apiKey?: string,
    model: string = 'mistralai/Mistral-7B-Instruct-v0.2'
): AgentProvider {
    const modelName = model.split('/').pop() || model;
    return {
        id: `huggingface-${modelName}`,
        name: `HuggingFace ${modelName}`,
        specialties: ['general', 'coding'],
        priority: 1, // Lower priority due to rate limits
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            };
            if (apiKey) {
                headers['Authorization'] = `Bearer ${apiKey}`;
            }

            try {
                const response = await axios.post(
                    `https://api-inference.huggingface.co/models/${model}`,
                    {
                        inputs: prompt,
                        parameters: {
                            max_new_tokens: options?.maxTokens || 1024,
                            temperature: options?.temperature || 0.7,
                            return_full_text: false
                        }
                    },
                    { headers, timeout: options?.timeout || 30000 }
                );

                const content = Array.isArray(response.data)
                    ? response.data[0]?.generated_text || ''
                    : response.data.generated_text || '';

                return {
                    content,
                    provider: `huggingface-${modelName}`,
                    latency: Date.now() - startTime
                };
            } catch (error: any) {
                throw new Error(`HuggingFace (${modelName}) failed: ${error.message}`);
            }
        }
    };
}

/**
 * Bridge existing LLMAdapter to AgentProvider
 * This allows any existing adapter to work with MultiAgentOrchestrator
 */
export function bridgeLLMAdapter(
    adapter: { generate: Function; getModelName: () => string },
    config: {
        id?: string;
        name?: string;
        specialties?: string[];
        priority?: number;
    } = {}
): AgentProvider {
    const modelName = adapter.getModelName();
    return {
        id: config.id || modelName.replace(/[^a-z0-9]/gi, '-').toLowerCase(),
        name: config.name || modelName,
        specialties: config.specialties || ['general'],
        priority: config.priority || 1,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const startTime = Date.now();
            const result = await adapter.generate({
                prompt,
                temperature: options?.temperature,
                maxTokens: options?.maxTokens
            });

            return {
                content: result.content,
                provider: modelName,
                latency: Date.now() - startTime,
                tokens: result.tokensUsed ? {
                    input: Math.floor(result.tokensUsed * 0.3),
                    output: Math.floor(result.tokensUsed * 0.7)
                } : undefined
            };
        }
    };
}

/**
 * Auto-register all available LLM providers
 * Checks environment and local services to find available models
 */
export async function autoRegisterProviders(
    orchestrator: MultiAgentOrchestrator
): Promise<{ registered: string[]; failed: string[] }> {
    const registered: string[] = [];
    const failed: string[] = [];

    // 1. Check Ollama (local, free)
    try {
        const axios = (await import('axios')).default;
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        const response = await axios.get(`${ollamaUrl}/api/tags`, { timeout: 2000 });
        const models = response.data.models || [];

        for (const model of models.slice(0, 3)) { // Register up to 3 Ollama models
            const provider = createOllamaProvider(ollamaUrl, model.name);
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        }

        // If no models pulled, register with default
        if (models.length === 0) {
            const provider = createOllamaProvider(ollamaUrl, 'llama2');
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        }
    } catch {
        failed.push('ollama');
    }

    // 2. HuggingFace (free with optional API key)
    try {
        const hfKey = process.env.HUGGINGFACE_API_KEY;
        const provider = createHuggingFaceProvider(hfKey);
        orchestrator.registerProvider(provider);
        registered.push(provider.id);
    } catch {
        failed.push('huggingface');
    }

    // 3. OpenAI (paid)
    if (process.env.OPENAI_API_KEY) {
        try {
            const provider = createOpenAIProvider(
                process.env.OPENAI_API_KEY,
                process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('openai');
        }
    }

    // 4. Anthropic Claude (paid)
    if (process.env.ANTHROPIC_API_KEY) {
        try {
            const provider = createClaudeProvider(
                process.env.ANTHROPIC_API_KEY,
                process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('claude');
        }
    }

    // 5. Google Gemini (FREE tier available!)
    if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
        try {
            const provider = createGeminiProvider(
                process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY!,
                process.env.GEMINI_MODEL || 'gemini-1.5-flash' // Free tier model
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('gemini');
        }
    }

    // 6. Groq (FREE - fast inference for Llama, Mixtral)
    if (process.env.GROQ_API_KEY) {
        try {
            const provider = createGroqProvider(
                process.env.GROQ_API_KEY,
                process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('groq');
        }
    }

    // 7. Cohere (FREE tier)
    if (process.env.COHERE_API_KEY) {
        try {
            const provider = createCohereProvider(
                process.env.COHERE_API_KEY,
                process.env.COHERE_MODEL || 'command-r-plus'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('cohere');
        }
    }

    // 8. DeepSeek (FREE/cheap - great for coding)
    if (process.env.DEEPSEEK_API_KEY) {
        try {
            const provider = createDeepSeekProvider(
                process.env.DEEPSEEK_API_KEY,
                process.env.DEEPSEEK_MODEL || 'deepseek-chat'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('deepseek');
        }
    }

    // 9. OpenRouter (FREE models aggregator)
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const provider = createOpenRouterProvider(
                process.env.OPENROUTER_API_KEY,
                process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.2-3b-instruct:free'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('openrouter');
        }
    }

    // 10. Cerebras (FREE - ultra-fast Llama inference)
    if (process.env.CEREBRAS_API_KEY) {
        try {
            const provider = createCerebrasProvider(
                process.env.CEREBRAS_API_KEY,
                process.env.CEREBRAS_MODEL || 'llama3.1-8b'
            );
            orchestrator.registerProvider(provider);
            registered.push(provider.id);
        } catch {
            failed.push('cerebras');
        }
    }

    logger.info('Auto-registered LLM providers', { registered, failed });
    return { registered, failed };
}

/**
 * Create a fully configured orchestrator with all available providers
 */
export async function createFullOrchestrator(
    config?: Partial<OrchestrationConfig>
): Promise<MultiAgentOrchestrator> {
    const orchestrator = new MultiAgentOrchestrator(config);
    await autoRegisterProviders(orchestrator);
    return orchestrator;
}

// ============================================================================
// FREE LLM PROVIDERS
// ============================================================================

/**
 * Create Groq provider (FREE - very fast inference)
 * Models: llama-3.3-70b-versatile, mixtral-8x7b-32768, gemma2-9b-it
 */
export function createGroqProvider(
    apiKey: string,
    model: string = 'llama-3.3-70b-versatile'
): AgentProvider {
    return {
        id: 'groq',
        name: 'Groq',
        specialties: ['coding', 'general', 'reasoning'],
        priority: 3, // High priority - very fast and free
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'groq',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Create Cohere provider (FREE tier - 1000 calls/month)
 * Models: command-r-plus, command-r, command-light
 */
export function createCohereProvider(
    apiKey: string,
    model: string = 'command-r-plus'
): AgentProvider {
    return {
        id: 'cohere',
        name: 'Cohere',
        specialties: ['general', 'research', 'creative'],
        priority: 2,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.cohere.ai/v1/chat',
                {
                    model,
                    message: prompt,
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.text || '',
                provider: 'cohere',
                latency: Date.now() - startTime
            };
        }
    };
}

/**
 * Create DeepSeek provider (FREE tier / very cheap)
 * Models: deepseek-chat, deepseek-coder, deepseek-reasoner
 */
export function createDeepSeekProvider(
    apiKey: string,
    model: string = 'deepseek-chat'
): AgentProvider {
    return {
        id: 'deepseek',
        name: 'DeepSeek',
        specialties: ['coding', 'reasoning', 'general'],
        priority: 3, // High priority for coding tasks
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 60000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'deepseek',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Create OpenRouter provider (FREE models available)
 * Free models: meta-llama/llama-3.2-3b-instruct:free, google/gemma-2-9b-it:free
 */
export function createOpenRouterProvider(
    apiKey: string,
    model: string = 'meta-llama/llama-3.2-3b-instruct:free'
): AgentProvider {
    const modelName = model.split('/').pop()?.replace(':free', '') || model;
    return {
        id: 'openrouter',
        name: `OpenRouter ${modelName}`,
        specialties: ['general', 'coding'],
        priority: 2,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://localhost',
                        'X-Title': 'ChatBot'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'openrouter',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Create Cerebras provider (FREE - ultra-fast inference)
 * Models: llama3.1-8b, llama3.1-70b
 */
export function createCerebrasProvider(
    apiKey: string,
    model: string = 'llama3.1-8b'
): AgentProvider {
    return {
        id: 'cerebras',
        name: 'Cerebras',
        specialties: ['general', 'coding'],
        priority: 3, // High priority - very fast
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.cerebras.ai/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'cerebras',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Create Together.ai provider (FREE tier available)
 * Free models: meta-llama/Llama-3.2-3B-Instruct-Turbo
 */
export function createTogetherProvider(
    apiKey: string,
    model: string = 'meta-llama/Llama-3.2-3B-Instruct-Turbo'
): AgentProvider {
    const modelName = model.split('/').pop() || model;
    return {
        id: 'together',
        name: `Together ${modelName}`,
        specialties: ['general', 'coding', 'creative'],
        priority: 2,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.together.xyz/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'together',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Create Mistral AI provider (FREE tier available)
 * Models: mistral-small-latest, mistral-medium-latest
 */
export function createMistralProvider(
    apiKey: string,
    model: string = 'mistral-small-latest'
): AgentProvider {
    return {
        id: 'mistral',
        name: 'Mistral AI',
        specialties: ['coding', 'general', 'reasoning'],
        priority: 2,
        execute: async (prompt: string, options?: AgentOptions): Promise<AgentResponse> => {
            const axios = (await import('axios')).default;
            const startTime = Date.now();

            const response = await axios.post(
                'https://api.mistral.ai/v1/chat/completions',
                {
                    model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: options?.maxTokens || 4096,
                    temperature: options?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: options?.timeout || 30000
                }
            );

            return {
                content: response.data.choices[0]?.message?.content || '',
                provider: 'mistral',
                latency: Date.now() - startTime,
                tokens: {
                    input: response.data.usage?.prompt_tokens || 0,
                    output: response.data.usage?.completion_tokens || 0
                }
            };
        }
    };
}

/**
 * Get list of all free LLM providers and their required env vars
 */
export function getFreeLLMProviders(): Array<{
    name: string;
    envVar: string;
    freeModels: string[];
    signupUrl: string;
}> {
    return [
        {
            name: 'Ollama',
            envVar: 'OLLAMA_URL (default: http://localhost:11434)',
            freeModels: ['llama3', 'llama2', 'mistral', 'codellama', 'gemma2'],
            signupUrl: 'https://ollama.ai'
        },
        {
            name: 'Groq',
            envVar: 'GROQ_API_KEY',
            freeModels: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
            signupUrl: 'https://console.groq.com'
        },
        {
            name: 'Google Gemini',
            envVar: 'GEMINI_API_KEY',
            freeModels: ['gemini-1.5-flash', 'gemini-1.5-pro (limited)'],
            signupUrl: 'https://aistudio.google.com/app/apikey'
        },
        {
            name: 'Cohere',
            envVar: 'COHERE_API_KEY',
            freeModels: ['command-r-plus', 'command-r', 'command-light'],
            signupUrl: 'https://dashboard.cohere.com'
        },
        {
            name: 'DeepSeek',
            envVar: 'DEEPSEEK_API_KEY',
            freeModels: ['deepseek-chat', 'deepseek-coder'],
            signupUrl: 'https://platform.deepseek.com'
        },
        {
            name: 'OpenRouter',
            envVar: 'OPENROUTER_API_KEY',
            freeModels: ['meta-llama/llama-3.2-3b-instruct:free', 'google/gemma-2-9b-it:free'],
            signupUrl: 'https://openrouter.ai'
        },
        {
            name: 'Cerebras',
            envVar: 'CEREBRAS_API_KEY',
            freeModels: ['llama3.1-8b', 'llama3.1-70b'],
            signupUrl: 'https://cloud.cerebras.ai'
        },
        {
            name: 'Together.ai',
            envVar: 'TOGETHER_API_KEY',
            freeModels: ['meta-llama/Llama-3.2-3B-Instruct-Turbo'],
            signupUrl: 'https://api.together.xyz'
        },
        {
            name: 'Mistral AI',
            envVar: 'MISTRAL_API_KEY',
            freeModels: ['mistral-small-latest'],
            signupUrl: 'https://console.mistral.ai'
        },
        {
            name: 'HuggingFace',
            envVar: 'HUGGINGFACE_API_KEY (optional)',
            freeModels: ['mistralai/Mistral-7B-Instruct-v0.2', 'meta-llama/Llama-2-7b-chat-hf'],
            signupUrl: 'https://huggingface.co/settings/tokens'
        }
    ];
}
