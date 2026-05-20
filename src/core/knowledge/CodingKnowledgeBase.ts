/**
 * Coding Knowledge Base
 * Hybrid static/vector knowledge base for coding assistance
 */

import * as fs from 'fs';
import * as path from 'path';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';
import { StaticKnowledgeEntry } from './KnowledgeExtractor';

export interface KnowledgeResult {
    entry: StaticKnowledgeEntry;
    score: number;
}

export interface CodingKnowledgeBaseOptions {
    staticDataPath?: string;
    userDataPath?: string;
    embeddingCachePath?: string;
    project?: string;
}

interface EmbeddingCacheFile {
    version: number;
    fingerprint: string;
    dimensions: number;
    embeddings: number[][];
}

export class CodingKnowledgeBase {
    private staticDataPath: string;
    private userDataPath: string;
    private embeddingCachePath: string;
    private project: string;
    private embeddingService: EmbeddingService;

    private entries: StaticKnowledgeEntry[] = [];
    private embeddings: number[][] = [];
    private isInitialized: boolean = false;

    constructor(embeddingService: EmbeddingService, options: CodingKnowledgeBaseOptions = {}) {
        this.embeddingService = embeddingService;
        this.staticDataPath = options.staticDataPath || path.resolve(process.cwd(), 'src/data/coding_knowledge_static.json');
        this.userDataPath = options.userDataPath || path.resolve(process.cwd(), 'src/data/coding_knowledge_user.json');
        this.embeddingCachePath = options.embeddingCachePath || path.resolve(process.cwd(), 'data/coding_knowledge_embeddings.json');
        this.project = options.project || 'chatbot';
    }

    /**
     * Initialize the knowledge base
     * Loads data and ensures embeddings exist
     */
    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // Load static data
            if (fs.existsSync(this.staticDataPath)) {
                const staticData = JSON.parse(fs.readFileSync(this.staticDataPath, 'utf-8'));
                this.entries.push(...staticData);
                logger.info('Loaded static coding knowledge', { count: staticData.length });
            }

            // Load user data
            if (fs.existsSync(this.userDataPath)) {
                const userData = JSON.parse(fs.readFileSync(this.userDataPath, 'utf-8'));
                this.entries.push(...userData);
                logger.info('Loaded user coding knowledge', { count: userData.length });
            }

            this.applyDefaultMetadata();

            const cached = this.loadEmbeddingCache();
            if (cached) {
                this.embeddings = cached;
                logger.info('Loaded cached coding knowledge embeddings', { count: cached.length });
            } else {
                await this.generateEmbeddings();
                this.persistEmbeddingCache();
            }

