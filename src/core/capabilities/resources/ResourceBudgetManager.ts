/**
 * Resource Budget & Quota Manager (PX-02 / PX02-T08)
 * Enforces execution deadlines, CPU concurrency, memory ceilings,
 * disk space, network egress, token consumption, and process quotas.
 */

export interface ResourceBudget {
  deadlineMs: number;
  maxCpuConcurrency: number;
  ramEstimateBytes?: number;
  ramCeilingBytes: number;
  vramEstimateBytes?: number;
  vramCeilingBytes?: number;
  diskReservationBytes: number;
  maxOutputBytes: number;
  maxNetworkBytes: number;
  maxTokens?: number;
  maxProcessCount: number;
  queuePriority: 'low' | 'normal' | 'high' | 'critical';
  cancellationGracePeriodMs: number;
}

export interface ResourceUsageSnapshot {
  cpuActive: number;
  ramUsedBytes: number;
  vramUsedBytes?: number;
  diskUsedBytes: number;
  networkBytesTransferred: number;
  tokensConsumed: number;
  processesSpawned: number;
}

export const DEFAULT_LOCAL_RESOURCE_BUDGET: ResourceBudget = {
  deadlineMs: 300000, // 5 minutes
  maxCpuConcurrency: 4,
  ramCeilingBytes: 4 * 1024 * 1024 * 1024, // 4GB
  diskReservationBytes: 1024 * 1024 * 1024, // 1GB
  maxOutputBytes: 50 * 1024 * 1024, // 50MB
  maxNetworkBytes: 100 * 1024 * 1024, // 100MB
  maxProcessCount: 2,
  queuePriority: 'normal',
  cancellationGracePeriodMs: 5000,
};

export const DEFAULT_HOSTED_RESOURCE_BUDGET: ResourceBudget = {
  deadlineMs: 60000, // 1 minute
  maxCpuConcurrency: 2,
  ramCeilingBytes: 1024 * 1024 * 1024, // 1GB
  diskReservationBytes: 100 * 1024 * 1024, // 100MB
  maxOutputBytes: 10 * 1024 * 1024, // 10MB
  maxNetworkBytes: 20 * 1024 * 1024, // 20MB
  maxTokens: 50000,
  maxProcessCount: 0, // No local process spawn allowed in hosted
  queuePriority: 'normal',
  cancellationGracePeriodMs: 3000,
};

export class ResourceBudgetManager {
  private static instance: ResourceBudgetManager;
  private activeBudgets = new Map<string, { budget: ResourceBudget; usage: ResourceUsageSnapshot }>();

  public static getInstance(): ResourceBudgetManager {
    if (!ResourceBudgetManager.instance) {
      ResourceBudgetManager.instance = new ResourceBudgetManager();
    }
    return ResourceBudgetManager.instance;
  }

  public registerBudget(jobId: string, customBudget?: Partial<ResourceBudget>, profile: 'HOSTED' | 'LOCAL_TRUSTED' = 'LOCAL_TRUSTED'): ResourceBudget {
    const base = profile === 'HOSTED' ? DEFAULT_HOSTED_RESOURCE_BUDGET : DEFAULT_LOCAL_RESOURCE_BUDGET;
    const merged: ResourceBudget = { ...base, ...customBudget };

    this.activeBudgets.set(jobId, {
      budget: merged,
      usage: {
        cpuActive: 1,
        ramUsedBytes: 0,
        diskUsedBytes: 0,
        networkBytesTransferred: 0,
        tokensConsumed: 0,
        processesSpawned: 0
      }
    });

    return merged;
  }

  public checkBudgetViolation(jobId: string): { violated: boolean; reason?: string } {
    const entry = this.activeBudgets.get(jobId);
    if (!entry) return { violated: false };

    const { budget, usage } = entry;

    if (usage.ramUsedBytes > budget.ramCeilingBytes) {
      return { violated: true, reason: `RAM ceiling exceeded: ${usage.ramUsedBytes} > ${budget.ramCeilingBytes} bytes` };
    }

    if (usage.networkBytesTransferred > budget.maxNetworkBytes) {
      return { violated: true, reason: `Network egress ceiling exceeded: ${usage.networkBytesTransferred} > ${budget.maxNetworkBytes} bytes` };
    }

    if (usage.processesSpawned > budget.maxProcessCount) {
      return { violated: true, reason: `Process count limit exceeded: ${usage.processesSpawned} > ${budget.maxProcessCount}` };
    }

    if (budget.maxTokens && usage.tokensConsumed > budget.maxTokens) {
      return { violated: true, reason: `Token budget exceeded: ${usage.tokensConsumed} > ${budget.maxTokens}` };
    }

    return { violated: false };
  }

  public recordUsage(jobId: string, delta: Partial<ResourceUsageSnapshot>): void {
    const entry = this.activeBudgets.get(jobId);
    if (!entry) return;

    if (delta.ramUsedBytes !== undefined) entry.usage.ramUsedBytes = delta.ramUsedBytes;
    if (delta.diskUsedBytes !== undefined) entry.usage.diskUsedBytes += delta.diskUsedBytes;
    if (delta.networkBytesTransferred !== undefined) entry.usage.networkBytesTransferred += delta.networkBytesTransferred;
    if (delta.tokensConsumed !== undefined) entry.usage.tokensConsumed += delta.tokensConsumed;
    if (delta.processesSpawned !== undefined) entry.usage.processesSpawned += delta.processesSpawned;
  }

  public releaseBudget(jobId: string): void {
    this.activeBudgets.delete(jobId);
  }
}
