/**
 * Telegram Conversation Loader - Load conversations from Telegram exports
 */

import * as fs from 'fs';
import * as path from 'path';
import { DocumentChunk } from '../../types/rag';
import { EmbeddingService } from '../embeddings/EmbeddingService';
import { logger } from '../observability/logger';

export interface TelegramMessage {
  id: number;
  date: string;
  from?: string;
  text: string;
  type: string;
}

export interface TelegramChat {
  name: string;
  type: string;
  messages: TelegramMessage[];
}

export class TelegramSource {
  private embeddingService?: EmbeddingService;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Load Telegram JSON export
   */
  async loadTelegramExport(
    filePath: string,
    options: {
      generateEmbeddings?: boolean;
      chunkSize?: number;
      includeMetadata?: boolean;
    } = {}
  ): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const chats = data.chats?.list || [];
      const chunks: DocumentChunk[] = [];
      const chunkSize = options.chunkSize || 20; // Messages per chunk

      for (const chat of chats) {
        const messages = chat.messages || [];
        const chatName = chat.name || 'Unknown Chat';
        const chatType = chat.type || 'unknown';

        // Group messages into chunks
        for (let i = 0; i < messages.length; i += chunkSize) {
          const chunkMessages = messages.slice(i, i + chunkSize);
          const chunkText = this.formatMessages(chunkMessages, options.includeMetadata);

          const chunk: DocumentChunk = {
            id: `telegram_${chatName}_chunk_${Math.floor(i / chunkSize)}`,
            content: chunkText,
            metadata: {
              source: filePath,
              type: 'telegram',
              chatName,
              chatType,
              messageStart: i,
              messageEnd: Math.min(i + chunkSize, messages.length),
              totalMessages: messages.length,
            },
          };

          if (options.generateEmbeddings && this.embeddingService) {
            chunk.embedding = await this.embeddingService.embed(chunkText);
          }

          chunks.push(chunk);
        }
      }

      logger.info('Telegram export loaded', { filePath, chats: chats.length, chunks: chunks.length });
      return chunks;
    } catch (error: any) {
      logger.error('Failed to load Telegram export', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Format messages as readable text
   */
  private formatMessages(messages: TelegramMessage[], includeMetadata: boolean = true): string {
    return messages
      .filter(msg => msg.text && typeof msg.text === 'string')
      .map(msg => {
        if (includeMetadata) {
          const date = new Date(msg.date).toLocaleString();
          const from = msg.from || 'Unknown';
          return `[${date}] ${from}: ${msg.text}`;
        }
        return msg.text;
      })
      .join('\n\n');
  }

  /**
   * Load from Telegram export directory
   */
  async loadTelegramDirectory(
    directoryPath: string,
    options: {
      generateEmbeddings?: boolean;
      chunkSize?: number;
    } = {}
  ): Promise<DocumentChunk[]> {
    const allChunks: DocumentChunk[] = [];
    const files = fs.readdirSync(directoryPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const filePath = path.join(directoryPath, file);
          const chunks = await this.loadTelegramExport(filePath, options);
          allChunks.push(...chunks);
        } catch (error: any) {
          logger.warn('Failed to load Telegram file', { file, error: error.message });
        }
      }
    }

    return allChunks;
  }
}

