/**
 * User Profiler - Build detailed user models
 * Research: Stanford BookBuddy, MIT Personalization Lab
 */

import { logger } from '../observability/logger';

export interface UserProfile {
  userId: string;
  preferences: {
    communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
    responseLength: 'short' | 'medium' | 'long';
    topics: string[];
    language?: string;
  };
  behavior: {
    averageSessionLength: number;
    preferredTimeOfDay: string[];
    interactionFrequency: number;
    commonIntents: string[];
  };
  history: {
    totalInteractions: number;
    firstSeen: Date;
    lastSeen: Date;
    satisfactionScore: number; // 0-1
  };
  metadata: Record<string, any>;
}

export class UserProfiler {
  private profiles: Map<string, UserProfile> = new Map();

  /**
   * Get or create user profile
   */
  getProfile(userId: string): UserProfile {
    if (!this.profiles.has(userId)) {
      this.profiles.set(userId, this.createDefaultProfile(userId));
    }
    return this.profiles.get(userId)!;
  }

  /**
   * Update profile from interaction
   */
  updateProfile(userId: string, interaction: {
    message?: string;
    intent?: string;
    satisfaction?: number;
    sessionLength?: number;
    timestamp?: Date;
  }): void {
    const profile = this.getProfile(userId);

    // Update preferences
    if (interaction.message) {
      this.updateCommunicationStyle(profile, interaction.message);
      this.updateTopics(profile, interaction.message);
    }

    // Update behavior
    if (interaction.intent) {
      this.updateCommonIntents(profile, interaction.intent);
    }
    if (interaction.sessionLength) {
      profile.behavior.averageSessionLength = 
        (profile.behavior.averageSessionLength + interaction.sessionLength) / 2;
    }
    if (interaction.timestamp) {
      const hour = interaction.timestamp.getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      if (!profile.behavior.preferredTimeOfDay.includes(timeOfDay)) {
        profile.behavior.preferredTimeOfDay.push(timeOfDay);
      }
    }

    // Update history
    profile.history.totalInteractions++;
    profile.history.lastSeen = interaction.timestamp || new Date();
    if (interaction.satisfaction !== undefined) {
      profile.history.satisfactionScore = 
        (profile.history.satisfactionScore * (profile.history.totalInteractions - 1) + interaction.satisfaction) /
        profile.history.totalInteractions;
    }

    logger.debug('User profile updated', { userId, totalInteractions: profile.history.totalInteractions });
  }

  /**
   * Infer communication style from message
   */
  private updateCommunicationStyle(profile: UserProfile, message: string): void {
    const lower = message.toLowerCase();
    
    if (lower.includes('please') || lower.includes('thank you') || lower.includes('sir') || lower.includes('madam')) {
      profile.preferences.communicationStyle = 'formal';
    } else if (lower.includes('hey') || lower.includes('yo') || lower.includes('lol')) {
      profile.preferences.communicationStyle = 'casual';
    } else if (lower.includes('algorithm') || lower.includes('implementation') || lower.includes('architecture')) {
      profile.preferences.communicationStyle = 'technical';
    } else if (lower.includes(':)') || lower.includes('thanks') || lower.includes('awesome')) {
      profile.preferences.communicationStyle = 'friendly';
    }
  }

  /**
   * Extract and update topics
   */
  private updateTopics(profile: UserProfile, message: string): void {
    // Simple topic extraction (would use NLP in production)
    const topics = ['ai', 'coding', 'science', 'technology', 'business', 'health', 'education'];
    const lower = message.toLowerCase();
    
    for (const topic of topics) {
      if (lower.includes(topic) && !profile.preferences.topics.includes(topic)) {
        profile.preferences.topics.push(topic);
      }
    }
  }

  /**
   * Update common intents
   */
  private updateCommonIntents(profile: UserProfile, intent: string): void {
    if (!profile.behavior.commonIntents.includes(intent)) {
      profile.behavior.commonIntents.push(intent);
    }
  }

  /**
   * Create default profile
   */
  private createDefaultProfile(userId: string): UserProfile {
    return {
      userId,
      preferences: {
        communicationStyle: 'friendly',
        responseLength: 'medium',
        topics: [],
        language: 'en'
      },
      behavior: {
        averageSessionLength: 0,
        preferredTimeOfDay: [],
        interactionFrequency: 0,
        commonIntents: []
      },
      history: {
        totalInteractions: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        satisfactionScore: 0.5
      },
      metadata: {}
    };
  }

  /**
   * Get profile statistics
   */
  getStats() {
    return {
      totalProfiles: this.profiles.size,
      averageSatisfaction: this.getAverageSatisfaction(),
      mostCommonStyle: this.getMostCommonStyle()
    };
  }

  private getAverageSatisfaction(): number {
    const profiles = Array.from(this.profiles.values());
    if (profiles.length === 0) return 0;
    return profiles.reduce((sum, p) => sum + p.history.satisfactionScore, 0) / profiles.length;
  }

  private getMostCommonStyle(): string {
    const styles = Array.from(this.profiles.values()).map(p => p.preferences.communicationStyle);
    const counts = new Map<string, number>();
    for (const style of styles) {
      counts.set(style, (counts.get(style) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'friendly';
  }
}

