/**
 * Custom Instructions - User-specific instructions and preferences
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';

export interface CustomInstructions {
  userId: string;
  instructions: string; // Custom system instructions
  preferences: {
    responseStyle: 'concise' | 'detailed' | 'balanced';
    tone: 'formal' | 'casual' | 'friendly' | 'professional';
    language?: string;
    includeExamples: boolean;
    includeCitations: boolean;
    maxLength?: number; // Max response length in tokens
  };
  contextRules: {
    rememberPreviousConversations: boolean;
    includeRelevantHistory: boolean;
    maxHistoryTurns: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export class CustomInstructionsService {
  private instructions: Map<string, CustomInstructions> = new Map();
  private db?: Database;

  constructor(db?: Database) {
    this.db = db;
  }

  /**
   * Get or create custom instructions for user
   */
  async getInstructions(userId: string): Promise<CustomInstructions> {
    // Check memory
    let instructions = this.instructions.get(userId);

    // Load from database if not in memory
    if (!instructions && this.db) {
      try {
        const result = await this.db.query(
          'SELECT * FROM custom_instructions WHERE user_id = ?',
          [userId]
        );

        if (result.rows.length > 0) {
          const row = result.rows[0];
          instructions = {
            userId: row.user_id,
            instructions: row.instructions,
            preferences: JSON.parse(row.preferences),
            contextRules: JSON.parse(row.context_rules),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          };
          this.instructions.set(userId, instructions);
        }
      } catch (error: any) {
        logger.warn('Failed to load custom instructions', { error: error.message });
      }
    }

    // Return default if not found
    if (!instructions) {
      instructions = this.getDefaultInstructions(userId);
    }

    return instructions;
  }

  /**
   * Update custom instructions
   */
  async updateInstructions(
    userId: string,
    updates: Partial<Omit<CustomInstructions, 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<CustomInstructions> {
    const existing = await this.getInstructions(userId);
    const updated: CustomInstructions = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    this.instructions.set(userId, updated);

    // Persist to database
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO custom_instructions 
           (user_id, instructions, preferences, context_rules, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET
           instructions = ?, preferences = ?, context_rules = ?, updated_at = ?`,
          [
            userId,
            updated.instructions,
            JSON.stringify(updated.preferences),
            JSON.stringify(updated.contextRules),
            updated.createdAt.toISOString(),
            updated.updatedAt.toISOString(),
            updated.instructions,
            JSON.stringify(updated.preferences),
            JSON.stringify(updated.contextRules),
            updated.updatedAt.toISOString(),
          ]
        );
      } catch (error: any) {
        logger.warn('Failed to persist custom instructions', { error: error.message });
      }
    }

    logger.info('Custom instructions updated', { userId });
    return updated;
  }

  /**
   * Get default instructions
   */
  private getDefaultInstructions(userId: string): CustomInstructions {
    return {
      userId,
      instructions: '',
      preferences: {
        responseStyle: 'balanced',
        tone: 'friendly',
        includeExamples: false,
        includeCitations: true,
      },
      contextRules: {
        rememberPreviousConversations: true,
        includeRelevantHistory: true,
        maxHistoryTurns: 10,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Build system prompt with custom instructions
   */
  buildSystemPrompt(basePrompt: string, instructions: CustomInstructions): string {
    let prompt = basePrompt;

    if (instructions.instructions) {
      prompt += `\n\nUser-specific instructions:\n${instructions.instructions}`;
    }

    prompt += `\n\nResponse preferences:`;
    prompt += `\n- Style: ${instructions.preferences.responseStyle}`;
    prompt += `\n- Tone: ${instructions.preferences.tone}`;
    if (instructions.preferences.maxLength) {
      prompt += `\n- Max length: ${instructions.preferences.maxLength} tokens`;
    }
    if (instructions.preferences.includeExamples) {
      prompt += `\n- Include examples when helpful`;
    }
    if (instructions.preferences.includeCitations) {
      prompt += `\n- Include citations for factual claims`;
    }

    return prompt;
  }
}

