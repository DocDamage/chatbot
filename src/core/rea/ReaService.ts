import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { McpClientService } from '../mcp/McpClientService';
import { ReaConfig, ReaError, REA_OPERATIONS, REA_VERSION, ReaOperation, reaConfig } from './ReaConfig';
import { ReaJobs, ReaJob } from './ReaJobs';
import { runRea } from './ReaProtocol';
import { ReaTargets } from './ReaTargets';

export class ReaService {
  readonly jobs: ReaJobs;
  private readonly queue: ReaJob[] = [];
  private active?: { job: ReaJob; client?: McpClientService };
  private stopped = false;

  constructor(readonly config: ReaConfig = reaConfig(), private readonly runner = runRea) {
    this.jobs = new ReaJobs(config.dataRoot);
    if (config.enabled) this.jobs.recover();
  }

  status() {
    const installed = fs.existsSync(this.config.entry);
    return {
      enabled: this.config.enabled, installed, version: installed ? REA_VERSION : undefined,
      available: !this.stopped && this.config.enabled && installed && fs.existsSync(this.config.node),
      operations: REA_OPERATIONS, allowedRoots: this.config.allowedRoots,
      maxInputBytes: this.config.maxInputBytes, timeoutMs: this.config.timeoutMs,
      activeJob: this.active?.job.id, queued: this.queue.length,
      limitations: ['Static analysis only. Native decompilation requires a separately installed REA provider.',
        'Targets are treated as untrusted data. Analysis does not establish runtime behavior or safety.'],
    };
  }

  private requireAvailable() {
    if (this.stopped || !this.status().available) throw new ReaError('REA is unavailable. Run npm run setup:rea, enable REA_ENABLED, and restart the server.', 503, 'REA_UNAVAILABLE');
  }

  start(owner: string, input: string, operation: string = 'auto', procedure?: string): ReaJob {
    return this.startWithTargets(new ReaTargets(this.config), owner, input, operation, procedure);
  }

  private startWithTargets(targets: ReaTargets, owner: string, input: string, operation: string = 'auto', procedure?: string): ReaJob {
    this.requireAvailable();
    if (!owner) throw new ReaError('Authentication required.', 401);
    if (typeof input !== 'string' || !input.trim() || input.length > 32768) throw new ReaError('A local target path is required.');
    if (!REA_OPERATIONS.includes(operation as ReaOperation)) throw new ReaError('Unsupported REA operation.');
    if (procedure !== undefined && (typeof procedure !== 'string' || operation !== 'native' || procedure.length > 256 || /[\r\n\0]/.test(procedure))) throw new ReaError('A procedure name or address is supported only for native analysis.');
    if (this.queue.length >= 4) throw new ReaError('REA queue is full. Wait for an analysis to finish.', 429);
    const job: ReaJob = { id: crypto.randomUUID(), owner, target: path.basename(input), operation: operation as ReaOperation,
      procedure, status: 'queued', createdAt: new Date().toISOString() };
    const root = this.jobs.directory(job.id);
    try {
      const snapshot = targets.snapshot(input, root);
      const { path: _snapshotPath, ...metadata } = snapshot;
      job.input = metadata;
      this.jobs.save(job);
      this.queue.push(job);
      void this.drain();
      return job;
    } catch (error) {
      fs.rmSync(root, { recursive: true, force: true });
      throw error;
    }
  }

  upload(owner: string, filename: string, content: Buffer, operation = 'auto', procedure?: string): ReaJob {
    this.requireAvailable();
    if (!content.length || content.length > this.config.maxInputBytes) throw new ReaError('Artifact exceeds the REA upload budget.', 413);
    const name = path.basename(filename.replace(/\\/g, '/'));
    if (!name || name === '.' || name === '..' || /[:\0]/.test(name)) throw new ReaError('Invalid artifact name.');
    // The private upload staging directory is temporarily approved only for this call.
    const directory = path.join(this.config.dataRoot, 'uploads', crypto.randomUUID());
    fs.mkdirSync(directory, { recursive: true });
    const target = path.join(directory, name);
    fs.writeFileSync(target, content, { flag: 'wx' });
    const uploader = new ReaTargets({ ...this.config, allowedRoots: [directory] });
    try {
      return this.startWithTargets(uploader, owner, target, operation, procedure);
    } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  }

