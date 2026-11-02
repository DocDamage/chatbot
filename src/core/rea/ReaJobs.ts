import fs from 'fs';
import path from 'path';
import { ReaOperation, ReaError } from './ReaConfig';
import { ReaStep } from './ReaProtocol';

export interface ReaJob {
  id: string; owner: string; target: string; operation: ReaOperation; procedure?: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  createdAt: string; finishedAt?: string; error?: string; steps?: ReaStep[];
  input?: { bytes: number; files: number; sha256?: string; limitations: string[] };
  evidenceSha256?: string;
}

export class ReaJobs {
  constructor(readonly root: string) {}
  directory(id: string): string {
    if (!/^[a-f\d-]{36}$/i.test(id)) throw new ReaError('Invalid analysis ID.');
    return path.join(this.root, 'jobs', id);
  }
  save(job: ReaJob): void {
    const directory = this.directory(job.id);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'job.json.tmp'), JSON.stringify(job, null, 2));
    fs.renameSync(path.join(directory, 'job.json.tmp'), path.join(directory, 'job.json'));
  }
  get(id: string, owner: string): ReaJob {
    const file = path.join(this.directory(id), 'job.json');
    if (!fs.existsSync(file)) throw new ReaError('Analysis not found.', 404);
    const job: ReaJob = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (job.owner !== owner) throw new ReaError('Analysis not found.', 404);
    return job;
  }
  list(owner?: string): ReaJob[] {
    const directory = path.join(this.root, 'jobs');
    if (!fs.existsSync(directory)) return [];
    return fs.readdirSync(directory).flatMap(id => {
      try {
        const job: ReaJob = JSON.parse(fs.readFileSync(path.join(this.directory(id), 'job.json'), 'utf8'));
        return !owner || job.owner === owner ? [job] : [];
      } catch { return []; }
    }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  recover(): void {
    for (const job of this.list()) {
      if (job.status !== 'running' && job.status !== 'queued') continue;
      job.status = 'interrupted';
      job.error = 'The server restarted before this analysis finished. Start a new analysis to retry.';
      job.finishedAt = new Date().toISOString();
      this.save(job);
    }
  }
}
