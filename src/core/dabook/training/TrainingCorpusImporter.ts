/**
 * Registers book-derived corpora with the Chatbot's training/evaluation separation governance.
 *
 *  - RAG chunks of any book register as `domain: 'rag'` (retrieval is allowed for every license).
 *  - SFT / pretrain / code records register as `domain: 'training'`, and only for books whose license
 *    is training-eligible (the list comes from DABOOK's own export policy, not a copy kept here).
 *  - Held-out evaluation items register first, so any training/RAG entry that equals one is rejected
 *    by `TrainingSeparationCoordinator` and reported as `blocked`.
 */

import { DocumentChunk } from '../../../types/rag';
import { CorpusEntry } from '../../../types/training-separation';
import { TrainingSeparationCoordinator } from '../../knowledge/TrainingSeparationCoordinator';
import { DabookBookReport, DabookTrainingMode, dabookRagRecordSchema } from '../DabookContract';
import { DabookBridge } from '../DabookBridge';
import { ScanItem, contentHash } from './ContaminationScanner';

export class TrainingLicenseError extends Error {
  constructor(readonly book: Pick<DabookBookReport, 'sha256' | 'title' | 'license_status'>, readonly reasons: string[]) {
    super(`Book ${book.title || book.sha256.slice(0, 12)} cannot be used for training: ${reasons.join('; ')}`);
    this.name = 'TrainingLicenseError';
  }
}

export interface TrainingRecord {
  id: string;
  mode: DabookTrainingMode;
  split: string;
  text: string;
  bookSha256: string;
  generator?: string;
}

export interface BlockedEntry {
  id: string;
  domain: 'rag' | 'training';
  reason: string;
}

export interface ImportPolicy {
  trainingLicenses: readonly string[];
  qualityVerified: number;
}

type DatasetReader = Pick<DabookBridge, 'readJsonl'>;

const SPLITS = ['train', 'val', 'test'] as const;

/** Why this book may not be exported for training (empty when it may). Mirrors DABOOK's gate. */
export function trainingEligibility(book: DabookBookReport, policy: ImportPolicy): string[] {
  const reasons: string[] = [];
  if (book.state !== 'done' && book.state !== 'review') {
    reasons.push(`book state is ${book.state}, not done`);
  }
  const license = book.license_status ?? 'unknown';
  if (!policy.trainingLicenses.includes(license)) {
    reasons.push(`license is '${license}': only ${policy.trainingLicenses.join(', ')} may be used for training (the book remains available for RAG)`);
  }
  const reviewStatus = book.review_status ?? 'unreviewed';
  if (reviewStatus === 'rejected') {
    reasons.push('the book was rejected in review');
  } else if (reviewStatus !== 'approved' && (book.quality_score == null || book.quality_score < policy.qualityVerified)) {
    reasons.push(`not reviewed and quality ${book.quality_score ?? 'n/a'} is below the verified threshold ${policy.qualityVerified}: review it first`);
  }
  return reasons;
}

function recordText(mode: DabookTrainingMode, record: Record<string, any>): string {
  if (mode === 'sft') {
    if (typeof record.instruction === 'string') {
      return [record.instruction, record.input, record.output].filter(part => typeof part === 'string' && part).join('\n');
    }
    const messages: Array<{ role?: string; content?: string }> = Array.isArray(record.messages) ? record.messages : [];
    return messages.filter(m => m.role !== 'system').map(m => m.content ?? '').join('\n');
  }
  return String(record.text ?? record.code ?? '');
}

export class TrainingCorpusImporter {
  readonly blocked: BlockedEntry[] = [];
  private readonly evaluationIds = new Set<string>();

  constructor(
    private readonly reader: DatasetReader,
    private readonly policy: ImportPolicy,
    readonly coordinator: TrainingSeparationCoordinator = new TrainingSeparationCoordinator()
  ) {}

