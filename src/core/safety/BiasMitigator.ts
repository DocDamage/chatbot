/**
 * Bias Mitigator - Detect and reduce biases
 * Research: Harvard AI Lab, Stanford AI Safety
 */

import { logger } from '../observability/logger';

export interface BiasResult {
  biased: boolean;
  score: number; // 0-1, higher = more biased
  categories: {
    gender: number;
    race: number;
    age: number;
    religion: number;
    other: number;
  };
  suggestions: string[];
}

export class BiasMitigator {
  /**
   * Detect bias in content
   */
  detect(content: string): BiasResult {
    const lower = content.toLowerCase();
    const biasCategories = {
      gender: this.detectGenderBias(lower),
      race: this.detectRaceBias(lower),
      age: this.detectAgeBias(lower),
      religion: this.detectReligionBias(lower),
      other: this.detectOtherBias(lower)
    };

    const maxScore = Math.max(...Object.values(biasCategories));
    const biased = maxScore > 0.3; // Threshold

    const suggestions: string[] = [];
    if (biasCategories.gender > 0.3) {
      suggestions.push('Consider using gender-neutral language');
    }
    if (biasCategories.race > 0.3) {
      suggestions.push('Avoid racial stereotypes or generalizations');
    }
    if (biasCategories.age > 0.3) {
      suggestions.push('Avoid age-based assumptions');
    }

    const result: BiasResult = {
      biased,
      score: maxScore,
      categories: biasCategories,
      suggestions
    };

    if (biased) {
      logger.warn('Bias detected', {
        score: maxScore,
        categories: biasCategories
      });
    }

    return result;
  }

  /**
   * Mitigate bias in content (suggest improvements)
   */
  mitigate(content: string, biasResult: BiasResult): string {
    if (!biasResult.biased) {
      return content;
    }

    // Simple mitigation: add disclaimer
    const disclaimer = '\n\n[Note: This response has been reviewed for bias. If you notice any issues, please report them.]';
    return content + disclaimer;
  }

  private detectGenderBias(content: string): number {
    const patterns = [
      /\b(all|every|no)\s+(men|women|guys|girls)\s+(are|is)/gi,
      /\b(men|women)\s+(always|never|can't|cannot)\s+/gi
    ];

    let matches = 0;
    for (const pattern of patterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 3);
  }

  private detectRaceBias(content: string): number {
    const patterns = [
      /\b(all|every|no)\s+\w+\s+(people|person|race)\s+(are|is)/gi,
      /\b(race|ethnicity)\s+(is|are)\s+\w+/gi
    ];

    let matches = 0;
    for (const pattern of patterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 3);
  }

  private detectAgeBias(content: string): number {
    const patterns = [
      /\b(all|every)\s+(old|young|elderly|teen)\s+(people|person)\s+(are|is)/gi,
      /\b(age|old|young)\s+(is|are)\s+\w+/gi
    ];

    let matches = 0;
    for (const pattern of patterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 3);
  }

  private detectReligionBias(content: string): number {
    const patterns = [
      /\b(all|every|no)\s+\w+\s+(believers|followers|people)\s+(are|is)/gi,
      /\b(religion|faith)\s+(is|are)\s+\w+/gi
    ];

    let matches = 0;
    for (const pattern of patterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 3);
  }

  private detectOtherBias(content: string): number {
    // Generic bias patterns
    const patterns = [
      /\b(all|every|no)\s+\w+\s+(are|is)\s+\w+/gi,
      /\b(always|never)\s+\w+/gi
    ];

    let matches = 0;
    for (const pattern of patterns) {
      matches += (content.match(pattern) || []).length;
    }

    return Math.min(1.0, matches / 5);
  }
}