  get(id: string, owner: string): ReaJob { return this.jobs.get(id, owner); }
  list(owner: string): ReaJob[] { return this.jobs.list(owner).slice(0, 30); }
  shutdown(): void {
    this.stopped = true;
    for (const job of [...this.queue, ...(this.active ? [this.active.job] : [])]) {
      if (!['queued', 'running'].includes(job.status)) continue;
      job.status = 'interrupted'; job.error = 'The REA service stopped before analysis finished. Start a new analysis to retry.';
      job.finishedAt = new Date().toISOString(); this.jobs.save(job);
    }
    this.queue.length = 0;
    this.active?.client?.disconnect();
  }
  delete(id: string, owner: string): void {
    const job = this.get(id, owner);
    if (['queued', 'running'].includes(job.status) || this.active?.job.id === id) throw new ReaError('Wait for analysis to stop before deleting it.', 409);
    fs.rmSync(this.jobs.directory(id), { recursive: true, force: true });
  }

  cancel(id: string, owner: string): ReaJob {
    const job = this.get(id, owner);
    if (!['queued', 'running'].includes(job.status)) return job;
    job.status = 'cancelled'; job.finishedAt = new Date().toISOString();
    const index = this.queue.findIndex(item => item.id === id);
    if (index >= 0) this.queue.splice(index, 1);
    if (this.active?.job.id === id) { this.active.job.status = 'cancelled'; this.active.client?.disconnect(); }
    this.jobs.save(job);
    return job;
  }

  evidence(id: string, owner: string): string {
    const job = this.get(id, owner);
    const file = path.join(this.jobs.directory(id), 'evidence.json');
    if (!job.evidenceSha256 || !fs.existsSync(file)) throw new ReaError('No exported evidence bundle is available.', 404);
    return file;
  }

  private async drain(): Promise<void> {
    if (this.stopped || this.active || !this.queue.length) return;
    const job = this.queue.shift()!;
    const active: { job: ReaJob; client?: McpClientService } = { job };
    this.active = active;
    const root = this.jobs.directory(job.id);
    job.status = 'running'; this.jobs.save(job);
    let timer: NodeJS.Timeout | undefined;
    try {
      const target = path.join(root, 'input', job.target);
      job.steps = await Promise.race([
        this.runner(this.config, target, job.operation, root, client => { active.client = client; }, undefined, job.procedure),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => { active.client?.disconnect(); reject(new ReaError('REA analysis exceeded its time budget.', 504, 'REA_TIMEOUT')); }, this.config.timeoutMs);
        }),
      ]);
      if (!this.cancelled(job)) {
        const evidence = path.join(root, 'evidence.json');
        if (!fs.existsSync(evidence)) throw new ReaError('REA did not export the required evidence bundle.', 502, 'REA_EVIDENCE_MISSING');
        job.evidenceSha256 = crypto.createHash('sha256').update(fs.readFileSync(evidence)).digest('hex');
        job.status = 'completed';
      }
    } catch (error: any) {
      if (!this.cancelled(job)) {
        job.status = 'failed'; job.error = String(error.message || error).slice(0, 3000);
        if (error.steps) job.steps = error.steps;
        const evidence = path.join(root, 'evidence.json');
        if (fs.existsSync(evidence)) job.evidenceSha256 = crypto.createHash('sha256').update(fs.readFileSync(evidence)).digest('hex');
      }
    } finally {
      if (timer) clearTimeout(timer);
      active.client?.disconnect();
      job.finishedAt = new Date().toISOString();
      this.jobs.save(job); this.active = undefined;
      void this.drain();
    }
  }
  private cancelled(job: ReaJob): boolean { return ['cancelled', 'interrupted'].includes(job.status); }
}
