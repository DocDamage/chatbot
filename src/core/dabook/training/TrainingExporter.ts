/**
 * Governed training-data export (the Chatbot side).
 *
 * Order of operations, each step able to stop the export before anything is written:
 *   1. resolve books from DABOOK's own view (`dabook books --json`);
 *   2. license + review gate (the same rules DABOOK enforces again inside `dabook export`);
 *   3. register held-out evaluation sets, then the candidate RAG and training records, with
 *      `TrainingSeparationCoordinator`, and scan every training record for embedded evaluation text;
 *   4. only on a clean audit, ask DABOOK to build the bundle, then record the audit in its manifest.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { logger } from '../../observability/logger';
import { DabookBridge } from '../DabookBridge';
import { getDabookBridge } from '../shared';
import { DabookBookReport, DabookExportFormat, DabookTrainingMode } from '../DabookContract';
import { ContaminationScanResult, scanForContamination } from './ContaminationScanner';
import { EvaluationCorpus, loadEvaluationCorpus } from './EvaluationCorpus';
import { BlockedEntry, TrainingCorpusImporter, TrainingRecord, trainingEligibility } from './TrainingCorpusImporter';
import { ContaminationAuditResult } from '../../../types/training-separation';

export type TrainingExportErrorCode = 'unknown_book' | 'blocked' | 'no_books' | 'contaminated';

export class TrainingExportError extends Error {
  constructor(
    readonly code: TrainingExportErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'TrainingExportError';
  }
}

export interface TrainingExportRequest {
  /** Book ids, sha256 prefixes (>= 6 chars) or source paths. Omit for every eligible book. */
  books?: string[];
  modes: DabookTrainingMode[];
  formats: DabookExportFormat[];
  includeHeuristic?: boolean;
  splits?: boolean;
}

export interface TrainingExportResult {
  bundleDir: string;
  manifest: Record<string, any>;
}

export interface TrainingExporterOptions {
  bridge?: Pick<DabookBridge, 'listBooks' | 'readJsonl' | 'exportBundle'>;
  evalsDir?: string;
  exportRoot?: string;
  now?: () => Date;
  loadEvaluation?: (directory: string) => EvaluationCorpus;
}

export function resolveBook(books: readonly DabookBookReport[], ref: string): DabookBookReport {
  const wanted = ref.trim();
  let matches: DabookBookReport[] = [];
  if (/^\d+$/.test(wanted)) matches = books.filter(b => String(b.book_id) === wanted);
  if (matches.length === 0 && /^[0-9a-f]{6,}$/i.test(wanted)) {
    matches = books.filter(b => b.sha256.startsWith(wanted.toLowerCase()));
  }
  if (matches.length === 0) matches = books.filter(b => b.source_path === wanted);
  if (matches.length === 0) throw new TrainingExportError('unknown_book', `No book matches '${ref}'`, { ref });
  if (matches.length > 1) throw new TrainingExportError('unknown_book', `'${ref}' is ambiguous: ${matches.length} books match`, { ref });
  return matches[0];
}

const label = (book: DabookBookReport) => book.title || book.sha256.slice(0, 12);

export class TrainingExporter {
  private readonly bridge: NonNullable<TrainingExporterOptions['bridge']>;
  private readonly evalsDir: string;
  private readonly exportRoot: string;
  private readonly now: () => Date;
  private readonly loadEvaluation: NonNullable<TrainingExporterOptions['loadEvaluation']>;

  constructor(options: TrainingExporterOptions = {}) {
    this.bridge = options.bridge ?? getDabookBridge();
    this.evalsDir = options.evalsDir ?? path.resolve(process.cwd(), process.env.DABOOK_EVALS_DIR || 'evals');
    this.exportRoot = options.exportRoot ?? path.resolve(process.cwd(), process.env.TRAINING_EXPORT_DIR || path.join('data', 'training-exports'));
    this.now = options.now ?? (() => new Date());
    this.loadEvaluation = options.loadEvaluation ?? loadEvaluationCorpus;
  }