            this.isInitialized = true;
            logger.info('CodingKnowledgeBase initialized', { totalEntries: this.entries.length });
        } catch (error: any) {
            logger.error('Failed to initialize CodingKnowledgeBase', { error: error.message });
            throw error;
        }
    }

    /**
     * Search for coding knowledge
     */
    async search(query: string, options: { limit?: number; category?: string; minScore?: number } = {}): Promise<KnowledgeResult[]> {
        if (!this.isInitialized) await this.initialize();

        const { limit = 5, category, minScore = 0.7 } = options;

        try {
            const queryEmbedding = await this.embeddingService.embed(query);
            const results: KnowledgeResult[] = [];

            for (let i = 0; i < this.entries.length; i++) {
                const entry = this.entries[i];

                // Filter by category if requested
                if (category && entry.category !== category.toLowerCase()) continue;

                const score = this.cosineSimilarity(queryEmbedding, this.embeddings[i]);

                if (score >= minScore) {
                    results.push({ entry, score });
                }
            }

            return results
                .sort((a, b) => b.score - a.score)
                .slice(0, limit);

        } catch (error: any) {
            logger.error('Knowledge search failed', { query, error: error.message });
            return [];
        }
    }

    /**
     * Add new knowledge (Auto-learning)
     */
    async addSnippet(
        title: string,
        content: string,
        category: string = 'general',
        tags: string[] = []
    ): Promise<StaticKnowledgeEntry> {
        const entry: StaticKnowledgeEntry = {
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            category,
            title,
            content,
            tags: [...tags, 'user-generated'],
            source: 'user',
            metadata: {
                project: this.project,
                sourceType: 'past-fix',
                authority: 'learned'
            }
        };

        // Add to memory
        this.entries.push(entry);

        // Add embedding
        const text = `${title}\n${category}\n${entry.tags.join(' ')}\n${content.substring(0, 1000)}`;
        const embedding = await this.embeddingService.embed(text);
        this.embeddings.push(embedding);

        // Save to disk
        await this.persistUserData();
        this.persistEmbeddingCache();

        logger.info('Added new coding knowledge snippet', { title, category });
        return entry;
    }

    /**
     * Get knowledge by specific category
     */
    getByCategory(category: string): StaticKnowledgeEntry[] {
        return this.entries.filter(e => e.category === category);
    }

    /**
     * Persist user data to JSON file
     */
    private async persistUserData(): Promise<void> {
        const userEntries = this.entries.filter(e => e.source === 'user' || e.tags.includes('user-generated'));
        fs.writeFileSync(this.userDataPath, JSON.stringify(userEntries, null, 2));
    }

    private applyDefaultMetadata(): void {
        this.entries = this.entries.map(entry => ({
            ...entry,
            metadata: {
                project: this.project,
                sourceType: entry.source === 'user' ? 'past-fix' : 'external',
                authority: entry.source === 'user' ? 'learned' : 'external',
                ...entry.metadata
            }
        }));
    }

    private async generateEmbeddings(): Promise<void> {
        logger.info('Generating embeddings for knowledge base...');

        const batchSize = 10;
        for (let i = 0; i < this.entries.length; i += batchSize) {
            const batch = this.entries.slice(i, i + batchSize);
            const batchTexts = batch.map(e => `${e.title}\n${e.category}\n${e.tags.join(' ')}\n${e.content.substring(0, 1000)}`);

            try {
                const batchEmbeddings = await this.embeddingService.embedBatch(batchTexts);
                this.embeddings.push(...batchEmbeddings);
            } catch (error) {
                logger.warn('Failed to embed batch', { start: i, error });
                const dim = this.embeddingService.getDimensions();
                this.embeddings.push(...Array(batch.length).fill(Array(dim).fill(0)));
            }
        }
    }

    private loadEmbeddingCache(): number[][] | undefined {
        if (!fs.existsSync(this.embeddingCachePath)) return undefined;

        try {
            const cache = JSON.parse(fs.readFileSync(this.embeddingCachePath, 'utf-8')) as EmbeddingCacheFile;
            if (
                cache.version === 1 &&
                cache.fingerprint === this.fingerprintEntries() &&
                cache.dimensions === this.embeddingService.getDimensions() &&
                cache.embeddings.length === this.entries.length
            ) {
                return cache.embeddings;
            }
        } catch (error: any) {
            logger.warn('Failed to load coding knowledge embedding cache', { error: error.message });
        }

        return undefined;
    }

    private persistEmbeddingCache(): void {
        try {
            fs.mkdirSync(path.dirname(this.embeddingCachePath), { recursive: true });
            const cache: EmbeddingCacheFile = {
                version: 1,
                fingerprint: this.fingerprintEntries(),
                dimensions: this.embeddingService.getDimensions(),
                embeddings: this.embeddings
            };
            fs.writeFileSync(this.embeddingCachePath, JSON.stringify(cache));
        } catch (error: any) {
            logger.warn('Failed to persist coding knowledge embedding cache', { error: error.message });
        }
    }

    private fingerprintEntries(): string {
        return JSON.stringify(this.entries.map(entry => ({
            id: entry.id,
            title: entry.title,
            category: entry.category,
            content: entry.content,
            tags: entry.tags,
            source: entry.source,
            metadata: entry.metadata
        })));
    }

    /**
     * Calculate Cosine Similarity
     */
    private cosineSimilarity(vecA: number[], vecB: number[]): number {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
