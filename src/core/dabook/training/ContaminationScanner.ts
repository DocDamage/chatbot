/**
 * Evaluation-contamination checks for book-derived training data.
 *
 * `TrainingSeparationCoordinator` rejects entries whose *whole-content hash* equals a held-out
 * evaluation item. That misses the realistic leak: a training pair or pretrain document that merely
 * *contains* an evaluation question (or its expected answer). This scanner adds a containment check
 * on normalized text, so an eval item embedded anywhere in a training record is caught too.
 */

import { createHash } from 'node:crypto';

export const MIN_SCAN_CHARS = 24;

/** Lower-cased letters and digits separated by single spaces (NFKC-normalized). */
export function normalizeText(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function contentHash(text: string): string {
  return createHash('sha256').update(normalizeText(text)).digest('hex');
}

export interface ScanItem {
  id: string;
  text: string;
}

export interface ContaminationMatch {
  evaluationId: string;
  recordId: string;
  kind: 'record-contains-evaluation' | 'evaluation-contains-record';
}

export interface ContaminationScanResult {
  scannedRecords: number;
  scannedEvaluationItems: number;
  /** Items shorter than MIN_SCAN_CHARS cannot be matched reliably and are excluded. */
  skippedShortEvaluationItems: number;
  matchCount: number;
  /** At most `maxReported` matches (the count above is complete). */
  matches: ContaminationMatch[];
}

export function scanForContamination(
  evaluationItems: readonly ScanItem[],
  records: readonly ScanItem[],
  maxReported = 100
): ContaminationScanResult {
  const evaluation = evaluationItems
    .map(item => ({ id: item.id, text: normalizeText(item.text) }))
    .filter(item => item.text.length >= MIN_SCAN_CHARS);
  const matches: ContaminationMatch[] = [];
  let matchCount = 0;

  const report = (match: ContaminationMatch) => {
    matchCount += 1;
    if (matches.length < maxReported) matches.push(match);
  };

  for (const record of records) {
    const text = normalizeText(record.text);
    if (!text) continue;
    for (const item of evaluation) {
      if (text.includes(item.text)) {
        report({ evaluationId: item.id, recordId: record.id, kind: 'record-contains-evaluation' });
      } else if (text.length >= MIN_SCAN_CHARS && item.text.includes(text)) {
        report({ evaluationId: item.id, recordId: record.id, kind: 'evaluation-contains-record' });
      }
    }
  }

  return {
    scannedRecords: records.length,
    scannedEvaluationItems: evaluation.length,
    skippedShortEvaluationItems: evaluationItems.length - evaluation.length,
    matchCount,
    matches
  };
}
