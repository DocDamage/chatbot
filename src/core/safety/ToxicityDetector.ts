/**
 * Toxicity Detector - Real-time content filtering
 * Research: MIT Safer Chatbots, Perspective API
 */

import { logger } from '../observability/logger';
import natural from 'natural';

export interface ToxicityResult {
  toxic: boolean;
  score: number; // 0-1, higher = more toxic
  categories: {
    toxicity: number;
    severe_toxicity: number;
    identity_attack: number;
    insult: number;
    profanity: number;
    threat: number;
  };
}

export class ToxicityDetector {
  private toxicWords: Set<string> = new Set();
  private profanityWords: Set<string> = new Set();

  constructor() {
    this.initializeToxicWords();
  }

  /**
   * Detect toxicity in content
   */
  detect(content: string): ToxicityResult {
    const lower = content.toLowerCase();
    const words = lower.split(/\s+/);

    // Check for toxic words
    const toxicMatches = words.filter(w => this.toxicWords.has(w)).length;
    const profanityMatches = words.filter(w => this.profanityWords.has(w)).length;

    // Calculate scores
    const toxicity = Math.min(1.0, toxicMatches / Math.max(1, words.length / 10));
    const profanity = Math.min(1.0, profanityMatches / Math.max(1, words.length / 20));
    const severe_toxicity = toxicity > 0.7 ? toxicity : 0;
    const identity_attack = this.detectIdentityAttack(content);
    const insult = this.detectInsult(content);
    const threat = this.detectThreat(content);

    const maxScore = Math.max(toxicity, profanity, severe_toxicity, identity_attack, insult, threat);
    const toxic = maxScore > 0.3; // Threshold

    const result: ToxicityResult = {
      toxic,
      score: maxScore,
      categories: {
        toxicity,
        severe_toxicity,
        identity_attack,
        insult,
        profanity,
        threat
      }
    };

    if (toxic) {
      logger.warn('Toxicity detected', {
        score: maxScore,
        categories: result.categories
      });
    }

    return result;
  }

  /**
   * Detect identity attacks
   */
  private detectIdentityAttack(content: string): number {
    const identityPatterns = [
      /\b(all|every|no)\s+\w+\s+(are|is)\s+\w+/gi,
      /\b\w+\s+(people|person|group)\s+(are|is)\s+\w+/gi
    ];

    let matches = 0;
    for (const pattern of identityPatterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 3);
  }

  /**
   * Detect insults
   */
  private detectInsult(content: string): number {
    const insultPatterns = [
      /\b(you|your)\s+(are|is)\s+\w*(stupid|idiot|dumb|fool|moron)/gi,
      /\b(stupid|idiot|dumb|fool|moron)\s+\w*/gi
    ];

    let matches = 0;
    for (const pattern of insultPatterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 2);
  }

  /**
   * Detect threats
   */
  private detectThreat(content: string): number {
    const threatPatterns = [
      /\b(i|we|they)\s+(will|shall|going to)\s+(kill|harm|hurt|attack|destroy)/gi,
      /\b(threat|threaten|violence|violent)/gi
    ];

    let matches = 0;
    for (const pattern of threatPatterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 2);
  }

  /**
   * Initialize toxic word lists
   */
  private initializeToxicWords(): void {
    // Basic toxic words (in production, use a comprehensive list)
    this.toxicWords = new Set([
      'hate', 'kill', 'die', 'stupid', 'idiot', 'dumb', 'fool'
    ]);

    this.profanityWords = new Set([
      // Add profanity words here (keeping minimal for example)
    ]);
  }
}

