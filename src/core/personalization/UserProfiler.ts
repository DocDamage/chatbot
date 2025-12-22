/**
 * User Profiler - Build detailed user models with NLP topic extraction
 * Research: Stanford BookBuddy, MIT Personalization Lab
 */

import { logger } from '../observability/logger';

// Dynamic import for NLP
let nlp: any = null;
let nlpLoaded = false;

async function loadNLP(): Promise<boolean> {
  if (nlp !== null) return nlpLoaded;
  try {
    nlp = require('compromise');
    nlpLoaded = true;
    return true;
  } catch {
    nlpLoaded = false;
    return false;
  }
}

export interface UserProfile {
  userId: string;
  preferences: {
    communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
    responseLength: 'short' | 'medium' | 'long';
    topics: string[];
    language?: string;
    detailedExplanations: boolean;
    codeExamples: boolean;
  };
  behavior: {
    averageSessionLength: number;
    preferredTimeOfDay: string[];
    interactionFrequency: number;
    commonIntents: string[];
    averageMessageLength: number;
    questionsAsked: number;
    topicsDiscussed: TopicInterest[];
  };
  history: {
    totalInteractions: number;
    firstSeen: Date;
    lastSeen: Date;
    satisfactionScore: number;
    recentMessages: Array<{ content: string; timestamp: Date }>;
  };
  insights: {
    expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    primaryInterests: string[];
    communicationPatterns: string[];
    sentimentTrend: 'positive' | 'negative' | 'neutral';
  };
  metadata: Record<string, any>;
}

export interface TopicInterest {
  topic: string;
  count: number;
  lastMentioned: Date;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export class UserProfiler {
  private profiles: Map<string, UserProfile> = new Map();
  private topicCategories: Record<string, string[]> = {
    technology: ['programming', 'coding', 'software', 'hardware', 'computer', 'tech', 'api', 'framework', 'database', 'cloud'],
    science: ['physics', 'chemistry', 'biology', 'math', 'research', 'experiment', 'theory', 'hypothesis'],
    business: ['marketing', 'sales', 'finance', 'management', 'strategy', 'startup', 'investment', 'revenue'],
    creative: ['art', 'design', 'music', 'writing', 'creative', 'story', 'novel', 'poetry'],
    health: ['health', 'medical', 'fitness', 'nutrition', 'wellness', 'mental', 'exercise', 'diet'],
    education: ['learning', 'study', 'course', 'tutorial', 'education', 'university', 'school', 'training'],
    entertainment: ['games', 'movies', 'music', 'sports', 'entertainment', 'fun', 'hobby']
  };

  constructor() {
    loadNLP().catch(() => { });
  }

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
   * Update profile from interaction with NLP analysis
   */
  async updateProfile(userId: string, interaction: {
    message?: string;
    intent?: string;
    satisfaction?: number;
    sessionLength?: number;
    timestamp?: Date;
  }): Promise<void> {
    const profile = this.getProfile(userId);
    const timestamp = interaction.timestamp || new Date();

    // Update preferences with NLP
    if (interaction.message) {
      await this.analyzeCommunicationStyle(profile, interaction.message);
      await this.extractTopics(profile, interaction.message);
      this.updateMessageStats(profile, interaction.message);
      this.storeRecentMessage(profile, interaction.message, timestamp);
      await this.analyzeExpertiseLevel(profile, interaction.message);
    }

    // Update behavior
    if (interaction.intent) {
      this.updateCommonIntents(profile, interaction.intent);
    }
    if (interaction.sessionLength) {
      profile.behavior.averageSessionLength =
        (profile.behavior.averageSessionLength * profile.history.totalInteractions + interaction.sessionLength) /
        (profile.history.totalInteractions + 1);
    }

    // Update time preferences
    const hour = timestamp.getHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
    if (!profile.behavior.preferredTimeOfDay.includes(timeOfDay)) {
      profile.behavior.preferredTimeOfDay.push(timeOfDay);
    }

    // Update history
    profile.history.totalInteractions++;
    profile.history.lastSeen = timestamp;
    if (interaction.satisfaction !== undefined) {
      profile.history.satisfactionScore =
        (profile.history.satisfactionScore * (profile.history.totalInteractions - 1) + interaction.satisfaction) /
        profile.history.totalInteractions;
    }

    // Update insights
    this.updateInsights(profile);

    logger.debug('User profile updated', {
      userId,
      totalInteractions: profile.history.totalInteractions,
      expertiseLevel: profile.insights.expertiseLevel
    });
  }

  /**
   * Analyze communication style using NLP
   */
  private async analyzeCommunicationStyle(profile: UserProfile, message: string): Promise<void> {
    const isLoaded = await loadNLP();
    const lower = message.toLowerCase();

    // Formal indicators
    const formalIndicators = ['please', 'thank you', 'kindly', 'would you', 'could you', 'sir', 'madam', 'regards'];
    const casualIndicators = ['hey', 'yo', 'lol', 'gonna', 'wanna', 'btw', 'omg', 'cool'];
    const technicalIndicators = ['algorithm', 'implementation', 'architecture', 'api', 'framework', 'function', 'class', 'method'];
    const friendlyIndicators = [':)', '!', 'thanks', 'awesome', 'great', 'love', 'amazing'];

    let formalScore = formalIndicators.filter(w => lower.includes(w)).length;
    let casualScore = casualIndicators.filter(w => lower.includes(w)).length;
    let technicalScore = technicalIndicators.filter(w => lower.includes(w)).length;
    let friendlyScore = friendlyIndicators.filter(w => lower.includes(w)).length;

    // NLP enhancement
    if (isLoaded) {
      try {
        const doc = nlp(message);
        // Check for questions
        if (doc.questions().length > 0) {
          profile.behavior.questionsAsked++;
        }
        // Technical terms detection
        technicalScore += doc.match('#Acronym').length;
        // Positive sentiment
        friendlyScore += doc.match('#Positive').length;
      } catch {
        // Continue with basic analysis
      }
    }

    // Determine style
    const scores = { formal: formalScore, casual: casualScore, technical: technicalScore, friendly: friendlyScore };
    const maxStyle = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

    if (maxStyle[1] > 0) {
      profile.preferences.communicationStyle = maxStyle[0] as any;
    }

    // Detect preference for detailed explanations
    if (lower.includes('explain') || lower.includes('detail') || lower.includes('how does') || lower.includes('why')) {
      profile.preferences.detailedExplanations = true;
    }

    // Detect preference for code examples
    if (lower.includes('example') || lower.includes('code') || lower.includes('show me') || lower.includes('sample')) {
      profile.preferences.codeExamples = true;
    }
  }

  /**
   * Extract topics using NLP
   */
  private async extractTopics(profile: UserProfile, message: string): Promise<void> {
    const isLoaded = await loadNLP();
    const extractedTopics: string[] = [];

    if (isLoaded) {
      try {
        const doc = nlp(message);

        // Extract nouns as potential topics
        doc.nouns().forEach((n: any) => {
          const text = n.text().toLowerCase();
          if (text.length > 2) {
            extractedTopics.push(text);
          }
        });

        // Extract topics (if supported)
        doc.topics().forEach((t: any) => {
          extractedTopics.push(t.text().toLowerCase());
        });
      } catch {
        // Fall through to basic extraction
      }
    }

    // Basic extraction fallback
    const lower = message.toLowerCase();
    for (const [category, keywords] of Object.entries(this.topicCategories)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          extractedTopics.push(category);
          break;
        }
      }
    }

