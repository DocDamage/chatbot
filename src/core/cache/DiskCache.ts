/**
 * Disk Cache - L3 cache implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../observability/logger';

export class DiskCache {
  private cacheDir: string;
  private enabled: boolean = false;

  constructor(cacheDir: string = './cache') {
    this.cacheDir = cacheDir;
    this.initialize();
  }

  /**
   * Initialize cache directory
   */
  private initialize(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      this.enabled = true;
      logger.info('Disk cache initialized', { cacheDir: this.cacheDir });
    } catch (error: any) {
      logger.warn('Disk cache initialization failed', { error: error.message });
      this.enabled = false;
    }
  }

  /**
   * Get value from disk
   */
  async get<T>(key: string): Promise<T | undefined> {
    if (!this.enabled) {
      return undefined;
    }

    try {
      const filePath = this.getFilePath(key);
      if (!fs.existsSync(filePath)) {
        return undefined;
      }

      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      // Check expiration
      if (parsed.expires && parsed.expires < Date.now()) {
        this.delete(key);
        return undefined;
      }

      return parsed.value as T;
    } catch (error: any) {
      logger.warn('Disk cache get failed', { key, error: error.message });
      return undefined;
    }
  }

  /**
   * Set value on disk
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const filePath = this.getFilePath(key);
      const data = {
        value,
        expires: ttl ? Date.now() + ttl * 1000 : undefined,
        timestamp: Date.now()
      };

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(data), 'utf-8');
    } catch (error: any) {
      logger.warn('Disk cache set failed', { key, error: error.message });
    }
  }

  /**
   * Delete key from disk
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled) {
      return;
    }

    try {
      const filePath = this.getFilePath(key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error: any) {
      logger.warn('Disk cache delete failed', { key, error: error.message });
    }
  }

  /**
   * Clean expired entries
   */
  async cleanExpired(): Promise<number> {
    if (!this.enabled) {
      return 0;
    }

    let cleaned = 0;
    try {
      const files = fs.readdirSync(this.cacheDir, { recursive: true });
      
      for (const file of files) {
        if (typeof file !== 'string') continue;
        const filePath = path.join(this.cacheDir, file);
        if (fs.statSync(filePath).isFile()) {
          try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            if (data.expires && data.expires < Date.now()) {
              fs.unlinkSync(filePath);
              cleaned++;
            }
          } catch {
            // Invalid file, skip
          }
        }
      }

      if (cleaned > 0) {
        logger.info('Disk cache cleaned', { cleaned });
      }
    } catch (error: any) {
      logger.warn('Disk cache cleanup failed', { error: error.message });
    }

    return cleaned;
  }

  /**
   * Get file path for key
   */
  private getFilePath(key: string): string {
    // Create subdirectories based on key hash to avoid too many files in one directory
    const hash = this.simpleHash(key);
    const subDir = hash.substring(0, 2);
    return path.join(this.cacheDir, subDir, `${hash}.json`);
  }

  /**
   * Simple hash function
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if disk cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

