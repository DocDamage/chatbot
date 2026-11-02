/**
 * Loads the held-out evaluation sets under `evals/` so training exports can be audited against them.
 *
 * Recognised shapes (everything else, e.g. build fixtures, is ignored):
 *   - an array of cases with a `query` (and optionally an `expected_answer`),
 *   - an object with a `cases` array whose items have a `prompt` or `query`,
 *   - a single case object with a `query`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { ScanItem } from './ContaminationScanner';

export interface EvaluationCorpus {
  items: ScanItem[];
  files: number;
  directory: string;
}

function textsOf(value: unknown): Array<{ suffix: string; text: string }> {
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const out: Array<{ suffix: string; text: string }> = [];
  for (const key of ['query', 'prompt']) {
    if (typeof record[key] === 'string' && (record[key] as string).trim()) out.push({ suffix: key, text: record[key] as string });
  }
  if (typeof record.expected_answer === 'string' && record.expected_answer.trim()) {
    out.push({ suffix: 'expected_answer', text: record.expected_answer });
  }
  return out;
}

function* jsonFiles(directory: string): Generator<string> {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'fixtures') yield* jsonFiles(full);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      yield full;
    }
  }
}

export function loadEvaluationCorpus(directory: string = path.resolve(process.cwd(), 'evals')): EvaluationCorpus {
  const items: ScanItem[] = [];
  let files = 0;
  if (!fs.existsSync(directory)) {
    return { items, files, directory };
  }

  for (const file of jsonFiles(directory)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue; // an unreadable eval file must not block the audit of the rest
    }
    const relative = path.relative(directory, file).replace(/\\/g, '/');
    const cases: unknown[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { cases?: unknown[] })?.cases)
        ? (parsed as { cases: unknown[] }).cases
        : [parsed];
    let used = false;
    // Ids must be unique: the coordinator keys entries by id, and a repeated id would replace
    // (and so hide) an earlier evaluation item.
    const seen = new Map<string, number>();
    cases.forEach((testCase, index) => {
      const id = (testCase as { id?: unknown })?.id;
      const base = typeof id === 'string' && id ? id : String(index);
      const repeat = seen.get(base) ?? 0;
      seen.set(base, repeat + 1);
      const caseId = repeat === 0 ? base : `${base}@${index}`;
      for (const { suffix, text } of textsOf(testCase)) {
        items.push({ id: `eval:${relative}#${caseId}:${suffix}`, text });
        used = true;
      }
    });
    if (used) files += 1;
  }
  return { items, files, directory };
}
