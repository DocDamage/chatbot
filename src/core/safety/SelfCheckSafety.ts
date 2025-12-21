/**
 * Self-Check Safety - LLM performs safety checks on its own output
 * Research: MIT Safer Chatbots, Stanford AI Safety
 */

import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface SafetyCheckResult {
  safe: boolean;
  confidence: number;
  issues: string[];
  reasoning: string;
}

export class SelfCheckSafety {
  private llmAdapter: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Perform self-check on generated content
   */
  async check(content: string): Promise<SafetyCheckResult> {
    try {
      const prompt = `Review the following text for safety issues. Check for:
1. Toxic or harmful content
2. Bias or discrimination
3. False or misleading information
4. Privacy violations
5. Inappropriate content

Text to review: "${content}"

Respond in JSON format:
{
  "safe": true/false,
  "confidence": 0.0-1.0,
  "issues": ["list of issues if any"],
  "reasoning": "explanation"
}`;

      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a safety checker that reviews content for harmful or inappropriate material.',
        maxTokens: 300,
        temperature: 0.3
      });

      // Parse response (handle both JSON and text)
      const result = this.parseResponse(response.content);

      logger.debug('Self-check safety completed', {
        safe: result.safe,
        confidence: result.confidence,
        issuesCount: result.issues.length
      });

      return result;
    } catch (error: any) {
      logger.error('Self-check safety failed', { error: error.message });
      // Fail-safe: if check fails, assume unsafe and require manual review
      return {
        safe: false,
        confidence: 0.5,
        issues: ['Safety check failed - manual review required'],
        reasoning: 'Safety check encountered an error'
      };
    }
  }

  /**
   * Parse LLM response into SafetyCheckResult
   */
  private parseResponse(content: string): SafetyCheckResult {
    // Try to extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          safe: parsed.safe !== false,
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          issues: Array.isArray(parsed.issues) ? parsed.issues : [],
          reasoning: parsed.reasoning || 'No reasoning provided'
        };
      } catch (e) {
        // Fall through to text parsing
      }
    }

    // Fallback: parse from text
    const lower = content.toLowerCase();
    const safe = !lower.includes('unsafe') && !lower.includes('harmful') && !lower.includes('inappropriate');
    const issues: string[] = [];

    if (lower.includes('toxic')) issues.push('Potential toxic content');
    if (lower.includes('bias')) issues.push('Potential bias');
    if (lower.includes('false')) issues.push('Potential false information');
    if (lower.includes('privacy')) issues.push('Potential privacy violation');

    return {
      safe,
      confidence: safe ? 0.7 : 0.3,
      issues,
      reasoning: content.substring(0, 200)
    };
  }
}

