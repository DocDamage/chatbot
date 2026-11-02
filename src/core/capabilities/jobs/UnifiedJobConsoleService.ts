import * as crypto from 'crypto';

export type JobState =
  | 'queued'
  | 'preflight'
  | 'awaiting_approval'
  | 'running'
  | 'paused'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface ResourceBudget {
  maxMemoryMb: number;
  maxCpuPercent: number;
  timeoutMs: number;
  maxDiskMb: number;
}

export interface DataEgressDeclaration {
  allowExternalEgress: boolean;
  targetEndpoints: string[];
  sensitiveDataSanitized: boolean;
}

export interface JobEventLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'audit';
  stage: string;
  message: string;
  sanitizedMetadata?: Record<string, unknown>;
}

export interface UnifiedJobRecord {
  id: string;
  capabilityId: string;
  packId: string;
  ownerId: string;
  projectId?: string;
  title: string;
  state: JobState;
  stage: string;
  progressPercent: number;
  inputDigest: string;
  approvalDigest?: string;
  resourceBudget: ResourceBudget;
  dataEgress: DataEgressDeclaration;
  events: JobEventLog[];
  artifactsCount: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  error?: {
    code: string;
    message: string;
    recoveryGuidance: string;
  };
}

export class UnifiedJobConsoleService {
  private jobs = new Map<string, UnifiedJobRecord>();

  public createJob(params: {
    capabilityId: string;
    packId: string;
    ownerId: string;
    projectId?: string;
    title: string;
    inputPayload: unknown;
    resourceBudget?: Partial<ResourceBudget>;
    dataEgress?: Partial<DataEgressDeclaration>;
  }): UnifiedJobRecord {
    const id = `job-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const inputDigest = crypto
      .createHash('sha256')
      .update(JSON.stringify(params.inputPayload || {}))
      .digest('hex');

    const job: UnifiedJobRecord = {
      id,
      capabilityId: params.capabilityId,
      packId: params.packId,
      ownerId: params.ownerId,
      projectId: params.projectId,
      title: params.title,
      state: 'queued',
      stage: 'Initialization',
      progressPercent: 0,
      inputDigest,
      resourceBudget: {
        maxMemoryMb: 512,
        maxCpuPercent: 80,
        timeoutMs: 60000,
        maxDiskMb: 200,
        ...params.resourceBudget
      },
      dataEgress: {
        allowExternalEgress: false,
        targetEndpoints: [],
        sensitiveDataSanitized: true,
        ...params.dataEgress
      },
      events: [
        {
          timestamp: new Date().toISOString(),
          level: 'info',
          stage: 'Initialization',
          message: `Job ${id} created for capability ${params.capabilityId}`
        }
      ],
      artifactsCount: 0,
      createdAt: new Date().toISOString()
    };

    this.jobs.set(id, job);
    return job;
  }

  public transitionState(
    jobId: string,
    newState: JobState,
    stage: string,
    progressPercent: number = 0,
    eventMessage?: string,
    errorDetails?: { code: string; message: string; recoveryGuidance: string }
  ): UnifiedJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);

    job.state = newState;
    job.stage = stage;
    job.progressPercent = Math.min(100, Math.max(0, progressPercent));

    if (newState === 'running' && !job.startedAt) {
      job.startedAt = new Date().toISOString();
    }
    if (newState === 'succeeded' || newState === 'failed' || newState === 'cancelled') {
      job.finishedAt = new Date().toISOString();
    }

    if (errorDetails) {
      job.error = errorDetails;
    }

    if (eventMessage) {
      job.events.push({
        timestamp: new Date().toISOString(),
        level: newState === 'failed' ? 'error' : 'info',
        stage,
        message: eventMessage
      });
    }

    return job;
  }

  public recordApproval(jobId: string, approvalDigest: string): UnifiedJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    job.approvalDigest = approvalDigest;
    job.events.push({
      timestamp: new Date().toISOString(),
      level: 'audit',
      stage: 'Approval',
      message: `Exact-scope approval recorded with digest: ${approvalDigest.slice(0, 12)}...`
    });
    return job;
  }

  public getJob(jobId: string): UnifiedJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public listJobs(filter?: {
    capabilityId?: string;
    state?: JobState;
    ownerId?: string;
    projectId?: string;
  }): UnifiedJobRecord[] {
    let result = Array.from(this.jobs.values());
    if (filter?.capabilityId) result = result.filter(j => j.capabilityId === filter.capabilityId);
    if (filter?.state) result = result.filter(j => j.state === filter.state);
    if (filter?.ownerId) result = result.filter(j => j.ownerId === filter.ownerId);
    if (filter?.projectId) result = result.filter(j => j.projectId === filter.projectId);
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public cancelJob(jobId: string, reason: string = 'User requested cancellation'): UnifiedJobRecord {
    return this.transitionState(jobId, 'cancelled', 'Cancelled', 0, `Job cancelled: ${reason}`);
  }

  public retryJob(jobId: string): UnifiedJobRecord {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Job not found: ${jobId}`);
    return this.transitionState(jobId, 'queued', 'Re-queued', 0, 'Job retried after previous failure/cancellation');
  }
}
