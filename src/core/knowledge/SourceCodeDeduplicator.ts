/**
 * Source Code Deduplicator (CRK Phase 14: CRK-P14-T07)
 * Staged deduplication using normalized SHA-256 and SimHash token fingerprinting.
 */

import * as crypto from 'crypto';

export class SourceCodeDeduplicator {
  private exactHashes: Set<string> = new Set();
  private simHashes: Map<string, string> = new Map(); // id -> simhash

  /**
   * Normalizes code by stripping single/multiline comments and extra whitespace.
   */
  public normalize(content: string): string {
    return content
      .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // remove comments
      .replace(/#.*/g, '')                     // remove python/bash comments
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join(' ');
  }

  public computeExactHash(content: string): string {
    const normalized = this.normalize(content);
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Computes a 64-bit SimHash representation from token frequencies.
   */
  public computeSimHash(content: string): string {
    const tokens = this.normalize(content)
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((t) => t.length >= 2);

    if (tokens.length === 0) return '0'.repeat(64);

    const v = new Array(64).fill(0);
    for (const token of tokens) {
      const hash = crypto.createHash('md5').update(token).digest('hex');
      for (let i = 0; i < 64; i++) {
        // Use md5 characters to sample bit values
        const hexChar = hash.charAt(i % 32);
        const bit = parseInt(hexChar, 16) >= 8 ? 1 : -1;
        v[i] += bit;
      }
    }

    let fingerprint = '';
    for (let i = 0; i < 64; i++) {
      fingerprint += v[i] > 0 ? '1' : '0';
    }
    return fingerprint;
  }

  /**
   * Returns hamming distance between two 64-bit SimHash strings.
   */
  public hammingDistance(h1: string, h2: string): number {
    let distance = 0;
    const len = Math.min(h1.length, h2.length);
    for (let i = 0; i < len; i++) {
      if (h1[i] !== h2[i]) distance++;
    }
    return distance + Math.abs(h1.length - h2.length);
  }

  public isExactDuplicate(exactHash: string): boolean {
    return this.exactHashes.has(exactHash);
  }

  public isNearDuplicate(simHash: string, maxDistance = 4): boolean {
    for (const existing of this.simHashes.values()) {
      if (this.hammingDistance(simHash, existing) <= maxDistance) {
        return true;
      }
    }
    return false;
  }

  public register(id: string, exactHash: string, simHash: string): void {
    this.exactHashes.add(exactHash);
    this.simHashes.set(id, simHash);
  }
}
