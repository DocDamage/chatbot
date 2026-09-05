/**
 * Dataset Refresh Scheduler (CRK-P26-T01)
 *
 * Coordinates scheduled and policy-driven background dataset updates,
 * evaluates dataset staleness, computes refresh order by dependencies,
 * and schedules refresh tasks within concurrency limits.
 */

import {
  DatasetRefreshPolicy,
  RefreshCadence,
} from '../../types/knowledge-maintenance';

export interface RefreshCandidate {
  datasetId: string;
  cadence: RefreshCadence;
  isStale: boolean;
  stalenessMs: number;
  priority: number;
}

export class DatasetRefreshScheduler {
  private readonly policies = new Map<string, DatasetRefreshPolicy>();

  constructor() {
    this.registerDefaultPolicies();
  }

  /**
   * Register default refresh recommendations (§3748-3756)
   */
  private registerDefaultPolicies(): void {
    // Official technical docs: release/version check + periodic check (daily)
    this.registerPolicy({
      datasetId: 'official-docs-ts',
      cadence: 'daily',
      intervalMs: 24 * 60 * 60 * 1000,
      autoUpdateEnabled: true,
      dependencies: [],
    });

    // Developer Q&A: incremental sync + periodic reconciliation (daily)
    this.registerPolicy({
      datasetId: 'developer-qa-so',
      cadence: 'daily',
      intervalMs: 24 * 60 * 60 * 1000,
      autoUpdateEnabled: true,
      dependencies: [],
    });

    // Wikipedia/Wikidata: periodic snapshot update (monthly)
    this.registerPolicy({
      datasetId: 'wikidata-core',
      cadence: 'monthly',
      intervalMs: 30 * 24 * 60 * 60 * 1000,
      autoUpdateEnabled: true,
      dependencies: [],
    });

    // Selected repositories: commit-driven
    this.registerPolicy({
      datasetId: 'source-code-curated',
      cadence: 'commit-driven',
      intervalMs: 12 * 60 * 60 * 1000,
      autoUpdateEnabled: true,
      dependencies: [],
    });

    // Research: incremental (weekly)
    this.registerPolicy({
      datasetId: 'research-papers-arxiv',
      cadence: 'weekly',
      intervalMs: 7 * 24 * 60 * 60 * 1000,
      autoUpdateEnabled: true,
      dependencies: [],
    });

    // Static corpora / FineWeb-Edu: release-driven (monthly)
    this.registerPolicy({
      datasetId: 'educational-web-fineweb',
      cadence: 'release-driven',
      intervalMs: 30 * 24 * 60 * 60 * 1000,
      autoUpdateEnabled: false, // manual or release-triggered
      dependencies: [],
    });
  }

  public registerPolicy(policy: DatasetRefreshPolicy): void {
    this.policies.set(policy.datasetId, { ...policy });
  }

  public getPolicy(datasetId: string): DatasetRefreshPolicy | undefined {
    return this.policies.get(datasetId);
  }

  /**
   * Record a completed refresh timestamp
   */
  public markRefreshed(datasetId: string, timestamp = Date.now()): void {
    const policy = this.policies.get(datasetId);
    if (policy) {
      policy.lastRefreshedAt = timestamp;
    }
  }

  /**
   * Evaluates all policies to identify stale datasets (§3736-3746)
   */
  public evaluateStaleness(currentTime = Date.now()): RefreshCandidate[] {
    const candidates: RefreshCandidate[] = [];

    for (const policy of this.policies.values()) {
      if (!policy.autoUpdateEnabled) {
        continue;
      }

      const last = policy.lastRefreshedAt || 0;
      const elapsed = currentTime - last;
      const isStale = elapsed >= policy.intervalMs;

      // Higher priority given to datasets with higher elapsed ratio
      const priority = isStale ? Math.round((elapsed / policy.intervalMs) * 100) : 0;

      candidates.push({
        datasetId: policy.datasetId,
        cadence: policy.cadence,
        isStale,
        stalenessMs: Math.max(0, elapsed - policy.intervalMs),
        priority,
      });
    }

    // Sort descending by priority, so most overdue datasets refresh first
    return candidates.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Determines ordered refresh sequence respecting dataset dependencies (§3748)
   */
  public getExecutionOrder(datasetIds: string[]): string[] {
    const visited = new Set<string>();
    const order: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const policy = this.policies.get(id);
      if (policy && policy.dependencies) {
        for (const dep of policy.dependencies) {
          if (datasetIds.includes(dep)) {
            visit(dep);
          }
        }
      }
      order.push(id);
    };

    for (const id of datasetIds) {
      visit(id);
    }

    return order;
  }
}
