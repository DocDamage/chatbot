/**
 * TypeScript mirror of the `dabook.ingest.v1` contract written to stdout by
 * `dabook ingest --json` (see services/dabook/schemas/dabook.ingest.v1.schema.json).
 *
 * The zod schema is deliberately tolerant of *additional* properties (a newer DABOOK may add
 * fields) but strict about everything this integration relies on.
 */

import { z } from 'zod';

export const DABOOK_SCHEMA_ID = 'dabook.ingest.v1';

/** Process exit codes of `dabook ingest`. */
export const DABOOK_EXIT = {
  OK: 0,
  NEEDS_INPUT: 2,
  FAILED: 3,
  LOCK_HELD: 4,
  BAD_ARGS: 5,
  /** `dabook export` refused by governance (license, review, nothing eligible). */
  EXPORT_BLOCKED: 6
} as const;

export const DABOOK_DATASET_KEYS = ['rag', 'raw', 'sft', 'pretrain', 'code'] as const;
export type DabookDatasetKey = (typeof DABOOK_DATASET_KEYS)[number];

export const DABOOK_LICENSE_STATUSES = ['unknown', 'owned', 'permissive', 'copyrighted', 'public_domain'] as const;
export type DabookLicenseStatus = (typeof DABOOK_LICENSE_STATUSES)[number];

const datasetKey = z.enum(DABOOK_DATASET_KEYS);

