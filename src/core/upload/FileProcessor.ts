/**
 * File Processor - Handle file uploads and processing
 */

import { logger } from '../observability/logger';
import { DocumentManager } from '../rag/DocumentManager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  processed: boolean;
  metadata?: Record<string, any>;
}

export interface FileProcessingResult {
  success: boolean;
  chunks?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class FileProcessor {
  private uploadDir: string;
  private maxFileSize: number = 10 * 1024 * 1024; // 10MB
  private allowedMimeTypes: string[] = [
    'text/plain',
    'text/markdown',
    'application/json',
    'application/pdf',
    'text/csv',
  ];

  constructor(uploadDir: string = './uploads') {
    this.uploadDir = uploadDir;
    this.ensureUploadDir();
  }

  /**
   * Process uploaded file
   */
  async processFile(
    file: Express.Multer.File,
    documentManager: DocumentManager,
    metadata?: Record<string, any>
  ): Promise<FileProcessingResult> {
    try {
      // Validate file
      this.validateFile(file);

      // Save file
      const uploadedFile = await this.saveFile(file, metadata);

      // Process based on type
      let chunks = 0;
      if (file.mimetype === 'application/pdf') {
        chunks = await this.processPDF(uploadedFile, documentManager);
      } else if (file.mimetype === 'text/markdown') {
        chunks = await this.processMarkdown(uploadedFile, documentManager);
      } else if (file.mimetype === 'application/json') {
        chunks = await this.processJSON(uploadedFile, documentManager);
      } else {
        chunks = await this.processText(uploadedFile, documentManager);
      }

      return {
        success: true,
        chunks,
        metadata: {
          fileId: uploadedFile.id,
          originalName: uploadedFile.originalName,
          size: uploadedFile.size,
        },
      };
    } catch (error: any) {
      logger.error('File processing failed', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate file
   */
  private validateFile(file: Express.Multer.File): void {
    if (file.size > this.maxFileSize) {
      throw new Error(`File too large. Maximum size: ${this.maxFileSize / 1024 / 1024}MB`);
    }

    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`File type not allowed: ${file.mimetype}`);
    }
  }

  /**
   * Save file to disk
   */
  private async saveFile(
    file: Express.Multer.File,
    metadata?: Record<string, any>
  ): Promise<UploadedFile> {
    const id = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ext = path.extname(file.originalname);
    const filename = `${id}${ext}`;
    const filePath = path.join(this.uploadDir, filename);

    // Write file
    await fs.promises.writeFile(filePath, file.buffer);

    const uploadedFile: UploadedFile = {
      id,
      originalName: file.originalname,
      filename,
      path: filePath,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: new Date(),
      processed: false,
      metadata,
    };

    logger.info('File saved', { id, originalName: file.originalname, size: file.size });
    return uploadedFile;
  }

  /**
   * Process PDF file
   */
  private async processPDF(
    file: UploadedFile,
    documentManager: DocumentManager
  ): Promise<number> {
    const pdfParse = require('pdf-parse');
    const dataBuffer = await fs.promises.readFile(file.path);
    const data = await pdfParse(dataBuffer);

    const chunks = await documentManager.addText(data.text, {
      source: file.originalName,
      title: file.originalName.replace('.pdf', ''),
      type: 'pdf',
      ...file.metadata,
    });

    return chunks.length;
  }

  /**
   * Process markdown file
   */
  private async processMarkdown(
    file: UploadedFile,
    documentManager: DocumentManager
  ): Promise<number> {
    const content = await fs.promises.readFile(file.path, 'utf-8');
    const chunks = await documentManager.addText(content, {
      source: file.originalName,
      title: file.originalName.replace('.md', ''),
      type: 'markdown',
      ...file.metadata,
    });

    return chunks.length;
  }

  /**
   * Process JSON file
   */
  private async processJSON(
    file: UploadedFile,
    documentManager: DocumentManager
  ): Promise<number> {
    const content = await fs.promises.readFile(file.path, 'utf-8');
    const data = JSON.parse(content);
    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

    const chunks = await documentManager.addText(text, {
      source: file.originalName,
      title: file.originalName.replace('.json', ''),
      type: 'json',
      ...file.metadata,
    });

    return chunks.length;
  }

  /**
   * Process text file
   */
  private async processText(
    file: UploadedFile,
    documentManager: DocumentManager
  ): Promise<number> {
    const content = await fs.promises.readFile(file.path, 'utf-8');
    const chunks = await documentManager.addText(content, {
      source: file.originalName,
      title: file.originalName,
      type: 'text',
      ...file.metadata,
    });

    return chunks.length;
  }

  /**
   * Ensure upload directory exists
   */
  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      logger.info('Upload directory created', { path: this.uploadDir });
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    try {
      const file = await this.getFile(fileId);
      if (file) {
        await fs.promises.unlink(file.path);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error('Failed to delete file', { fileId, error: error.message });
      return false;
    }
  }

  /**
   * Get file info (simplified - would need storage)
   */
  private async getFile(fileId: string): Promise<UploadedFile | null> {
    // In production, this would query a database
    // For now, search filesystem
    try {
      const files = await fs.promises.readdir(this.uploadDir);
      const file = files.find(f => f.startsWith(fileId));
      if (file) {
        const stats = await fs.promises.stat(path.join(this.uploadDir, file));
        return {
          id: fileId,
          originalName: file,
          filename: file,
          path: path.join(this.uploadDir, file),
          mimeType: 'application/octet-stream',
          size: stats.size,
          uploadedAt: stats.birthtime,
          processed: true,
        };
      }
    } catch (error) {
      // File not found
    }
    return null;
  }
}

