/**
 * Uncertainty Quantifier - Express confidence levels
 * Research: MIT Safer Chatbots, Uncertainty quantification
 */

import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export interface UncertaintyResult {
  confidence: number; // 0-1
  uncertainty: number; // 0-1, inverse of confidence
  factors: {
    knowledge: number; // How well we know this
    certainty: number; // How certain the model is
    sourceQuality: number; // Quality of sources
  };
  explanation: string;
}

export class UncertaintyQuantifier {
  private llmAdapter: LLMAdapter;

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Quantify uncertainty in response
   */
  async quantify(response: string, hasSources: boolean = false): Promise<UncertaintyResult> {
    try {
      const prompt = `Analyze the following response and quantify your confidence level. Consider:
1. How certain is the information?
2. Are there any ambiguous statements?
3. Are there qualifiers like "might", "possibly", "likely"?

Response: "${response}"

Respond in JSON format:
{
  "confidence": 0.0-1.0,
  "uncertainty": 0.0-1.0,
  "factors": {
    "knowledge": 0.0-1.0,
    "certainty": 0.0-1.0,
    "sourceQuality": 0.0-1.0
  },
  "explanation": "brief explanation"
}`;

      const llmResult = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are an uncertainty analyzer that quantifies confidence in responses.',
        maxTokens: 200,
        temperature: 0.3
      });

      const result = this.parseResponse(llmResult.content, hasSources);

      logger.debug('Uncertainty quantification completed', {
        confidence: result.confidence,
        uncertainty: result.uncertainty
      });

      return result;
    } catch (error: any) {
      logger.error('Uncertainty quantification failed', { error: error.message });
      // Default to medium uncertainty
      return {
        confidence: 0.5,
        uncertainty: 0.5,
        factors: {
          knowledge: 0.5,
          certainty: 0.5,
          sourceQuality: hasSources ? 0.7 : 0.3
        },
        explanation: 'Unable to quantify uncertainty'
      };
    }
  }

  /**
   * Parse LLM response
   */
  private parseResponse(content: string, hasSources: boolean): UncertaintyResult {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
          uncertainty: Math.max(0, Math.min(1, parsed.uncertainty || 0.5)),
          factors: {
            knowledge: Math.max(0, Math.min(1, parsed.factors?.knowledge || 0.5)),
            certainty: Math.max(0, Math.min(1, parsed.factors?.certainty || 0.5)),
            sourceQuality: hasSources ? 0.7 : (parsed.factors?.sourceQuality || 0.3)
          },
          explanation: parsed.explanation || 'No explanation provided'
        };
      } catch (e) {
        // Fall through
      }
    }

    // Fallback: analyze response text
    const lower = content.toLowerCase();
    const hasUncertaintyWords = /\b(might|maybe|possibly|perhaps|likely|probably|uncertain|unclear)/.test(lower);
    const hasCertaintyWords = /\b(certainly|definitely|absolutely|always|never)/.test(lower);

    let confidence = 0.6;
    if (hasUncertaintyWords) confidence -= 0.2;
    if (hasCertaintyWords) confidence += 0.2;

    return {
      confidence: Math.max(0, Math.min(1, confidence)),
      uncertainty: 1 - confidence,
      factors: {
        knowledge: 0.5,
        certainty: confidence,
        sourceQuality: hasSources ? 0.7 : 0.3
      },
      explanation: hasUncertaintyWords ? 'Response contains uncertainty indicators' : 'Standard confidence level'
    };
  }
}