    // Update topic interests
    for (const topic of extractedTopics) {
      const existing = profile.behavior.topicsDiscussed.find(t => t.topic === topic);
      if (existing) {
        existing.count++;
        existing.lastMentioned = new Date();
      } else {
        profile.behavior.topicsDiscussed.push({
          topic,
          count: 1,
          lastMentioned: new Date(),
          sentiment: 'neutral'
        });
      }
    }

    // Update preferences.topics with top topics
    profile.preferences.topics = profile.behavior.topicsDiscussed
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(t => t.topic);
  }

  /**
   * Analyze expertise level from messages
   */
  private async analyzeExpertiseLevel(profile: UserProfile, message: string): Promise<void> {
    const isLoaded = await loadNLP();

    // Indicators of expertise
    const beginnerIndicators = ['what is', 'how do i', 'i don\'t understand', 'explain', 'beginner', 'new to', 'first time'];
    const advancedIndicators = ['optimize', 'performance', 'architecture', 'scalability', 'best practice', 'design pattern'];
    const expertIndicators = ['benchmark', 'profiling', 'memory leak', 'race condition', 'distributed', 'consensus', 'theorem'];

    const lower = message.toLowerCase();

    let beginnerScore = beginnerIndicators.filter(i => lower.includes(i)).length;
    let advancedScore = advancedIndicators.filter(i => lower.includes(i)).length;
    let expertScore = expertIndicators.filter(i => lower.includes(i)).length;

    // NLP enhancement - sentence complexity
    if (isLoaded) {
      try {
        const doc = nlp(message);
        const sentences = doc.sentences().length;
        const words = doc.wordCount();
        const avgWordsPerSentence = words / Math.max(sentences, 1);

        // Complex sentences suggest higher expertise
        if (avgWordsPerSentence > 20) expertScore++;
        if (avgWordsPerSentence > 15) advancedScore++;
      } catch {
        // Continue with basic analysis
      }
    }

    // Update expertise level based on cumulative evidence
    const currentLevel = profile.insights.expertiseLevel;
    const levels = ['beginner', 'intermediate', 'advanced', 'expert'] as const;
    const currentIndex = levels.indexOf(currentLevel);

    if (expertScore > 0 && currentIndex < 3) {
      profile.insights.expertiseLevel = 'expert';
    } else if (advancedScore > 0 && currentIndex < 2) {
      profile.insights.expertiseLevel = 'advanced';
    } else if (beginnerScore > 1 && currentIndex > 0) {
      profile.insights.expertiseLevel = 'beginner';
    } else if (profile.history.totalInteractions > 10 && currentIndex === 0) {
      profile.insights.expertiseLevel = 'intermediate';
    }
  }

  /**
   * Update message statistics
   */
  private updateMessageStats(profile: UserProfile, message: string): void {
    const messageLength = message.length;
    profile.behavior.averageMessageLength =
      (profile.behavior.averageMessageLength * profile.history.totalInteractions + messageLength) /
      (profile.history.totalInteractions + 1);

    // Detect response length preference
    if (profile.behavior.averageMessageLength > 200) {
      profile.preferences.responseLength = 'long';
    } else if (profile.behavior.averageMessageLength > 50) {
      profile.preferences.responseLength = 'medium';
    } else {
      profile.preferences.responseLength = 'short';
    }
  }

  /**
   * Store recent messages for context
   */
  private storeRecentMessage(profile: UserProfile, content: string, timestamp: Date): void {
    profile.history.recentMessages.push({ content: content.substring(0, 500), timestamp });
    // Keep only last 20 messages
    if (profile.history.recentMessages.length > 20) {
      profile.history.recentMessages.shift();
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
   * Update insights based on profile data
   */
  private updateInsights(profile: UserProfile): void {
    // Primary interests
    profile.insights.primaryInterests = profile.behavior.topicsDiscussed
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(t => t.topic);

    // Communication patterns
    const patterns: string[] = [];
    if (profile.preferences.detailedExplanations) patterns.push('prefers_detailed_explanations');
    if (profile.preferences.codeExamples) patterns.push('wants_code_examples');
    if (profile.behavior.questionsAsked > profile.history.totalInteractions * 0.7) patterns.push('question_heavy');
    if (profile.behavior.averageMessageLength > 150) patterns.push('verbose');
    if (profile.behavior.averageMessageLength < 30) patterns.push('concise');
    profile.insights.communicationPatterns = patterns;

    // Sentiment trend
    if (profile.history.satisfactionScore > 0.7) {
      profile.insights.sentimentTrend = 'positive';
    } else if (profile.history.satisfactionScore < 0.4) {
      profile.insights.sentimentTrend = 'negative';
    } else {
      profile.insights.sentimentTrend = 'neutral';
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
        language: 'en',
        detailedExplanations: false,
        codeExamples: false
      },
      behavior: {
        averageSessionLength: 0,
        preferredTimeOfDay: [],
        interactionFrequency: 0,
        commonIntents: [],
        averageMessageLength: 0,
        questionsAsked: 0,
        topicsDiscussed: []
      },
      history: {
        totalInteractions: 0,
        firstSeen: new Date(),
        lastSeen: new Date(),
        satisfactionScore: 0.5,
        recentMessages: []
      },
      insights: {
        expertiseLevel: 'intermediate',
        primaryInterests: [],
        communicationPatterns: [],
        sentimentTrend: 'neutral'
      },
      metadata: {}
    };
  }

  /**
   * Get personalization hints for a user
   */
  getPersonalizationHints(userId: string): {
    greetingStyle: string;
    explanationDepth: string;
    includeExamples: boolean;
    suggestedTopics: string[];
    tone: string;
  } {
    const profile = this.getProfile(userId);

    return {
      greetingStyle: profile.preferences.communicationStyle === 'formal' ? 'professional' : 'casual',
      explanationDepth: profile.insights.expertiseLevel === 'beginner' ? 'detailed' :
        profile.insights.expertiseLevel === 'expert' ? 'concise' : 'moderate',
      includeExamples: profile.preferences.codeExamples,
      suggestedTopics: profile.insights.primaryInterests,
      tone: profile.preferences.communicationStyle
    };
  }

  /**
   * Get profile statistics
   */
  getStats() {
    const profiles = Array.from(this.profiles.values());
    const expertiseCounts = { beginner: 0, intermediate: 0, advanced: 0, expert: 0 };

    for (const p of profiles) {
      expertiseCounts[p.insights.expertiseLevel]++;
    }

    return {
      totalProfiles: this.profiles.size,
      averageSatisfaction: this.getAverageSatisfaction(),
      mostCommonStyle: this.getMostCommonStyle(),
      expertiseDistribution: expertiseCounts,
      mostPopularTopics: this.getMostPopularTopics()
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

  private getMostPopularTopics(): string[] {
    const topicCounts = new Map<string, number>();
    for (const profile of this.profiles.values()) {
      for (const topic of profile.behavior.topicsDiscussed) {
        topicCounts.set(topic.topic, (topicCounts.get(topic.topic) || 0) + topic.count);
      }
    }
    return Array.from(topicCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic]) => topic);
  }
}