  async export(request: TrainingExportRequest): Promise<TrainingExportResult> {
    const report = await this.bridge.listBooks();
    const policy = {
      trainingLicenses: report.policy.training_licenses,
      qualityVerified: report.policy.quality_verified
    };

    const explicit = (request.books?.length ?? 0) > 0;
    const selected = explicit
      ? request.books!.map(ref => resolveBook(report.books, ref))
      : report.books.filter(book => book.state === 'done' || book.state === 'review');

    const blocked: Record<string, string[]> = {};
    const eligible: DabookBookReport[] = [];
    for (const book of selected) {
      const reasons = trainingEligibility(book, policy);
      if (reasons.length > 0) blocked[label(book)] = reasons;
      else eligible.push(book);
    }
    if (explicit && Object.keys(blocked).length > 0) {
      throw new TrainingExportError(
        'blocked',
        `Export refused: ${Object.entries(blocked).map(([name, reasons]) => `${name}: ${reasons.join(', ')}`).join('; ')}`,
        { blocked }
      );
    }
    if (eligible.length === 0) {
      throw new TrainingExportError('no_books', 'No book is eligible for training export', { blocked });
    }

    // --- governance audit, before anything is written
    const corpus = this.loadEvaluation(this.evalsDir);
    const importer = new TrainingCorpusImporter(this.bridge, policy);
    const registeredEvaluation = importer.registerEvaluation(corpus.items, this.evalsDir);
    const records: TrainingRecord[] = [];
    for (const book of eligible) {
      await importer.importRag(book);
      records.push(...await importer.importTraining(book, request.modes, { includeHeuristic: request.includeHeuristic }));
    }

    const audit = importer.coordinator.runContaminationAudit();
    const scan = scanForContamination(corpus.items, records.map(record => ({ id: record.id, text: record.text })));
    const governance = this.governanceRecord(audit, scan, importer.blocked, corpus, registeredEvaluation, records.length);

    // Training <-> RAG overlap is reported but does not block: training on the passage a retrieval
    // chunk contains is expected for book-derived data. Overlap with *held-out evaluation* does block.
    const contaminated = audit.evaluationOverlapsWithTraining.length > 0
      || audit.evaluationOverlapsWithRag.length > 0
      || importer.blocked.length > 0
      || scan.matchCount > 0;
    if (contaminated) {
      throw new TrainingExportError(
        'contaminated',
        `Export blocked: training data overlaps held-out evaluation sets (${scan.matchCount} embedded matches, ` +
          `${audit.evaluationOverlapsWithTraining.length + audit.evaluationOverlapsWithRag.length} exact matches, ` +
          `${importer.blocked.length} registration conflicts)`,
        { governance }
      );
    }

    // --- build the bundle
    const bundleDir = path.join(this.exportRoot, this.bundleName());
    const manifest = await this.bridge.exportBundle({
      outDir: bundleDir,
      books: eligible.map(book => String(book.book_id)),
      modes: request.modes,
      formats: request.formats,
      allowHeuristic: request.includeHeuristic,
      splits: request.splits
    });

    const merged = { ...manifest, governance: { ...governance, generatedBy: 'chatbot-training-exporter' } };
    const manifestPath = path.join(bundleDir, 'manifest.json');
    const tmp = `${manifestPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
    fs.renameSync(tmp, manifestPath);

    logger.info('Training bundle exported', {
      bundleDir,
      books: eligible.length,
      records: Object.values(manifest.counts).reduce((sum, c) => sum + Object.values(c).reduce((a, b) => a + b, 0), 0)
    });
    return { bundleDir, manifest: merged };
  }

  private bundleName(): string {
    const stamp = this.now().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    return `${stamp}-${randomBytes(2).toString('hex')}`;
  }

  private governanceRecord(
    audit: ContaminationAuditResult,
    scan: ContaminationScanResult,
    blocked: BlockedEntry[],
    corpus: EvaluationCorpus,
    registeredEvaluation: number,
    trainingRecords: number
  ) {
    return {
      checkedAt: audit.checkedAt,
      contaminated: false,
      audit: {
        evaluationOverlapsWithTraining: audit.evaluationOverlapsWithTraining.length,
        evaluationOverlapsWithRag: audit.evaluationOverlapsWithRag.length,
        trainingOverlapsWithRag: audit.trainingOverlapsWithRag.length,
        registrationConflicts: blocked.length
      },
      embeddedEvaluationScan: {
        scannedRecords: scan.scannedRecords,
        scannedEvaluationItems: scan.scannedEvaluationItems,
        skippedShortEvaluationItems: scan.skippedShortEvaluationItems,
        matches: scan.matchCount
      },
      evaluation: { directory: corpus.directory, files: corpus.files, items: corpus.items.length, registered: registeredEvaluation },
      trainingRecordsAudited: trainingRecords,
      ...(scan.matchCount > 0 ? { matchSamples: scan.matches.slice(0, 10) } : {}),
      ...(blocked.length > 0 ? { blockedSamples: blocked.slice(0, 10) } : {})
    };
  }
}
