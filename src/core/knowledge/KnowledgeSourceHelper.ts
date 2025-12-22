/**
 * Knowledge Source Helper - Shared getById implementation for curated topic sources
 * This provides a standard implementation that can be used by all domain-specific sources
 */

import axios from 'axios';
import { KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export interface CuratedSource {
    name: string;
    url: string;
    description: string;
}

/**
 * Standard getById implementation for topic-based sources
 * Works with sources that have:
 * - Wikipedia results (id format: {topic}_wiki_{query})
 * - Curated sources (id format: {topic}_{sourceName})
 */
export async function getByIdForTopicSource(
    id: string,
    topic: string,
    curatedSources: CuratedSource[]
): Promise<KnowledgeResult | null> {
    try {
        // Check if it's a Wikipedia result
        if (id.includes('_wiki_')) {
            const query = id.split('_wiki_')[1].replace(/_/g, ' ');
            const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

            try {
                const response = await axios.get(wikiUrl, { timeout: 5000 });
                const wiki = response.data;

                return {
                    id,
                    title: wiki.title,
                    content: wiki.extract || '',
                    source: 'wikipedia',
                    url: wiki.content_urls?.desktop?.page,
                    metadata: { topic },
                    confidence: 0.85
                };
            } catch {
                // Try without topic suffix
                const baseQuery = query.replace(` ${topic}`, '');
                const fallbackUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(baseQuery)}`;

                try {
                    const response = await axios.get(fallbackUrl, { timeout: 5000 });
                    const wiki = response.data;

                    return {
                        id,
                        title: wiki.title,
                        content: wiki.extract || '',
                        source: 'wikipedia',
                        url: wiki.content_urls?.desktop?.page,
                        metadata: { topic },
                        confidence: 0.8
                    };
                } catch {
                    return null;
                }
            }
        }

        // Check if it's a curated source
        const sourceName = id.replace(`${topic}_`, '').replace(/_/g, ' ');
        const matchedSource = curatedSources.find(s =>
            s.name.toLowerCase().includes(sourceName.toLowerCase()) ||
            sourceName.toLowerCase().includes(s.name.toLowerCase())
        );

        if (matchedSource) {
            return {
                id,
                title: matchedSource.name,
                content: matchedSource.description,
                source: topic,
                url: matchedSource.url,
                metadata: { sourceName: matchedSource.name },
                confidence: 0.9
            };
        }

        return null;
    } catch (error: any) {
        logger.warn(`Failed to get ${topic} item by ID`, { id, error: error.message });
        return null;
    }
}

/**
 * Create getById function for a topic source
 */
export function createTopicGetById(topic: string, curatedSources: CuratedSource[]) {
    return async function getById(id: string): Promise<KnowledgeResult | null> {
        return getByIdForTopicSource(id, topic, curatedSources);
    };
}

export default { getByIdForTopicSource, createTopicGetById };