  /** Register held-out evaluation items. Do this before importing any book. */
  registerEvaluation(items: readonly ScanItem[], sourceUri = 'evals'): number {
    let registered = 0;
    for (const item of items) {
      // The coordinator replaces entries that share an id: keep the first so nothing is hidden.
      if (this.evaluationIds.has(item.id)) continue;
      this.evaluationIds.add(item.id);
      try {
        this.coordinator.registerEntry({
          id: item.id,
          domain: 'evaluation',
          contentHash: contentHash(item.text),
          description: 'Held-out evaluation item',
          sourceUri,
          itemCount: 1,
          addedAt: new Date().toISOString()
        });
        registered += 1;
      } catch {
        // evaluation entries only conflict with training/rag entries, which are registered after them
      }
    }
    return registered;
  }

  private register(entry: CorpusEntry): boolean {
    try {
      this.coordinator.registerEntry(entry);
      return true;
    } catch (error) {
      this.blocked.push({
        id: entry.id,
        domain: entry.domain as 'rag' | 'training',
        reason: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /** Register a book's RAG chunks. Allowed for every license. Returns the chunks for scanning. */
  async importRag(book: DabookBookReport): Promise<DocumentChunk[]> {
    const rel = book.datasets.rag;
    if (!rel) return [];
    const rows = await this.reader.readJsonl(rel, (value, line) => {
      const parsed = dabookRagRecordSchema.safeParse(value);
      if (!parsed.success) throw new Error(`${rel} line ${line} is invalid`);
      return parsed.data;
    });
    const chunks: DocumentChunk[] = [];
    for (const row of rows) {
      const id = `dabook:${book.sha256.slice(0, 12)}:${row.chunk_id}`;
      if (this.register({
        id,
        domain: 'rag',
        contentHash: contentHash(row.content),
        description: `RAG chunk (pages ${row.page_start}-${row.page_end})`,
        sourceUri: book.source_path,
        license: book.license_status ?? 'unknown',
        itemCount: 1,
        addedAt: new Date().toISOString()
      })) {
        chunks.push({ id, content: row.content, metadata: {} });
      }
    }
    return chunks;
  }

  /**
   * Register a book's training records. Throws `TrainingLicenseError` unless the book is
   * training-eligible, so a copyrighted or unknown-license book cannot enter the training corpus
   * through this path.
   */
  async importTraining(
    book: DabookBookReport,
    modes: readonly DabookTrainingMode[],
    options: { includeHeuristic?: boolean } = {}
  ): Promise<TrainingRecord[]> {
    const reasons = trainingEligibility(book, this.policy);
    if (reasons.length > 0) throw new TrainingLicenseError(book, reasons);

    const records: TrainingRecord[] = [];
    for (const mode of modes) {
      const files: Array<[string, string]> = book.splits?.[mode]
        ? SPLITS.flatMap(split => (book.splits?.[mode]?.[split] ? [[split, book.splits![mode]![split]] as [string, string]] : []))
        : book.datasets[mode] ? [['train', book.datasets[mode]!]] : [];
      for (const [split, rel] of files) {
        const rows = await this.reader.readJsonl<Record<string, any>>(rel);
        for (const row of rows) {
          if (row.generator === 'heuristic' && !options.includeHeuristic) continue;
          const text = recordText(mode, row);
          if (!text.trim()) continue;
          const id = `dabook:${book.sha256.slice(0, 12)}:${mode}:${row.id ?? row.doc_id ?? row.code_id ?? records.length}`;
          if (this.register({
            id,
            domain: 'training',
            contentHash: contentHash(text),
            description: `${mode} record (${split})`,
            sourceUri: book.source_path,
            license: book.license_status ?? 'unknown',
            itemCount: 1,
            addedAt: new Date().toISOString()
          })) {
            records.push({ id, mode, split, text, bookSha256: book.sha256, generator: row.generator });
          }
        }
      }
    }
    return records;
  }
}
