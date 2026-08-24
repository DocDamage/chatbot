/**
 * Unified Capability Job Lifecycle & Audit Manager (CF-09)
 * Tracks job states, cryptographic digests, captured evidence, and cancellation.
 */

import { createHash } from 'crypto';

export type JobStatus = 'pending_approval' | 'running' | 'completed' | 'failed' | 'cancelled';
export type JobCapabilityCategory = 'agent_teams' | 'browser' | 'video_localization' | 'lattice_gamedev' | 'findings_analysis' | 'code_workflow';

export interface JobEvidenceRecord {
  type: string;
  description: string;
  path?: string;
  digest: string;
  timestamp: string;
  dataPreview?: Record<string, unknown>;
}

export interface CapabilityJob {
  id: string;
  capabilityId: string;
  category: JobCapabilityCategory;
  title: string;
  requester: string;
  status: JobStatus;
  startedAt: string;
  completedAt?: string;
  progressPercent?: number;
  evidence: JobEvidenceRecord[];
  auditDigest: string;
  fallbackReason?: string;
  error?: string;
  requiresExactScopeConfirmation?: boolean;
  confirmationScope?: string;
  confirmedAt?: string;
}

export class CapabilityJobManager {
  private static instance: CapabilityJobManager;
  private jobs = new Map<string, CapabilityJob>();

  public static getInstance(): CapabilityJobManager {
    if (!CapabilityJobManager.instance) {
      CapabilityJobManager.instance = new CapabilityJobManager();
    }
    return CapabilityJobManager.instance;
  }

  public registerJob(job: Omit<CapabilityJob, 'id' | 'startedAt' | 'status' | 'evidence' | 'auditDigest'> & { id?: string }): CapabilityJob {
    const id = job.id || `job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const startedAt = new Date().toISOString();
    const status: JobStatus = job.requiresExactScopeConfirmation && !job.confirmedAt ? 'pending_approval' : 'running';
    
    const initialDigest = this.computeAuditDigest(id, status, startedAt, []);
    const fullJob: CapabilityJob = {
      ...job,
      id,
      status,
      startedAt,
      evidence: [],
      auditDigest: initialDigest,
      progressPercent: status === 'running' ? 0 : undefined
    };

    this.jobs.set(id, fullJob);
    return fullJob;
  }

  public getJob(id: string): CapabilityJob | undefined {
    return this.jobs.get(id);
  }

  public listJobs(filter?: { capabilityId?: string; category?: JobCapabilityCategory; status?: JobStatus }): CapabilityJob[] {
    let result = Array.from(this.jobs.values());
    if (filter?.capabilityId) {
      result = result.filter(j => j.capabilityId === filter.capabilityId);
    }
    if (filter?.category) {
      result = result.filter(j => j.category === filter.category);
    }
    if (filter?.status) {
      result = result.filter(j => j.status === filter.status);
    }
    return result.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  public addEvidence(jobId: string, evidence: Omit<JobEvidenceRecord, 'digest' | 'timestamp'> & { digest?: string; timestamp?: string }): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    const timestamp = evidence.timestamp || new Date().toISOString();
    const digest = evidence.digest || this.computeSha256(`${evidence.type}:${evidence.description}:${timestamp}`);
    const record: JobEvidenceRecord = {
      ...evidence,
      timestamp,
      digest
    };

    job.evidence.push(record);
    job.auditDigest = this.computeAuditDigest(job.id, job.status, job.startedAt, job.evidence);
    return true;
  }

  public updateProgress(jobId: string, progressPercent: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') return false;
    job.progressPercent = Math.min(100, Math.max(0, progressPercent));
    return true;
  }

  public completeJob(jobId: string, fallbackReason?: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'cancelled') return false;

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.progressPercent = 100;
    if (fallbackReason) job.fallbackReason = fallbackReason;
    job.auditDigest = this.computeAuditDigest(job.id, job.status, job.startedAt, job.evidence);
    return true;
  }

  public failJob(jobId: string, error: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'cancelled') return false;

    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error;
    job.auditDigest = this.computeAuditDigest(job.id, job.status, job.startedAt, job.evidence);
    return true;
  }

  public cancelJob(jobId: string, reason = 'Cancelled by operator'): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') return false;

    job.status = 'cancelled';
    job.completedAt = new Date().toISOString();
    job.fallbackReason = reason;
    job.auditDigest = this.computeAuditDigest(job.id, job.status, job.startedAt, job.evidence);
    return true;
  }

  public confirmExactScope(jobId: string, confirmedScope: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'pending_approval') return false;

    if (job.confirmationScope && job.confirmationScope !== confirmedScope) {
      return false;
    }

    job.confirmedAt = new Date().toISOString();
    job.status = 'running';
    job.progressPercent = 0;
    job.auditDigest = this.computeAuditDigest(job.id, job.status, job.startedAt, job.evidence);
    return true;
  }

  public clear(): void {
    this.jobs.clear();
  }

  private computeAuditDigest(jobId: string, status: JobStatus, startedAt: string, evidence: JobEvidenceRecord[]): string {
    const evidenceHashes = evidence.map(e => e.digest).join('|');
    return this.computeSha256(`${jobId}:${status}:${startedAt}:${evidenceHashes}`);
  }

  private computeSha256(content: string): string {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }
}