export const dabookBookSchema = z.object({
  book_id: z.number().int(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  source_path: z.string(),
  title: z.string().nullable().optional(),
  pages: z.number().int().nonnegative().nullable().optional(),
  doc_type: z.enum(['native', 'scanned', 'mixed']).nullable().optional(),
  state: z.enum(['queued', 'active', 'paused', 'needs_input', 'review', 'done', 'failed', 'removed']),
  quality_score: z.number().min(0).max(1).nullable().optional(),
  license_status: z.enum(DABOOK_LICENSE_STATUSES).nullable().optional(),
  review_status: z.enum(['unreviewed', 'approved', 'rejected']).nullable().optional(),
  warnings: z.array(z.string()),
  error: z.string().nullable().optional(),
  datasets: z.record(datasetKey, z.string()),
  counts: z.record(datasetKey, z.number().int().nonnegative()),
  /** Per training mode: train/val/test JSONL paths (relative to the workspace). */
  splits: z.record(z.enum(['sft', 'pretrain', 'code']), z.record(z.enum(['train', 'val', 'test']), z.string())).optional()
}).passthrough();

export const dabookIngestReportSchema = z.object({
  schema: z.literal(DABOOK_SCHEMA_ID),
  dabook_version: z.string(),
  workspace: z.string().optional(),
  books: z.array(dabookBookSchema),
  error: z.object({
    code: z.enum(['bad_args', 'lock_held', 'enqueue_failed']),
    message: z.string()
  }).optional()
}).passthrough();

export type DabookBookReport = z.infer<typeof dabookBookSchema>;
export type DabookIngestReport = z.infer<typeof dabookIngestReportSchema>;

/** One line of `rag.jsonl` (enriched in DABOOK Phase 2). */
export const dabookRagRecordSchema = z.object({
  chunk_id: z.string().min(1),
  book_sha256: z.string(),
  book_title: z.string().nullable().optional(),
  page: z.number().int().optional(),
  page_start: z.number().int().positive(),
  page_end: z.number().int().positive(),
  breadcrumbs: z.array(z.string()),
  node_ids: z.array(z.string()),
  node_types: z.array(z.string()),
  has_code: z.boolean(),
  token_count: z.number().int().nonnegative(),
  quality: z.number().nullable().optional(),
  content: z.string()
}).passthrough();

export type DabookRagRecord = z.infer<typeof dabookRagRecordSchema>;

/** `python -m dabook doctor --json` */
export const dabookDoctorSchema = z.object({
  ok: z.boolean(),
  dabook_version: z.string(),
  python: z.string().optional(),
  executable: z.string().optional(),
  checks: z.array(z.object({
    name: z.string(),
    ok: z.boolean(),
    required: z.boolean().optional(),
    detail: z.string().optional()
  }).passthrough())
}).passthrough();

export type DabookDoctorReport = z.infer<typeof dabookDoctorSchema>;

export const DABOOK_TRAINING_MODES = ['sft', 'pretrain', 'code'] as const;
export type DabookTrainingMode = (typeof DABOOK_TRAINING_MODES)[number];
export const DABOOK_EXPORT_FORMATS = ['jsonl', 'parquet', 'hf'] as const;
export type DabookExportFormat = (typeof DABOOK_EXPORT_FORMATS)[number];
export const DABOOK_REVIEW_STATUSES = ['unreviewed', 'approved', 'rejected'] as const;

/** `dabook books --json`: the governance view of a workspace, including the export gate's policy. */
export const dabookBooksReportSchema = z.object({
  schema: z.literal('dabook.books.v1'),
  dabook_version: z.string(),
  workspace: z.string(),
  policy: z.object({
    training_licenses: z.array(z.enum(DABOOK_LICENSE_STATUSES)),
    quality_verified: z.number().min(0).max(1),
    review_statuses: z.array(z.string())
  }).passthrough(),
  books: z.array(dabookBookSchema)
}).passthrough();
export type DabookBooksReport = z.infer<typeof dabookBooksReportSchema>;

/** `dabook review sample --json` */
export const dabookReviewSampleSchema = z.object({
  book: z.object({
    book_id: z.number().int(),
    sha256: z.string(),
    title: z.string().nullable().optional(),
    review_status: z.string(),
    license_status: z.string().nullable().optional()
  }).passthrough(),
  total_pairs: z.number().int().nonnegative(),
  decided: z.number().int().nonnegative(),
  sample: z.array(z.object({
    pair_id: z.string(),
    category: z.string(),
    question: z.string(),
    answer: z.string(),
    evidence: z.string().nullable().optional(),
    pages: z.array(z.number().int()),
    breadcrumbs: z.array(z.string()),
    source_excerpt: z.string(),
    generator: z.string(),
    grounding: z.record(z.unknown()).nullable().optional(),
    decision: z.enum(['accept', 'reject']).nullable().optional()
  }).passthrough())
}).passthrough();
export type DabookReviewSample = z.infer<typeof dabookReviewSampleSchema>;

/** `dabook export --json` manifest (`dabook.export.v1`). */
export const dabookExportManifestSchema = z.object({
  schema: z.literal('dabook.export.v1'),
  dabook_version: z.string(),
  modes: z.array(z.string()),
  formats: z.array(z.string()),
  books: z.array(z.object({
    book_id: z.number().int(),
    sha256: z.string(),
    title: z.string().nullable().optional(),
    license_status: z.string().nullable().optional(),
    review_status: z.string().nullable().optional(),
    quality_score: z.number().nullable().optional()
  }).passthrough()),
  skipped_books: z.record(z.array(z.string())),
  counts: z.record(z.record(z.number().int().nonnegative())),
  generators: z.record(z.number().int().nonnegative()),
  excluded_heuristic_records: z.number().int().nonnegative(),
  files: z.array(z.string())
}).passthrough();
export type DabookExportManifest = z.infer<typeof dabookExportManifestSchema>;

export function parseIngestReport(stdout: string): DabookIngestReport {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error('DABOOK produced no output on stdout');
  }
  let json: unknown;
  try {
    json = JSON.parse(trimmed);
  } catch {
    throw new Error(`DABOOK stdout was not a single JSON document: ${trimmed.slice(0, 200)}`);
  }
  const parsed = dabookIngestReportSchema.safeParse(json);
  if (!parsed.success) {
    const detail = parsed.error.issues.slice(0, 3).map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`DABOOK output does not match ${DABOOK_SCHEMA_ID}: ${detail}`);
  }
  return parsed.data;
}
