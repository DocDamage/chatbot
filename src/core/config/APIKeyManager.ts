/**
 * API Key Manager
 * Manages LLM API keys with in-app setup, validation, and secure storage
 */

import { logger } from '../observability/logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface LLMProviderInfo {
    id: string;
    name: string;
    envVar: string;
    signupUrl: string;
    apiKeyUrl: string;
    docsUrl: string;
    freeModels: string[];
    freeTier: string;
    instructions: string[];
    logoEmoji: string;
    priority: number; // Higher = better to recommend first
}

export interface StoredAPIKey {
    provider: string;
    key: string;
    addedAt: Date;
    lastUsed?: Date;
    isValid?: boolean;
    model?: string;
}

// Comprehensive LLM Provider Directory
export const LLM_PROVIDERS: LLMProviderInfo[] = [
    {
        id: 'ollama',
        name: 'Ollama',
        envVar: 'OLLAMA_URL',
        signupUrl: 'https://ollama.ai/download',
        apiKeyUrl: 'https://ollama.ai/download',
        docsUrl: 'https://ollama.ai/library',
        freeModels: ['llama3.2', 'llama3.1', 'mistral', 'codellama', 'gemma2', 'phi3', 'qwen2.5'],
        freeTier: '100% FREE - runs locally on your computer',
        logoEmoji: '🦙',
        priority: 10,
        instructions: [
            '1. Download Ollama from https://ollama.ai/download',
            '2. Install and run Ollama on your computer',
            '3. Open terminal and run: ollama pull llama3.2',
            '4. Ollama runs on http://localhost:11434 (no API key needed!)'
        ]
    },
    {
        id: 'groq',
        name: 'Groq',
        envVar: 'GROQ_API_KEY',
        signupUrl: 'https://console.groq.com/signup',
        apiKeyUrl: 'https://console.groq.com/keys',
        docsUrl: 'https://console.groq.com/docs',
        freeModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
        freeTier: 'FREE tier: 30 requests/min, 14,400 requests/day',
        logoEmoji: '⚡',
        priority: 9,
        instructions: [
            '1. Go to https://console.groq.com/signup',
            '2. Sign up with Google or email',
            '3. Go to API Keys section',
            '4. Click "Create API Key"',
            '5. Copy the key and paste it below'
        ]
    },
    {
        id: 'gemini',
        name: 'Google Gemini',
        envVar: 'GEMINI_API_KEY',
        signupUrl: 'https://aistudio.google.com',
        apiKeyUrl: 'https://aistudio.google.com/app/apikey',
        docsUrl: 'https://ai.google.dev/docs',
        freeModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash-exp'],
        freeTier: 'FREE tier: 15 requests/min, 1500 requests/day',
        logoEmoji: '✨',
        priority: 8,
        instructions: [
            '1. Go to https://aistudio.google.com',
            '2. Sign in with your Google account',
            '3. Click "Get API Key" in the left sidebar',
            '4. Click "Create API key"',
            '5. Copy the key and paste it below'
        ]
    },
    {
        id: 'cohere',
        name: 'Cohere',
        envVar: 'COHERE_API_KEY',
        signupUrl: 'https://dashboard.cohere.com/welcome/register',
        apiKeyUrl: 'https://dashboard.cohere.com/api-keys',
        docsUrl: 'https://docs.cohere.com',
        freeModels: ['command-r-plus', 'command-r', 'command-light', 'embed-english-v3.0'],
        freeTier: 'FREE tier: 1000 API calls/month',
        logoEmoji: '🔮',
        priority: 7,
        instructions: [
            '1. Go to https://dashboard.cohere.com/welcome/register',
            '2. Sign up with email or Google',
            '3. Verify your email',
            '4. Go to API Keys in the dashboard',
            '5. Create a new API key and copy it'
        ]
    },
    {
        id: 'deepseek',
        name: 'DeepSeek',
        envVar: 'DEEPSEEK_API_KEY',
        signupUrl: 'https://platform.deepseek.com/sign_up',
        apiKeyUrl: 'https://platform.deepseek.com/api_keys',
        docsUrl: 'https://platform.deepseek.com/api-docs',
        freeModels: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
        freeTier: 'Very cheap: ~$0.14/million tokens (500x cheaper than GPT-4)',
        logoEmoji: '🔍',
        priority: 8,
        instructions: [
            '1. Go to https://platform.deepseek.com/sign_up',
            '2. Sign up with email',
            '3. Verify your email',
            '4. Go to API Keys section',
            '5. Create and copy your API key'
        ]
    },
    {
        id: 'openrouter',
        name: 'OpenRouter',
        envVar: 'OPENROUTER_API_KEY',
        signupUrl: 'https://openrouter.ai/auth',
        apiKeyUrl: 'https://openrouter.ai/keys',
        docsUrl: 'https://openrouter.ai/docs',
        freeModels: ['meta-llama/llama-3.2-3b-instruct:free', 'google/gemma-2-9b-it:free', 'mistralai/mistral-7b-instruct:free'],
        freeTier: 'FREE models available + pay-as-you-go for premium',
        logoEmoji: '🌐',
        priority: 7,
        instructions: [
            '1. Go to https://openrouter.ai',
            '2. Click "Sign In" and use Google/GitHub',
            '3. Go to Keys section',
            '4. Create a new API key',
            '5. Use models with ":free" suffix for free access'
        ]
    },
    {
        id: 'cerebras',
        name: 'Cerebras',
        envVar: 'CEREBRAS_API_KEY',
        signupUrl: 'https://cloud.cerebras.ai/register',
        apiKeyUrl: 'https://cloud.cerebras.ai/platform/org/api-keys',
        docsUrl: 'https://cloud.cerebras.ai/docs',
        freeModels: ['llama3.1-8b', 'llama3.1-70b'],
        freeTier: 'FREE tier available - ultra-fast inference',
        logoEmoji: '🧠',
        priority: 6,
        instructions: [
            '1. Go to https://cloud.cerebras.ai',
            '2. Sign up for an account',
            '3. Navigate to API Keys',
            '4. Generate a new API key',
            '5. Copy and paste it below'
        ]
    },
    {
        id: 'together',
        name: 'Together.ai',
        envVar: 'TOGETHER_API_KEY',
        signupUrl: 'https://api.together.xyz/signup',
        apiKeyUrl: 'https://api.together.xyz/settings/api-keys',
        docsUrl: 'https://docs.together.ai',
        freeModels: ['meta-llama/Llama-3.2-3B-Instruct-Turbo', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
        freeTier: '$5 free credits on signup',
        logoEmoji: '🤝',
        priority: 6,
        instructions: [
            '1. Go to https://api.together.xyz/signup',
            '2. Sign up with Google or email',
            '3. Go to Settings > API Keys',
            '4. Create a new API key',
            '5. Copy your key'
        ]
    },
    {
        id: 'mistral',
        name: 'Mistral AI',
        envVar: 'MISTRAL_API_KEY',
        signupUrl: 'https://console.mistral.ai/',
        apiKeyUrl: 'https://console.mistral.ai/api-keys/',
        docsUrl: 'https://docs.mistral.ai',
        freeModels: ['open-mistral-7b', 'open-mixtral-8x7b'],
        freeTier: 'Free tier with rate limits',
        logoEmoji: '🌪️',
        priority: 6,
        instructions: [
            '1. Go to https://console.mistral.ai',
            '2. Sign up or sign in',
            '3. Navigate to API Keys',
            '4. Create a new API key',
            '5. Copy and save your key'
        ]
    },
    {
        id: 'huggingface',
        name: 'HuggingFace',
        envVar: 'HUGGINGFACE_API_KEY',
        signupUrl: 'https://huggingface.co/join',
        apiKeyUrl: 'https://huggingface.co/settings/tokens',
        docsUrl: 'https://huggingface.co/docs/api-inference',
        freeModels: ['mistralai/Mistral-7B-Instruct-v0.2', 'meta-llama/Llama-2-7b-chat-hf', 'google/flan-t5-large'],
        freeTier: 'FREE inference API (rate limited)',
        logoEmoji: '🤗',
        priority: 5,
        instructions: [
            '1. Go to https://huggingface.co/join',
            '2. Create an account',
            '3. Go to Settings > Access Tokens',
            '4. Create a new token (read access is fine)',
            '5. Copy the token'
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI',
        envVar: 'OPENAI_API_KEY',
        signupUrl: 'https://platform.openai.com/signup',
        apiKeyUrl: 'https://platform.openai.com/api-keys',
        docsUrl: 'https://platform.openai.com/docs',
        freeModels: [],
        freeTier: 'PAID: ~$5 to start, pay-as-you-go',
        logoEmoji: '🤖',
        priority: 4,
        instructions: [
            '1. Go to https://platform.openai.com/signup',
            '2. Create an account',
            '3. Add payment method',
            '4. Go to API Keys section',
            '5. Create a new secret key'
        ]
    },
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        envVar: 'ANTHROPIC_API_KEY',
        signupUrl: 'https://console.anthropic.com/register',
        apiKeyUrl: 'https://console.anthropic.com/settings/keys',
        docsUrl: 'https://docs.anthropic.com',
        freeModels: [],
        freeTier: 'PAID: Pay-as-you-go',
        logoEmoji: '🧬',
        priority: 4,
        instructions: [
            '1. Go to https://console.anthropic.com',
            '2. Create an account',
            '3. Add payment method',
            '4. Go to API Keys',
            '5. Create a new API key'
        ]
    }
];

export class APIKeyManager {
    private configPath: string;
    private keys: Map<string, StoredAPIKey> = new Map();
    private encryptionSecret?: string;

    constructor(configPath?: string) {
        this.configPath = configPath || path.join(process.cwd(), 'config', 'api_keys.json');
        this.encryptionSecret = process.env.API_KEY_ENCRYPTION_SECRET;
    }

    /**
     * Initialize and load stored keys
     */
    async initialize(): Promise<void> {
        await this.load();
        logger.info('API Key Manager initialized', { keysLoaded: this.keys.size });
    }

    /**
     * Get provider info by ID
     */
    getProviderInfo(providerId: string): LLMProviderInfo | undefined {
        return LLM_PROVIDERS.find(p => p.id === providerId);
    }

    /**
     * Get all providers sorted by priority (free first)
     */
    getAllProviders(): LLMProviderInfo[] {
        return [...LLM_PROVIDERS].sort((a, b) => b.priority - a.priority);
    }

    /**
     * Get only free-tier providers
     */
    getFreeProviders(): LLMProviderInfo[] {
        return LLM_PROVIDERS
            .filter(p => p.freeModels.length > 0 || p.id === 'ollama')
            .sort((a, b) => b.priority - a.priority);
    }

    /**
     * Store an API key
     */
    async setKey(providerId: string, key: string, model?: string): Promise<boolean> {
        const provider = this.getProviderInfo(providerId);
        if (!provider) {
            throw new Error(`Unknown provider: ${providerId}`);
        }

        // Store in memory
        this.keys.set(providerId, {
            provider: providerId,
            key: this.encrypt(key),
            addedAt: new Date(),
            model
        });

        // Also set as environment variable for current session
        process.env[provider.envVar] = key;

        // Persist to disk
        await this.save();

        logger.info('API key stored', { provider: providerId });
        return true;
    }

    /**
     * Get an API key
     */
    getKey(providerId: string): string | undefined {
        const stored = this.keys.get(providerId);
        if (stored) {
            return this.decrypt(stored.key);
        }

        // Fallback to environment variable
        const provider = this.getProviderInfo(providerId);
        if (provider) {
            return process.env[provider.envVar];
        }

        return undefined;
    }

    /**
     * Check if provider has a key configured
     */
    hasKey(providerId: string): boolean {
        return !!this.getKey(providerId);
    }

    /**
     * Remove a stored key
     */
    async removeKey(providerId: string): Promise<boolean> {
        const deleted = this.keys.delete(providerId);
        if (deleted) {
            await this.save();
            logger.info('API key removed', { provider: providerId });
        }
        return deleted;
    }

    /**
     * Validate an API key by making a test request
     */
    async validateKey(providerId: string, key?: string): Promise<{ valid: boolean; error?: string }> {
        const apiKey = key || this.getKey(providerId);
        if (!apiKey) {
            return { valid: false, error: 'No API key provided' };
        }

        try {
            const axios = (await import('axios')).default;

            switch (providerId) {
                case 'groq':
                    await axios.get('https://api.groq.com/openai/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    break;
                case 'gemini':
                    await axios.get(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`, {
                        timeout: 5000
                    });
                    break;
                case 'cohere':
                    await axios.get('https://api.cohere.ai/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    break;
                case 'openai':
                    await axios.get('https://api.openai.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    break;
                case 'deepseek':
                    await axios.get('https://api.deepseek.com/v1/models', {
                        headers: { 'Authorization': `Bearer ${apiKey}` },
                        timeout: 5000
                    });
                    break;
                case 'ollama':
                    await axios.get(`${apiKey}/api/tags`, { timeout: 2000 });
                    break;
                default:
                    return { valid: true }; // Can't validate, assume OK
            }

            // Update validation status
            const stored = this.keys.get(providerId);
            if (stored) {
                stored.isValid = true;
                stored.lastUsed = new Date();
            }

            return { valid: true };
        } catch (error: any) {
            return { valid: false, error: error.response?.data?.error?.message || error.message };
        }
    }

    /**
     * Get configured providers (those with keys)
     */
    getConfiguredProviders(): string[] {
        const configured: string[] = [];

        for (const provider of LLM_PROVIDERS) {
            if (this.hasKey(provider.id)) {
                configured.push(provider.id);
            }
        }

        return configured;
    }

    /**
     * Get setup wizard data for a provider
     */
    getSetupWizard(providerId: string): {
        provider: LLMProviderInfo;
        currentStep: number;
        hasKey: boolean;
    } | null {
        const provider = this.getProviderInfo(providerId);
        if (!provider) return null;

        return {
            provider,
            currentStep: 0,
            hasKey: this.hasKey(providerId)
        };
    }

    /**
     * Generate quick setup guide (can be shown in UI)
     */
    generateSetupGuide(): string {
        const lines: string[] = [
            '# 🔑 LLM API Key Setup Guide',
            '',
            '## Recommended Free Providers (in order):',
            ''
        ];

        const freeProviders = this.getFreeProviders();
        for (let i = 0; i < freeProviders.length; i++) {
            const p = freeProviders[i];
            const hasKey = this.hasKey(p.id);
            const status = hasKey ? '✅' : '⬜';

            lines.push(`### ${i + 1}. ${p.logoEmoji} ${p.name} ${status}`);
            lines.push(`**Free tier:** ${p.freeTier}`);
            lines.push(`**Models:** ${p.freeModels.slice(0, 3).join(', ')}`);
            lines.push('');
            lines.push('**Setup:**');
            p.instructions.forEach(inst => lines.push(`   ${inst}`));
            lines.push('');
            lines.push(`🔗 [Sign Up](${p.signupUrl}) | [Get API Key](${p.apiKeyUrl}) | [Docs](${p.docsUrl})`);
            lines.push('');
            lines.push('---');
            lines.push('');
        }

        return lines.join('\n');
    }

    /**
     * Export configuration to .env format
     */
    exportToEnv(): string {
        throw new Error('Plaintext API key export is disabled');
    }

    /**
     * Import from .env file
     */
    async importFromEnv(envContent: string): Promise<number> {
        let imported = 0;
        const lines = envContent.split('\n');

        for (const line of lines) {
            const match = line.match(/^([A-Z_]+)=(.+)$/);
            if (match) {
                const [, varName, value] = match;
                const provider = LLM_PROVIDERS.find(p => p.envVar === varName);
                if (provider) {
                    await this.setKey(provider.id, value.trim());
                    imported++;
                }
            }
        }

        return imported;
    }

    /**
     * Encrypt a key for storage
     */
    private encrypt(text: string): string {
        const iv = crypto.randomBytes(12);
        const key = this.getEncryptionKey();
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        return `v2:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
    }

    /**
     * Decrypt a stored key
     */
    private decrypt(text: string): string {
        const parts = text.split(':');
        const key = this.getEncryptionKey();

        if (parts[0] === 'v2' && parts.length === 4) {
            const [, ivHex, tagHex, encrypted] = parts;
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
            decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }

        if (parts.length === 2) {
            const [ivHex, encrypted] = parts;
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivHex, 'hex'));
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }

        throw new Error('Stored API key is not encrypted');
    }

    private getEncryptionKey(): Buffer {
        if (!this.encryptionSecret || this.encryptionSecret.length < 32 || this.encryptionSecret === 'default-key-change-me') {
            throw new Error('API_KEY_ENCRYPTION_SECRET must be configured with at least 32 characters before storing API keys');
        }

        return crypto.createHash('sha256').update(this.encryptionSecret).digest();
    }

    /**
     * Save keys to disk
     */
    private async save(): Promise<void> {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const data = Object.fromEntries(this.keys);
            fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2));
        } catch (error) {
            logger.warn('Failed to save API keys', { error });
        }
    }

    /**
     * Load keys from disk
     */
    private async load(): Promise<void> {
        try {
            if (!fs.existsSync(this.configPath)) {
                return;
            }

            const content = fs.readFileSync(this.configPath, 'utf-8');
            const data = JSON.parse(content);

            for (const [key, value] of Object.entries(data)) {
                this.keys.set(key, value as StoredAPIKey);

                // Also set environment variables
                const provider = this.getProviderInfo(key);
                if (provider && (value as StoredAPIKey).key) {
                    process.env[provider.envVar] = this.decrypt((value as StoredAPIKey).key);
                }
            }
        } catch (error) {
            logger.warn('Failed to load API keys', { error });
        }
    }

    /**
     * Get stats
     */
    getStats(): {
        totalProviders: number;
        configuredProviders: number;
        freeProviders: number;
        paidProviders: number;
    } {
        const configured = this.getConfiguredProviders();
        const free = configured.filter(id => {
            const p = this.getProviderInfo(id);
            return p && p.freeModels.length > 0;
        });

        return {
            totalProviders: LLM_PROVIDERS.length,
            configuredProviders: configured.length,
            freeProviders: free.length,
            paidProviders: configured.length - free.length
        };
    }
}

// Default instance
export const apiKeyManager = new APIKeyManager();
