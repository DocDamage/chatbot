/**
 * Developer QA Refresh Service (CRK Phase 13: CRK-P13-T07)
 * Implements incremental refresh using content hash and timestamp tracking.
 */

import * as crypto from 'crypto';
import { QAPair, QARefreshRecord, QAChunk } from '../../types/developer-qa';
import { DeveloperQAPack } from './DeveloperQAPack';

export interface RefreshResult {
  indexedCount: number;
  skippedCount: number;
  updatedCount: number;
  records: Map<string, QARefreshRecord>;
}

export class DeveloperQARefreshService {
  private pack: DeveloperQAPack;
  private records: Map<string, QARefreshRecord> = new Map();

  constructor(pack: DeveloperQAPack) {
    this.pack = pack;
  }

  public computeHash(pair: QAPair): string {
    const raw = `${pair.questionTitle}::${pair.questionBody}::${pair.answerBody}::${pair.answerScore}::${pair.isAccepted}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  public processBatch(pairs: QAPair[]): RefreshResult {
    let indexedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;

    for (const pair of pairs) {
      const key = `${pair.site}:${pair.externalId}:${pair.answerId}`;
      const hash = this.computeHash(pair);
      const existing = this.records.get(key);

      if (existing && existing.contentHash === hash) {
        // Unchanged content, skip re-indexing
        skippedCount++;
        continue;
      }

      const chunk: QAChunk | null = this.pack.indexQAPair(pair);
      if (chunk) {
        if (existing) {
          updatedCount++;
          this.records.set(key, {
            externalId: pair.externalId,
            contentHash: hash,
            lastIndexedAt: new Date().toISOString(),
            version: existing.version + 1,
          });
        } else {
          indexedCount++;
          this.records.set(key, {
            externalId: pair.externalId,
            contentHash: hash,
            lastIndexedAt: new Date().toISOString(),
            version: 1,
          });
        }
      }
    }

    return {
      indexedCount,
      skippedCount,
      updatedCount,
      records: new Map(this.records),
    };
  }

  public getRecord(key: string): QARefreshRecord | undefined {
    return this.records.get(key);
  }
}
