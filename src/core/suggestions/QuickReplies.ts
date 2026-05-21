/**
 * Quick Replies - Generate suggested responses and follow-up questions
 */

import { logger } from '../observability/logger';
import { LLMAdapter } from '../providers/LLMAdapter';

export interface QuickReply {
  text: string;
  type: 'question' | 'action' | 'suggestion';
  confidence: number;
}

export class QuickRepliesService {
  private llmAdapter: LLMAdapter;
  private cache: Map<string, QuickReply[]> = new Map();

  constructor(llmAdapter: LLMAdapter) {
    this.llmAdapter = llmAdapter;
  }

  /**
   * Generate quick replies based on conversation context
   */
  async generateQuickReplies(
    lastMessage: string,
    lastResponse: string,
    context?: string[]
  ): Promise<QuickReply[]> {
    const cacheKey = `${lastMessage.substring(0, 50)}_${lastResponse.substring(0, 50)}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      const prompt = this.buildPrompt(lastMessage, lastResponse, context);
      const response = await this.llmAdapter.generate({
        prompt,
        systemPrompt: 'You are a helpful assistant that suggests relevant follow-up questions and actions.',
        maxTokens: 200,
        temperature: 0.7,
      });

      const replies = this.parseReplies(response.content);
      this.cache.set(cacheKey, replies);

      // Limit cache size
      if (this.cache.size > 100) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }

      return replies;
    } catch (error: any) {
      logger.warn('Failed to generate quick replies', { error: error.message });
      return this.getDefaultReplies(lastMessage);
    }
  }

  /**
   * Build prompt for quick replies
   */
  private buildPrompt(
    lastMessage: string,
    lastResponse: string,
    context?: string[]
  ): string {
    let prompt = `Based on this conversation, suggest 3-5 relevant follow-up questions or actions.

Last user message: "${lastMessage}"
Last assistant response: "${lastResponse}"`;

    if (context && context.length > 0) {
      prompt += `\n\nRecent context:\n${context.slice(-3).join('\n')}`;
    }

    prompt += `\n\nSuggest follow-up questions or actions that would be helpful. Format as a simple list, one per line.`;

    return prompt;
  }

  /**
   * Parse LLM response into quick replies
   */
  private parseReplies(content: string): QuickReply[] {
    const lines = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.match(/^\d+[\.\)]/));

    const replies: QuickReply[] = [];
    for (const line of lines.slice(0, 5)) {
      // Remove list markers
      const clean = line.replace(/^[-*•]\s*/, '').trim();
      if (clean.length > 0 && clean.length < 100) {
        const type = this.inferType(clean);
        replies.push({
          text: clean,
          type,
          confidence: 0.8,
        });
      }
    }

    return replies;
  }

  /**
   * Infer reply type
   */
  private inferType(text: string): 'question' | 'action' | 'suggestion' {
    const lower = text.toLowerCase();
    if (lower.includes('?') || lower.startsWith('what') || lower.startsWith('how') || lower.startsWith('why')) {
      return 'question';
    }
    if (lower.startsWith('show') || lower.startsWith('explain') || lower.startsWith('tell')) {
      return 'action';
    }
    return 'suggestion';
  }

  /**
   * Get default replies when generation fails
   */
  private getDefaultReplies(lastMessage: string): QuickReply[] {
    return [
      { text: 'Tell me more about that', type: 'question', confidence: 0.5 },
      { text: 'Can you give an example?', type: 'question', confidence: 0.5 },
      { text: 'What are the key points?', type: 'question', confidence: 0.5 },
    ];
  }
}

