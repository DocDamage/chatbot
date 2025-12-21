/**
 * Collaborative Filter - Learn from similar users
 * Research: Stanford BookBuddy, Collaborative Filtering
 */

import { UserProfiler, UserProfile } from './UserProfiler';
import { logger } from '../observability/logger';

export interface SimilarUser {
  userId: string;
  similarity: number;
  sharedPreferences: string[];
}

export class CollaborativeFilter {
  private profiler: UserProfiler;

  constructor(profiler: UserProfiler) {
    this.profiler = profiler;
  }

  /**
   * Find similar users
   */
  findSimilarUsers(userId: string, topK: number = 5): SimilarUser[] {
    const userProfile = this.profiler.getProfile(userId);
    const allProfiles = Array.from((this.profiler as any).profiles.values())
      .filter((p: UserProfile) => p.userId !== userId);

    const similarities = allProfiles.map(profile => ({
      userId: profile.userId,
      similarity: this.calculateSimilarity(userProfile, profile),
      sharedPreferences: this.getSharedPreferences(userProfile, profile)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get recommendations based on similar users
   */
  getRecommendations(userId: string, topK: number = 5): {
    topics: string[];
    style: string;
    responseLength: string;
  } {
    const similarUsers = this.findSimilarUsers(userId, topK);
    
    if (similarUsers.length === 0) {
      return {
        topics: [],
        style: 'friendly',
        responseLength: 'medium'
      };
    }

    // Aggregate preferences from similar users
    const topicCounts = new Map<string, number>();
    const styleCounts = new Map<string, number>();
    const lengthCounts = new Map<string, number>();

    for (const similar of similarUsers) {
      const profile = this.profiler.getProfile(similar.userId);
      
      // Weight by similarity
      const weight = similar.similarity;

      for (const topic of profile.preferences.topics) {
        topicCounts.set(topic, (topicCounts.get(topic) || 0) + weight);
      }

      styleCounts.set(
        profile.preferences.communicationStyle,
        (styleCounts.get(profile.preferences.communicationStyle) || 0) + weight
      );

      lengthCounts.set(
        profile.preferences.responseLength,
        (lengthCounts.get(profile.preferences.responseLength) || 0) + weight
      );
    }

    // Get top recommendations
    const topTopics = Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic]) => topic);

    const topStyle = Array.from(styleCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'friendly';

    const topLength = Array.from(lengthCounts.entries())
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'medium';

    logger.debug('Recommendations generated', {
      userId,
      topicsCount: topTopics.length,
      style: topStyle
    });

    return {
      topics: topTopics,
      style: topStyle,
      responseLength: topLength
    };
  }

  /**
   * Calculate similarity between two profiles
   */
  private calculateSimilarity(profile1: UserProfile, profile2: UserProfile): number {
    let similarity = 0;
    let factors = 0;

    // Communication style match
    if (profile1.preferences.communicationStyle === profile2.preferences.communicationStyle) {
      similarity += 0.3;
    }
    factors += 0.3;

    // Response length match
    if (profile1.preferences.responseLength === profile2.preferences.responseLength) {
      similarity += 0.2;
    }
    factors += 0.2;

    // Topic overlap
    const topicOverlap = this.calculateTopicOverlap(
      profile1.preferences.topics,
      profile2.preferences.topics
    );
    similarity += topicOverlap * 0.3;
    factors += 0.3;

    // Intent overlap
    const intentOverlap = this.calculateIntentOverlap(
      profile1.behavior.commonIntents,
      profile2.behavior.commonIntents
    );
    similarity += intentOverlap * 0.2;
    factors += 0.2;

    return factors > 0 ? similarity / factors : 0;
  }

  /**
   * Calculate topic overlap
   */
  private calculateTopicOverlap(topics1: string[], topics2: string[]): number {
    if (topics1.length === 0 && topics2.length === 0) return 1.0;
    if (topics1.length === 0 || topics2.length === 0) return 0;

    const set1 = new Set(topics1);
    const set2 = new Set(topics2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Calculate intent overlap
   */
  private calculateIntentOverlap(intents1: string[], intents2: string[]): number {
    return this.calculateTopicOverlap(intents1, intents2);
  }

  /**
   * Get shared preferences
   */
  private getSharedPreferences(profile1: UserProfile, profile2: UserProfile): string[] {
    const shared: string[] = [];

    if (profile1.preferences.communicationStyle === profile2.preferences.communicationStyle) {
      shared.push(`style:${profile1.preferences.communicationStyle}`);
    }
    if (profile1.preferences.responseLength === profile2.preferences.responseLength) {
      shared.push(`length:${profile1.preferences.responseLength}`);
    }

    const sharedTopics = profile1.preferences.topics.filter(t => 
      profile2.preferences.topics.includes(t)
    );
    shared.push(...sharedTopics);

    return shared;
  }
}

