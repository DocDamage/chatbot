/**
 * Style Adapter - Match user's communication style
 * Research: Stanford BookBuddy, MIT Personalization Lab
 */

import { UserProfiler, UserProfile } from './UserProfiler';
import { LLMAdapter, LLMGenerateOptions } from '../providers/LLMAdapter';
import { logger } from '../observability/logger';

export class StyleAdapter {
  private profiler: UserProfiler;
  private llmAdapter: LLMAdapter;

  constructor(profiler: UserProfiler, llmAdapter: LLMAdapter) {
    this.profiler = profiler;
    this.llmAdapter = llmAdapter;
  }

  /**
   * Adapt system prompt to user's style
   */
  adaptSystemPrompt(userId: string, basePrompt: string): string {
    const profile = this.profiler.getProfile(userId);
    const styleInstructions = this.getStyleInstructions(profile);

    return `${basePrompt}

User Communication Preferences:
${styleInstructions}`;
  }

  /**
   * Get style instructions from profile
   */
  private getStyleInstructions(profile: UserProfile): string {
    const instructions: string[] = [];

    // Communication style
    switch (profile.preferences.communicationStyle) {
      case 'formal':
        instructions.push('- Use formal language and proper greetings');
        instructions.push('- Avoid contractions and slang');
        break;
      case 'casual':
        instructions.push('- Use casual, friendly language');
        instructions.push('- Feel free to use contractions and casual expressions');
        break;
      case 'technical':
        instructions.push('- Use precise technical terminology');
        instructions.push('- Include relevant technical details');
        break;
      case 'friendly':
        instructions.push('- Be warm and approachable');
        instructions.push('- Use friendly, conversational tone');
        break;
    }

    // Response length
    switch (profile.preferences.responseLength) {
      case 'short':
        instructions.push('- Keep responses concise and to the point');
        break;
      case 'long':
        instructions.push('- Provide detailed, comprehensive responses');
        break;
      case 'medium':
        instructions.push('- Provide balanced, moderately detailed responses');
        break;
    }

    // Topics of interest
    if (profile.preferences.topics.length > 0) {
      instructions.push(`- User is interested in: ${profile.preferences.topics.join(', ')}`);
    }

    return instructions.join('\n');
  }

  /**
   * Adapt response to match user style
   */
  async adaptResponse(
    userId: string,
    response: string,
    context: string
  ): Promise<string> {
    const profile = this.profiler.getProfile(userId);

    // If style is already matched, return as-is
    if (this.matchesStyle(response, profile)) {
      return response;
    }

    // Adapt response using LLM
    try {
      const adaptationPrompt = `Adapt the following response to match the user's communication style.

User Style: ${profile.preferences.communicationStyle}
Response Length Preference: ${profile.preferences.responseLength}

Original Response: "${response}"

Generate an adapted version that matches the user's style:`;

      const adapted = await this.llmAdapter.generate({
        prompt: adaptationPrompt,
        systemPrompt: 'You are a style adapter that modifies text to match user preferences.',
        maxTokens: 1000,
        temperature: 0.7
      });

      logger.debug('Response adapted to user style', { userId, style: profile.preferences.communicationStyle });
      return adapted.content;
    } catch (error: any) {
      logger.warn('Style adaptation failed, using original', { error: error.message });
      return response;
    }
  }

  /**
   * Check if response matches user style
   */
  private matchesStyle(response: string, profile: UserProfile): boolean {
    // Simple heuristic check
    const lower = response.toLowerCase();
    const style = profile.preferences.communicationStyle;

    if (style === 'formal' && (lower.includes("'") || lower.includes('gonna'))) {
      return false; // Has contractions
    }
    if (style === 'casual' && !lower.includes("'") && lower.length > 100) {
      return false; // Too formal
    }

    return true; // Assume matches
  }
}

