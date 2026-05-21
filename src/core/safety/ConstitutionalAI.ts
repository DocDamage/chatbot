/**
 * Constitutional AI - Principles-based safety
 * Research: Anthropic Constitutional AI paper
 */

import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface ConstitutionalPrinciple {
  id: string;
  description: string;
  priority: number; // 1-10, higher = more important
}

export class ConstitutionalAI {
  private llmAdapter: LLMAdapter;
  private principles: ConstitutionalPrinciple[] = [];

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
    this.initializePrinciples();
  }

  /**
   * Check content against constitutional principles
   */
  async check(content: string): Promise<{
    compliant: boolean;
    violations: string[];
    reasoning: string;
  }> {
    const principlesText = this.principles
      .sort((a, b) => b.priority - a.priority)
      .map(p => `- ${p.description}`)
      .join('\n');

    const prompt = `Review the following text against these principles:

${principlesText}

Text to review: "${content}"

Respond in JSON format:
{
  "compliant": true/false,
  "violations": ["list of violated principles if any"],
  "reasoning": "explanation"
}`;

    try {
      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a constitutional AI that ensures content follows ethical principles.',
        maxTokens: 300,
        temperature: 0.3
      });

      const result = this.parseResponse(response.content);

      logger.debug('Constitutional AI check completed', {
        compliant: result.compliant,
        violationsCount: result.violations.length
      });

      return result;
    } catch (error: any) {
      logger.error('Constitutional AI check failed', { error: error.message });
      return {
        compliant: false,
        violations: ['Check failed - manual review required'],
        reasoning: 'Constitutional check encountered an error'
      };
    }
  }

  /**
   * Initialize constitutional principles
   */
  private initializePrinciples(): void {
    this.principles = [
      {
        id: 'harmlessness',
        description: 'Do not provide information that could cause harm',
        priority: 10
      },
      {
        id: 'helpfulness',
        description: 'Be helpful, harmless, and honest',
        priority: 9
      },
      {
        id: 'honesty',
        description: 'Do not lie or mislead users',
        priority: 9
      },
      {
        id: 'privacy',
        description: 'Respect user privacy and confidentiality',
        priority: 8
      },
      {
        id: 'fairness',
        description: 'Treat all users fairly and without bias',
        priority: 8
      },
      {
        id: 'transparency',
        description: 'Be transparent about limitations and uncertainties',
        priority: 7
      },
      {
        id: 'respect',
        description: 'Respect human dignity and autonomy',
        priority: 7
      }
    ];
  }

  /**
   * Parse LLM response
   */
  private parseResponse(content: string): {
    compliant: boolean;
    violations: string[];
    reasoning: string;
  } {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          compliant: parsed.compliant !== false,
          violations: Array.isArray(parsed.violations) ? parsed.violations : [],
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      } catch (e) {
        // Fall through
      }
    }

    // Fallback
    const lower = content.toLowerCase();
    return {
      compliant: !lower.includes('violation') && !lower.includes('non-compliant'),
      violations: [],
      reasoning: content.substring(0, 200)
    };
  }

  /**
   * Add custom principle
   */
  addPrinciple(principle: ConstitutionalPrinciple): void {
    this.principles.push(principle);
    logger.info('Added constitutional principle', { id: principle.id });
  }
}

