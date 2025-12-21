/**
 * YouTube Knowledge Source - Extract knowledge from YouTube videos
 */

import axios from 'axios';
import { KnowledgeSource, KnowledgeResult } from './KnowledgeSource';
import { logger } from '../observability/logger';

export class YouTubeSource implements KnowledgeSource {
  name = 'youtube';
  private apiKey?: string;
  private baseUrl = 'https://www.googleapis.com/youtube/v3';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.YOUTUBE_API_KEY;
  }

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      logger.warn('YouTube API key not provided');
      return false;
    }
    try {
      const response = await axios.get(`${this.baseUrl}/search?part=snippet&q=test&key=${this.apiKey}&maxResults=1`, { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  async search(query: string, options: { limit?: number; maxResults?: number } = {}): Promise<KnowledgeResult[]> {
    if (!this.apiKey) {
      logger.warn('YouTube API key required for search');
      return [];
    }

    try {
      const maxResults = options.limit || options.maxResults || 10;
      const url = `${this.baseUrl}/search?part=snippet&q=${encodeURIComponent(query)}&key=${this.apiKey}&maxResults=${maxResults}&type=video`;

      const response = await axios.get(url);
      const videos = response.data.items || [];

      const results: KnowledgeResult[] = [];

      for (const video of videos) {
        const snippet = video.snippet;
        if (!snippet) continue;

        // Get video details for description
        try {
          const detailsUrl = `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${video.id.videoId}&key=${this.apiKey}`;
          const detailsResponse = await axios.get(detailsUrl);
          const videoDetails = detailsResponse.data.items?.[0];

          const description = videoDetails?.snippet?.description || snippet.description || '';
          const content = `${snippet.title}\n\n${description}`.substring(0, 2000);

          results.push({
            id: `youtube_${video.id.videoId}`,
            title: snippet.title,
            content,
            source: 'youtube',
            url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            metadata: {
              channelId: snippet.channelId,
              channelTitle: snippet.channelTitle,
              publishedAt: snippet.publishedAt,
              viewCount: videoDetails?.statistics?.viewCount,
              likeCount: videoDetails?.statistics?.likeCount,
              duration: videoDetails?.contentDetails?.duration,
              thumbnail: snippet.thumbnails?.high?.url,
            },
            confidence: this.calculateConfidence(videoDetails),
          });
        } catch (error: any) {
          logger.warn('Failed to fetch YouTube video details', { videoId: video.id.videoId, error: error.message });
        }
      }

      return results;
    } catch (error: any) {
      logger.error('YouTube search failed', { error: error.message });
      return [];
    }
  }

  async getById(id: string): Promise<KnowledgeResult | null> {
    if (!this.apiKey) return null;

    try {
      const videoId = id.replace('youtube_', '');
      const url = `${this.baseUrl}/videos?part=snippet,statistics,contentDetails&id=${videoId}&key=${this.apiKey}`;
      const response = await axios.get(url);

      const video = response.data.items?.[0];
      if (!video) return null;

      const snippet = video.snippet;
      const content = `${snippet.title}\n\n${snippet.description || ''}`.substring(0, 5000);

      return {
        id,
        title: snippet.title,
        content,
        source: 'youtube',
        url: `https://www.youtube.com/watch?v=${videoId}`,
        metadata: {
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle,
          publishedAt: snippet.publishedAt,
          viewCount: video.statistics?.viewCount,
          likeCount: video.statistics?.likeCount,
          duration: video.contentDetails?.duration,
        },
        confidence: this.calculateConfidence(video),
      };
    } catch (error: any) {
      logger.warn('Failed to fetch YouTube video by ID', { id, error: error.message });
      return null;
    }
  }

  /**
   * Calculate confidence based on video quality
   */
  private calculateConfidence(video: any): number {
    if (!video) return 0.5;

    let confidence = 0.5;

    // More views = potentially more reliable
    const viewCount = parseInt(video.statistics?.viewCount || '0');
    if (viewCount > 100000) confidence += 0.2;
    else if (viewCount > 10000) confidence += 0.1;

    // Higher like ratio = better quality
    const likeCount = parseInt(video.statistics?.likeCount || '0');
    const likeRatio = viewCount > 0 ? likeCount / viewCount : 0;
    if (likeRatio > 0.05) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

