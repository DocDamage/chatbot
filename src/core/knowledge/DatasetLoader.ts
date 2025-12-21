/**
 * Dataset Loader - Load structured datasets (CSV, JSON, databases)
 */

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { DocumentChunk } from '../../types/rag';
import { logger } from '../observability/logger';
import { EmbeddingService } from '../embeddings/EmbeddingService';

export interface DatasetOptions {
  generateEmbeddings?: boolean;
  chunkSize?: number;
  includeHeaders?: boolean;
  delimiter?: string;
}

export class DatasetLoader {
  private embeddingService?: EmbeddingService;

  constructor(embeddingService?: EmbeddingService) {
    this.embeddingService = embeddingService;
  }

  /**
   * Load CSV dataset
   */
  async loadCSV(
    filePath: string,
    options: DatasetOptions = {}
  ): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const records = parse(content, {
        columns: options.includeHeaders !== false,
        delimiter: options.delimiter || ',',
        skip_empty_lines: true,
      });

      const chunks: DocumentChunk[] = [];
      const chunkSize = options.chunkSize || 10; // Rows per chunk

      for (let i = 0; i < records.length; i += chunkSize) {
        const chunkRecords = records.slice(i, i + chunkSize);
        const chunkText = this.formatRecordsAsText(chunkRecords);
        
        const chunk: DocumentChunk = {
          id: `csv_${path.basename(filePath)}_chunk_${Math.floor(i / chunkSize)}`,
          content: chunkText,
          metadata: {
            source: filePath,
            type: 'csv',
            rowStart: i,
            rowEnd: Math.min(i + chunkSize, records.length),
            totalRows: records.length,
          },
        };

        if (options.generateEmbeddings && this.embeddingService) {
          chunk.embedding = await this.embeddingService.embed(chunkText);
        }

        chunks.push(chunk);
      }

      logger.info('CSV dataset loaded', { filePath, rows: records.length, chunks: chunks.length });
      return chunks;
    } catch (error: any) {
      logger.error('Failed to load CSV dataset', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Load JSON dataset (array of objects or single object)
   */
  async loadJSON(
    filePath: string,
    options: DatasetOptions = {}
  ): Promise<DocumentChunk[]> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      const chunks: DocumentChunk[] = [];
      const items = Array.isArray(data) ? data : [data];
      const chunkSize = options.chunkSize || 5; // Items per chunk

      for (let i = 0; i < items.length; i += chunkSize) {
        const chunkItems = items.slice(i, i + chunkSize);
        const chunkText = this.formatItemsAsText(chunkItems);
        
        const chunk: DocumentChunk = {
          id: `json_${path.basename(filePath)}_chunk_${Math.floor(i / chunkSize)}`,
          content: chunkText,
          metadata: {
            source: filePath,
            type: 'json',
            itemStart: i,
            itemEnd: Math.min(i + chunkSize, items.length),
            totalItems: items.length,
          },
        };

        if (options.generateEmbeddings && this.embeddingService) {
          chunk.embedding = await this.embeddingService.embed(chunkText);
        }

        chunks.push(chunk);
      }

      logger.info('JSON dataset loaded', { filePath, items: items.length, chunks: chunks.length });
      return chunks;
    } catch (error: any) {
      logger.error('Failed to load JSON dataset', { filePath, error: error.message });
      throw error;
    }
  }

  /**
   * Load from SQLite database
   */
  async loadSQLite(
    dbPath: string,
    tableName: string,
    options: DatasetOptions = {}
  ): Promise<DocumentChunk[]> {
    try {
      const Database = require('../database/Database').Database;
      const db = new Database({
        type: 'sqlite',
        filePath: dbPath,
      });

      await db.initialize();

      const result = await db.query(`SELECT * FROM ${tableName}`);
      const rows = result.rows;

      const chunks: DocumentChunk[] = [];
      const chunkSize = options.chunkSize || 10;

      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunkRows = rows.slice(i, i + chunkSize);
        const chunkText = this.formatRecordsAsText(chunkRows);
        
        const chunk: DocumentChunk = {
          id: `sqlite_${tableName}_chunk_${Math.floor(i / chunkSize)}`,
          content: chunkText,
          metadata: {
            source: dbPath,
            type: 'sqlite',
            table: tableName,
            rowStart: i,
            rowEnd: Math.min(i + chunkSize, rows.length),
            totalRows: rows.length,
          },
        };

        if (options.generateEmbeddings && this.embeddingService) {
          chunk.embedding = await this.embeddingService.embed(chunkText);
        }

        chunks.push(chunk);
      }

      await db.close();
      logger.info('SQLite dataset loaded', { dbPath, table: tableName, rows: rows.length, chunks: chunks.length });
      return chunks;
    } catch (error: any) {
      logger.error('Failed to load SQLite dataset', { dbPath, table: tableName, error: error.message });
      throw error;
    }
  }

  /**
   * Format records as readable text
   */
  private formatRecordsAsText(records: any[]): string {
    if (records.length === 0) return '';

    const keys = Object.keys(records[0]);
    const lines = records.map(record => {
      const values = keys.map(key => {
        const value = record[key];
        return `${key}: ${value !== null && value !== undefined ? String(value) : 'N/A'}`;
      });
      return values.join(' | ');
    });

    return lines.join('\n');
  }

  /**
   * Format items as readable text
   */
  private formatItemsAsText(items: any[]): string {
    return items.map((item, index) => {
      if (typeof item === 'string') {
        return item;
      }
      return JSON.stringify(item, null, 2);
    }).join('\n\n---\n\n');
  }
}

