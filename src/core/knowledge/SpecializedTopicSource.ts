/**
 * Specialized Topic Source - Curated knowledge on specific topics
 * Topics: Civil Rights, Compliance Industry, Hip Hop History, Connecticut History
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export type SpecializedTopic = 'civil_rights' | 'compliance' | 'hip_hop_history' | 'connecticut_history' | 'all';

export class SpecializedTopicSource implements KnowledgeSource {
  name = 'specialized_topics';
  private topic: SpecializedTopic;

  // Curated data sources for each topic
  private topicSources: Record<SpecializedTopic, Array<{ name: string; url: string; description: string }>> = {
    civil_rights: [
      { name: 'National Archives - Civil Rights', url: 'https://www.archives.gov/research/african-americans', description: 'Official civil rights records' },
      { name: 'Library of Congress - Civil Rights', url: 'https://www.loc.gov/collections/civil-rights-history-project', description: 'Civil rights oral histories' },
      { name: 'Smithsonian - Civil Rights', url: 'https://nmaahc.si.edu/explore/initiatives/civil-rights-history-project', description: 'Civil rights collections' },
      { name: 'Stanford - King Papers', url: 'https://kinginstitute.stanford.edu', description: 'Martin Luther King Jr. papers' },
    ],
    compliance: [
      { name: 'SEC Compliance', url: 'https://www.sec.gov/compliance', description: 'SEC compliance resources' },
      { name: 'FINRA Compliance', url: 'https://www.finra.org/rules-guidance', description: 'FINRA compliance rules' },
      { name: 'HIPAA Compliance', url: 'https://www.hhs.gov/hipaa', description: 'HIPAA compliance information' },
      { name: 'GDPR Compliance', url: 'https://gdpr.eu', description: 'GDPR compliance resources' },
      { name: 'Compliance Institute', url: 'https://www.complianceinstitute.org', description: 'Compliance industry resources' },
    ],
    hip_hop_history: [
      { name: 'Hip Hop Archive - Harvard', url: 'https://hiphoparchive.org', description: 'Hip hop history archive' },
      { name: 'Smithsonian - Hip Hop', url: 'https://nmaahc.si.edu/explore/initiatives/hip-hop-collection', description: 'Hip hop collections' },
      { name: 'Library of Congress - Hip Hop', url: 'https://www.loc.gov/collections/hip-hop', description: 'Hip hop recordings' },
      { name: 'Hip Hop Database', url: 'https://www.hiphopdatabase.com', description: 'Hip hop history database' },
    ],
    connecticut_history: [
      { name: 'Connecticut State Library', url: 'https://ctstatelibrary.org', description: 'Connecticut historical records' },
      { name: 'Connecticut History', url: 'https://connecticuthistory.org', description: 'Connecticut history articles' },
      { name: 'Yale - Connecticut History', url: 'https://guides.library.yale.edu/connecticut-history', description: 'Connecticut history resources' },
      { name: 'Library of Congress - Connecticut', url: 'https://www.loc.gov/search/?q=connecticut+history', description: 'LOC Connecticut collections' },
    ],
    all: [],
  };

  constructor(topic: SpecializedTopic = 'all') {
    this.topic = topic;
  }

  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }

  async search(query: string, options: { limit?: number; topic?: SpecializedTopic } = {}): Promise<KnowledgeResult[]> {
    const { limit = 10, topic = this.topic } = options;
    const results: KnowledgeResult[] = [];

    try {
      const topicsToSearch: SpecializedTopic[] = topic === 'all'
        ? ['civil_rights', 'compliance', 'hip_hop_history', 'connecticut_history']
        : [topic];

      for (const searchTopic of topicsToSearch) {
        // Search curated sources
        const topicResults = await this.searchTopic(query, searchTopic, limit);
        results.push(...topicResults);

        // Also search general sources with topic-specific queries
        const enhancedQuery = this.enhanceQueryForTopic(query, searchTopic);
        const generalResults = await this.searchGeneralSources(enhancedQuery, searchTopic, limit);
        results.push(...generalResults);
      }

      return results.slice(0, limit);
    } catch (error: any) {
      logger.error('Specialized topic search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      // ID format: topic_sourcename or wiki_topic_query or loc_topic_id
      const parts = id.split('_');

      if (parts[0] === 'wiki') {
        // It's a Wikipedia reference
        const topic = parts[1] as SpecializedTopic;
        const query = parts.slice(2).join('_');

        const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        try {
          const response = await axios.get(wikiUrl);
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
          // Continue to fallback
        }
      }

      if (parts[0] === 'loc') {
        // It's a Library of Congress reference
        const topic = parts[1] as SpecializedTopic;
        return {
          id,
          title: `Library of Congress: ${parts.slice(2).join(' ')}`,
          content: 'Library of Congress resource. Visit loc.gov for full content.',
          source: 'library_of_congress',
          url: `https://www.loc.gov/item/${parts.slice(2).join('/')}/`,
          metadata: { topic },
          confidence: 0.8
        };
      }

      // It's a curated source reference
      const topic = parts[0] as SpecializedTopic;
      const sourceName = parts.slice(1).join('_').replace(/_/g, ' ');

      const sources = this.topicSources[topic] || [];
      const matchedSource = sources.find(s =>
        s.name.toLowerCase().includes(sourceName.toLowerCase())
      );

      if (matchedSource) {
        return {
          id,
          title: matchedSource.name,
          content: matchedSource.description,
          source: `specialized_${topic}`,
          url: matchedSource.url,
          metadata: { topic, sourceName: matchedSource.name },
          confidence: 0.9
        };
      }

      return null;
    } catch (error: any) {
      logger.warn('Failed to get specialized topic by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Search topic-specific curated sources
   */
  private async searchTopic(query: string, topic: SpecializedTopic, limit: number): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];
    const sources = this.topicSources[topic] || [];

    for (const source of sources.slice(0, limit)) {
      try {
        // Try to fetch content from source
        const content = await this.fetchFromSource(source.url, query);

        results.push({
          id: `${topic}_${source.name.replace(/\s+/g, '_')}`,
          title: `${source.name}: ${query}`,
          content: content || source.description,
          source: `specialized_${topic}`,
          url: source.url,
          metadata: {
            topic,
            sourceName: source.name,
          },
          confidence: 0.9,
        });
      } catch (error: any) {
        logger.warn('Failed to fetch from source', { source: source.name, error: error.message });
      }
    }

    return results;
  }

  /**
   * Search general sources with topic enhancement
   */
  private async searchGeneralSources(query: string, topic: SpecializedTopic, limit: number): Promise<KnowledgeResult[]> {
    const results: KnowledgeResult[] = [];

    try {
      // Search Wikipedia with topic-specific query
      const wikiQuery = this.enhanceQueryForTopic(query, topic);
      const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`;

      try {
        const wikiResponse = await axios.get(wikiUrl);
        const wiki = wikiResponse.data;

        results.push({
          id: `wiki_${topic}_${wikiQuery}`,
          title: wiki.title,
          content: wiki.extract || '',
          source: 'wikipedia',
          url: wiki.content_urls?.desktop?.page,
          metadata: { topic },
          confidence: 0.85,
        });
      } catch {
        // Wikipedia page not found, continue
      }

      // Search Library of Congress
      try {
        const locUrl = `https://www.loc.gov/search/?q=${encodeURIComponent(query)}&fo=json&c=5`;
        const locResponse = await axios.get(locUrl);
        const locItems = locResponse.data.results || [];

        for (const item of locItems.slice(0, 3)) {
          results.push({
            id: `loc_${topic}_${item.url?.split('/').pop()}`,
            title: item.title || item.item?.title || '',
            content: item.description || item.item?.description || '',
            source: 'library_of_congress',
            url: item.url || item.item?.url,
            metadata: { topic },
            confidence: 0.9,
          });
        }
      } catch {
        // LOC search failed, continue
      }

    } catch (error: any) {
      logger.warn('General source search failed', { topic, error: error.message });
    }

    return results;
  }

  /**
   * Enhance query for specific topic
   */
  private enhanceQueryForTopic(query: string, topic: SpecializedTopic): string {
    const enhancements: Record<SpecializedTopic, string> = {
      civil_rights: `${query} civil rights movement`,
      compliance: `${query} compliance industry regulations`,
      hip_hop_history: `${query} hip hop history rap music`,
      connecticut_history: `${query} Connecticut history`,
      all: query,
    };

    return enhancements[topic] || query;
  }

  /**
   * Fetch content from a source URL
   */
  private async fetchFromSource(url: string, query: string): Promise<string> {
    try {
      // Try to fetch and extract content
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
        timeout: 5000,
      });

      // Basic content extraction (would be enhanced with proper HTML parsing)
      return `Content from ${url} related to "${query}". Visit the source for detailed information.`;
    } catch {
      return '';
    }
  }

  /**
   * Get curated knowledge base for a topic
   */
  getCuratedSources(topic: SpecializedTopic): Array<{ name: string; url: string; description: string }> {
    return this.topicSources[topic] || [];
  }
}

