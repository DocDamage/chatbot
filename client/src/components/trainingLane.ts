/** Types, API access and display rules for the training data lane (kept out of the component). */

export type License = 'unknown' | 'owned' | 'permissive' | 'copyrighted' | 'public_domain';
export type Mode = 'sft' | 'pretrain' | 'code';
export type Format = 'jsonl' | 'parquet' | 'hf';

export const LICENSES: License[] = ['unknown', 'owned', 'permissive', 'copyrighted', 'public_domain'];
export const MODES: Mode[] = ['sft', 'pretrain', 'code'];
export const FORMATS: Format[] = ['jsonl', 'parquet', 'hf'];

export type Book = {
  book_id: number;
  sha256: string;
  title?: string | null;
  source_path: string;
  state: string;
  quality_score?: number | null;
  license_status?: License | null;
  review_status?: string | null;
  counts: Record<string, number>;
};

export type Policy = { training_licenses: License[]; quality_verified: number };
export type BooksReport = { books: Book[]; policy: Policy };

export type Pair = {
  pair_id: string;
  category: string;
  question: string;
  answer: string;
  evidence?: string | null;
  pages: number[];
  breadcrumbs: string[];
  source_excerpt: string;
  generator: string;
  decision?: 'accept' | 'reject' | null;
};

export type Sample = {
  book: { sha256: string; title?: string | null; review_status: string };
  total_pairs: number;
  decided: number;
  sample: Pair[];
};

export type Notice = { kind: 'success' | 'error'; text: string; lines?: string[] };

export class ApiError extends Error {
  constructor(message: string, readonly body: any) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body?.message || body?.error || `HTTP ${response.status}`, body);
  }
  return body as T;
}

/** The export gate, mirrored for display only: DABOOK and the server enforce it independently. */
export function trainingBlockers(book: Book, policy: Policy): string[] {
  const reasons: string[] = [];
  if (book.state !== 'done' && book.state !== 'review') reasons.push(`state is ${book.state}`);
  const license = book.license_status ?? 'unknown';
  if (!policy.training_licenses.includes(license)) reasons.push(`license is ${license}`);
  const review = book.review_status ?? 'unreviewed';
  if (review === 'rejected') reasons.push('rejected in review');
  else if (review !== 'approved' && (book.quality_score == null || book.quality_score < policy.quality_verified)) {
    reasons.push('needs review');
  }
  return reasons;
}

export function describeError(error: unknown): Notice {
  if (error instanceof ApiError) {
    const lines: string[] = [];
    const blocked = error.body?.details?.blocked as Record<string, string[]> | undefined;
    if (blocked) for (const [name, reasons] of Object.entries(blocked)) lines.push(`${name}: ${reasons.join(', ')}`);
    const governance = error.body?.details?.governance;
    if (governance?.matchSamples) {
      for (const match of governance.matchSamples as Array<{ evaluationId: string; recordId: string }>) {
        lines.push(`${match.recordId} overlaps ${match.evaluationId}`);
      }
    }
    return { kind: 'error', text: error.message, lines };
  }
  return { kind: 'error', text: error instanceof Error ? error.message : String(error) };
}

