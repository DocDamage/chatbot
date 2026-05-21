/**
 * Conversation Manager - Manage conversation history and context
 */

import { logger } from '../observability/logger';
import { Database } from '../database/Database';

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Conversation {
  sessionId: string;
  userId?: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface ConversationSummary {
  sessionId: string;
  userId?: string;
  messageCount: number;
  firstMessage: string;
  lastMessage: string;
  createdAt: Date;
  updatedAt: Date;
}

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private db?: Database;
  private maxContextLength: number = 4000; // Max tokens in context

  constructor(db?: Database) {
    this.db = db;
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string, metadata?: Record<string, any>): Promise<Message> {
    const message: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      role,
      content,
      timestamp: new Date(),
      metadata,
    };

    let conversation = this.conversations.get(sessionId);
    if (!conversation) {
      conversation = {
        sessionId,
        userId: metadata?.userId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.set(sessionId, conversation);
    }

    conversation.messages.push(message);
    conversation.userId = metadata?.userId || conversation.userId;
    conversation.updatedAt = new Date();

    // Persist to database if available
    if (this.db) {
      try {
        await this.ensureSession(sessionId, metadata?.userId);
        await this.db.query(
          'INSERT INTO messages (id, session_id, role, content, metadata) VALUES (?, ?, ?, ?, ?)',
          [message.id, sessionId, role, content, JSON.stringify(metadata || {})]
        );
      } catch (error: any) {
        logger.warn('Failed to persist message to database', { error: error.message });
      }
    }

    logger.debug('Message added to conversation', { sessionId, role, messageId: message.id });
    return message;
  }

  private async ensureSession(sessionId: string, userId?: string): Promise<void> {
    if (!this.db) return;

    await this.db.query(
      `INSERT INTO sessions (id, user_id, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         user_id = COALESCE(excluded.user_id, sessions.user_id),
         updated_at = CURRENT_TIMESTAMP`,
      [sessionId, userId || null]
    );
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string): Promise<Conversation | null> {
    // Check memory first
    let conversation = this.conversations.get(sessionId);
    
    // Load from database if not in memory
    if (!conversation && this.db) {
      try {
        const result = await this.db.query(
          'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
          [sessionId]
        );
        
        if (result.rows.length > 0) {
          conversation = {
            sessionId,
            messages: result.rows.map((row: any) => ({
              id: row.id,
              sessionId: row.session_id,
              role: row.role as 'user' | 'assistant',
              content: row.content,
              timestamp: new Date(row.created_at),
              metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            })),
            createdAt: new Date(result.rows[0].created_at),
            updatedAt: new Date(result.rows[result.rows.length - 1].created_at),
          };
          this.conversations.set(sessionId, conversation);
        }
      } catch (error: any) {
        logger.warn('Failed to load conversation from database', { error: error.message });
      }
    }

    return conversation || null;
  }

  /**
   * Get conversation history with context window management - OPTIMIZED
   */
  async getConversationContext(sessionId: string, maxTokens: number = this.maxContextLength): Promise<Message[]> {
    const conversation = await this.getConversation(sessionId);
    if (!conversation) return [];

    // Simple token estimation (4 chars per token)
    let totalTokens = 0;
    const context: Message[] = [];

    // Add messages from most recent, working backwards
    for (let i = conversation.messages.length - 1; i >= 0; i--) {
      const message = conversation.messages[i];
      const messageTokens = Math.ceil(message.content.length / 4);

      if (totalTokens + messageTokens > maxTokens) {
        break;
      }

      context.unshift(message);
      totalTokens += messageTokens;
    }

    return context;
  }

  /**
   * List conversations for a user
   */
  async listConversations(userId?: string, limit: number = 20): Promise<ConversationSummary[]> {
    if (this.db && userId) {
      try {
        const result = await this.db.query(
          `SELECT s.id as session_id, s.user_id, s.created_at, s.updated_at,
           COUNT(m.id) as message_count,
           MIN(m.content) as first_message,
           MAX(m.content) as last_message
           FROM sessions s
           LEFT JOIN messages m ON s.id = m.session_id
           WHERE s.user_id = ?
           GROUP BY s.id
           ORDER BY s.updated_at DESC
           LIMIT ?`,
          [userId, limit]
        );

        return result.rows.map((row: any) => ({
          sessionId: row.session_id,
          userId: row.user_id,
          messageCount: row.message_count || 0,
          firstMessage: row.first_message || '',
          lastMessage: row.last_message || '',
          createdAt: new Date(row.created_at),
          updatedAt: new Date(row.updated_at),
        }));
      } catch (error: any) {
        logger.warn('Failed to list conversations from database', { error: error.message });
      }
    }

    // Fallback to in-memory
    const summaries: ConversationSummary[] = [];
    for (const [sessionId, conversation] of this.conversations.entries()) {
      if (!userId || conversation.userId === userId) {
        summaries.push({
          sessionId,
          userId: conversation.userId,
          messageCount: conversation.messages.length,
          firstMessage: conversation.messages[0]?.content || '',
          lastMessage: conversation.messages[conversation.messages.length - 1]?.content || '',
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        });
      }
    }

    return summaries.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, limit);
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(sessionId: string): Promise<boolean> {
    const deleted = this.conversations.delete(sessionId);

    if (this.db) {
      try {
        await this.db.query('DELETE FROM messages WHERE session_id = ?', [sessionId]);
        await this.db.query('DELETE FROM sessions WHERE id = ?', [sessionId]);
      } catch (error: any) {
        logger.warn('Failed to delete conversation from database', { error: error.message });
      }
    }

    return deleted;
  }

  /**
   * Search conversations
   */
  async searchConversations(query: string, userId?: string, limit: number = 10): Promise<ConversationSummary[]> {
    const allConversations = await this.listConversations(userId, 1000);
    const queryLower = query.toLowerCase();

    const matching = allConversations.filter(conv => {
      return conv.firstMessage.toLowerCase().includes(queryLower) ||
             conv.lastMessage.toLowerCase().includes(queryLower);
    });

    return matching.slice(0, limit);
  }
}

