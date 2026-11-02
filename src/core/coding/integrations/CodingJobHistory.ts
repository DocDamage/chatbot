import fs from 'fs';
import path from 'path';
import { CodingToolError } from './CodingToolConfig';

const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export interface CodingJobRecord {
  id: string;
  owner: string;
  tool: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  result?: unknown;
  error?: string;
}

export class CodingJobHistory {
  readonly active = new Set<string>();
  constructor(
    readonly root: string,
    readonly retentionMs = 7 * 86400000
  ) {}
  private directory(id: string): string {
    if (!idPattern.test(id)) throw new CodingToolError('Coding job not found.', 404);
    const root = path.resolve(this.root),
      directory = path.resolve(root, id);
    if (
      path.dirname(directory) !== root ||
      fs.lstatSync(root).isSymbolicLink() ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw new CodingToolError('Coding job not found.', 404);
    return directory;
  }
  read(owner: string, id: string): CodingJobRecord {
    if (!owner) throw new CodingToolError('Authentication is required.', 401);
    try {
      const file = path.join(this.directory(id), 'result.json');
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024)
        throw new Error('Invalid record');
      const record = JSON.parse(fs.readFileSync(file, 'utf8')) as CodingJobRecord;
      if (
        !record ||
        record.owner !== owner ||
        record.id !== id ||
        typeof record.tool !== 'string' ||
        typeof record.startedAt !== 'string' ||
        !Number.isFinite(Date.parse(record.startedAt)) ||
        !['running', 'completed', 'cancelled', 'failed'].includes(record.status) ||
        (record.completedAt !== undefined &&
          (typeof record.completedAt !== 'string' ||
            !Number.isFinite(Date.parse(record.completedAt)))) ||
        (record.error !== undefined && typeof record.error !== 'string')
      )
        throw new Error('Invalid or unowned record');
      return record;
    } catch {
      throw new CodingToolError('Coding job not found.', 404);
    }
  }
  list(owner: string): Omit<CodingJobRecord, 'result' | 'owner'>[] {
    if (!owner) throw new CodingToolError('Authentication is required.', 401);
    if (!fs.existsSync(this.root)) return [];
    const records = [];
    for (const id of fs.readdirSync(this.root)) {
      try {
        const { result: _result, owner: _owner, ...record } = this.read(owner, id);
        records.push(record);
      } catch {
        /* Ignore other owners and invalid records. */
      }
    }
    return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 100);
  }
  cleanup(now = Date.now()): number {
    if (!fs.existsSync(this.root) || fs.lstatSync(this.root).isSymbolicLink()) return 0;
    let removed = 0;
    for (const id of fs.readdirSync(this.root)) {
      if (this.active.has(id) || !idPattern.test(id)) continue;
      try {
        const directory = this.directory(id);
        const recordPath = path.join(directory, 'result.json');
        if (fs.existsSync(recordPath) && fs.lstatSync(recordPath).isSymbolicLink()) continue;
        const timestamp = fs.statSync(fs.existsSync(recordPath) ? recordPath : directory).mtimeMs;
        if (now - timestamp <= this.retentionMs) continue;
        // Revalidate the absolute target immediately before recursive removal.
        if (path.dirname(path.resolve(directory)) !== path.resolve(this.root)) continue;
        fs.rmSync(directory, { recursive: true, force: true });
        removed++;
      } catch {
        /* An incomplete record must not interrupt another job. */
      }
    }
    return removed;
  }
}
