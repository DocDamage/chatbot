/**
 * Base Knowledge Source - Provides common functionality for knowledge sources
 * Includes default getById implementation using search
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

/**
 * Abstract base class for knowledge sources with common utilities
 */
export abstract class BaseKnowledgeSource implements KnowledgeSource {
    abstract name: string;
    protected cache: Map<string, { result: KnowledgeResult; timestamp: number }> = new Map();
    protected readonly CACHE_TTL = 3600000; // 1 hour

    abstract isAvailable(): Promise<boolean>;
    abstract search(query: string, options?: any): Promise<KnowledgeResult[]>;

    /**
     * Default getById implementation - tries to find in cache first,
     * then searches using the ID as a query
     */
    async getById(id: string): Promise<KnowledgeResult | null> {
        // Check cache first
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }

        try {
            // Try to extract meaningful query from ID
            const query = this.idToQuery(id);
            const results = await this.search(query, { limit: 1 });

            if (results.length > 0) {
                // Update ID to match requested ID
                const result = { ...results[0], id };
                this.cache.set(id, { result, timestamp: Date.now() });
                return result;
            }

            return null;
        } catch (error: any) {
            logger.warn(`Failed to get ${this.name} item by ID`, { id, error: error.message });
            return null;
        }
    }

    /**
     * Convert ID to search query - override in subclasses for custom behavior
     */
    protected idToQuery(id: string): string {
        // Remove source prefix if present
        const withoutPrefix = id.replace(new RegExp(`^${this.name}_`), '');
        // Replace underscores with spaces
        return withoutPrefix.replace(/_/g, ' ').trim();
    }

    /**
     * Cache a result
     */
    protected cacheResult(id: string, result: KnowledgeResult): void {
        this.cache.set(id, { result, timestamp: Date.now() });
    }

    /**
     * Get from cache
     */
    protected getFromCache(id: string): KnowledgeResult | null {
        const cached = this.cache.get(id);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.result;
        }
        return null;
    }

    /**
     * Clear cache
     */
    clearCache(): void {
        this.cache.clear();
    }

    /**
     * Make an HTTP request with error handling
     */
    protected async fetchUrl(
        url: string,
        options: {
            timeout?: number;
            headers?: Record<string, string>;
        } = {}
    ): Promise<any> {
        const response = await axios.get(url, {
            timeout: options.timeout || 10000,
            headers: options.headers
        });
        return response.data;
    }

    /**
     * Calculate confidence score based on common metrics
     */
    protected calculateConfidence(metrics: {
        hasContent?: boolean;
        contentLength?: number;
        hasMetadata?: boolean;
        isVerified?: boolean;
        popularity?: number; // 0-1
        recency?: number; // days since update
    }): number {
        let confidence = 0.5;

        if (metrics.hasContent) confidence += 0.1;
        if (metrics.contentLength && metrics.contentLength > 500) confidence += 0.1;
        if (metrics.hasMetadata) confidence += 0.05;
        if (metrics.isVerified) confidence += 0.2;
        if (metrics.popularity && metrics.popularity > 0.5) confidence += 0.1;
        if (metrics.recency !== undefined && metrics.recency < 30) confidence += 0.05;

        return Math.min(confidence, 1.0);
    }

    /**
     * Strip HTML tags from content
     */
    protected stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Truncate content to specified length
     */
    protected truncate(content: string, maxLength: number = 3000): string {
        if (content.length <= maxLength) return content;
        return content.substring(0, maxLength) + '...';
    }
}

export default BaseKnowledgeSource;
