/**
 * Reddit Knowledge Source - Fetch information from Reddit
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class RedditSource implements KnowledgeSource {
  name = 'reddit';
  private baseUrl = 'https://www.reddit.com';

  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/r/test.json`, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { subreddit?: string; limit?: number; sort?: 'relevance' | 'hot' | 'top' | 'new' } = {}): Promise<KnowledgeResult[]> {
    try {
      const { subreddit, limit = 10, sort = 'relevance' } = options;
      
      let url: string;
      if (subreddit) {
        // Search within specific subreddit
        url = `${this.baseUrl}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=${sort}`;
      } else {
        // Search across all Reddit
        url = `${this.baseUrl}/search.json?q=${encodeURIComponent(query)}&limit=${limit}&sort=${sort}`;
      }

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
      });

      const posts = response.data.data?.children || [];
      const results: KnowledgeResult[] = [];

      for (const post of posts) {
        const data = post.data;
        if (!data) continue;

        const content = `${data.title}\n\n${data.selftext || ''}`.trim();
        if (!content) continue;

        results.push({
          id: `reddit_${data.id}`,
          title: data.title,
          content: content.substring(0, 2000), // Limit content
          source: 'reddit',
          url: `${this.baseUrl}${data.permalink}`,
          metadata: {
            subreddit: data.subreddit,
            author: data.author,
            score: data.score,
            numComments: data.num_comments,
            created: new Date(data.created_utc * 1000).toISOString(),
            upvoteRatio: data.upvote_ratio,
          },
          confidence: this.calculateConfidence(data),
        });
      }

      return results;
    } catch (error: any) {
      logger.error('Reddit search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    try {
      const postId = id.replace('reddit_', '');
      const url = `${this.baseUrl}/api/info.json?id=t3_${postId}`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'KnowledgeBot/1.0',
        },
      });

      const post = response.data.data?.children?.[0]?.data;
      if (!post) return null;

      const content = `${post.title}\n\n${post.selftext || ''}`.trim();

      return {
        id,
        title: post.title,
        content: content.substring(0, 5000),
        source: 'reddit',
        url: `${this.baseUrl}${post.permalink}`,
        metadata: {
          subreddit: post.subreddit,
          author: post.author,
          score: post.score,
          numComments: post.num_comments,
          created: new Date(post.created_utc * 1000).toISOString(),
        },
        confidence: this.calculateConfidence(post),
      };
    } catch (error: any) {
      logger.warn('Failed to fetch Reddit post by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Calculate confidence based on post quality
   */
  private calculateConfidence(post: any): number {
    let confidence = 0.5; // Base confidence

    // Higher score = more reliable
    if (post.score > 100) confidence += 0.2;
    else if (post.score > 10) confidence += 0.1;

    // More comments = more discussion = potentially more reliable
    if (post.num_comments > 50) confidence += 0.1;
    else if (post.num_comments > 10) confidence += 0.05;

    // Higher upvote ratio = more agreement
    if (post.upvote_ratio > 0.9) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

