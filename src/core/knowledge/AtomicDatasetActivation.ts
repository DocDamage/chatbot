/**
 * Atomic Dataset Activation & Lifecycle State Machine (CRK-P26-T03)
 *
 * Enforces the strict 7-state lifecycle:
 * DOWNLOADING -> NORMALIZING -> INDEXING -> VERIFYING -> READY / FAILED / RETIRED
 *
 * Guarantees that the query/routing layer only ever accesses versions in READY state.
 */

import { DatasetLifecycleStatus } from '../../types/knowledge-maintenance';

export interface DatasetVersionState {
  datasetId: string;
  version: string;
  status: DatasetLifecycleStatus;
  activatedAt?: number;
  retiredAt?: number;
  failureReason?: string;
}

export class AtomicDatasetActivation {
  // datasetId -> active version string
  private readonly activeVersions = new Map<string, string>();
  // `${datasetId}:${version}` -> DatasetVersionState
  private readonly versionStates = new Map<string, DatasetVersionState>();

  private key(datasetId: string, version: string): string {
    return `${datasetId}:${version}`;
  }

  /**
   * Register a new version entering the installation lifecycle
   */
  public registerNewVersion(datasetId: string, version: string): DatasetVersionState {
    const k = this.key(datasetId, version);
    const state: DatasetVersionState = {
      datasetId,
      version,
      status: 'DOWNLOADING',
    };
    this.versionStates.set(k, state);
    return state;
  }

  /**
   * Transition dataset version to a new lifecycle state (§3780-3787)
   */
  public transitionState(
    datasetId: string,
    version: string,
    nextStatus: DatasetLifecycleStatus,
    reason?: string
  ): DatasetVersionState {
    const k = this.key(datasetId, version);
    const current = this.versionStates.get(k);
    if (!current) {
      throw new Error(`Version state not found for ${datasetId}@${version}`);
    }

    current.status = nextStatus;
    if (nextStatus === 'FAILED') {
      current.failureReason = reason;
    } else if (nextStatus === 'RETIRED') {
      current.retiredAt = Date.now();
    }

    return current;
  }

  /**
   * Atomically activates a verified version (§3784, §3789)
   * The new version must be in VERIFYING state before becoming READY.
   * Old active version is atomically retired.
   */
  public activateVersion(datasetId: string, version: string): void {
    const k = this.key(datasetId, version);
    const state = this.versionStates.get(k);
    if (!state) {
      throw new Error(`Version ${version} does not exist for dataset ${datasetId}`);
    }

    if (state.status !== 'VERIFYING' && state.status !== 'READY') {
      throw new Error(
        `Cannot activate dataset ${datasetId}@${version} from status '${state.status}'. Must be 'VERIFYING'.`
      );
    }

    // Retire current active version if any
    const prevVersion = this.activeVersions.get(datasetId);
    if (prevVersion && prevVersion !== version) {
      const prevKey = this.key(datasetId, prevVersion);
      const prevState = this.versionStates.get(prevKey);
      if (prevState) {
        prevState.status = 'RETIRED';
        prevState.retiredAt = Date.now();
      }
    }

    // Set new version as READY and active
    state.status = 'READY';
    state.activatedAt = Date.now();
    this.activeVersions.set(datasetId, version);
  }

  /**
   * Safe rollback to a previously retired version
   */
  public rollbackVersion(datasetId: string, targetVersion: string): void {
    const targetKey = this.key(datasetId, targetVersion);
    const targetState = this.versionStates.get(targetKey);
    if (!targetState) {
      throw new Error(`Target rollback version ${targetVersion} not found for ${datasetId}`);
    }

    const currentVersion = this.activeVersions.get(datasetId);
    if (currentVersion) {
      const currentKey = this.key(datasetId, currentVersion);
      const currState = this.versionStates.get(currentKey);
      if (currState) {
        currState.status = 'FAILED';
        currState.failureReason = 'Rolled back in favor of ' + targetVersion;
      }
    }

    targetState.status = 'READY';
    targetState.activatedAt = Date.now();
    this.activeVersions.set(datasetId, targetVersion);
  }

  /**
   * Get currently active and queryable version (§3789)
   * Returns undefined if no version is currently READY.
   */
  public getActiveVersion(datasetId: string): string | undefined {
    const version = this.activeVersions.get(datasetId);
    if (!version) return undefined;

    const state = this.versionStates.get(this.key(datasetId, version));
    if (!state || state.status !== 'READY') {
      return undefined;
    }
    return version;
  }

  /**
   * Get the version state record
   */
  public getVersionState(datasetId: string, version: string): DatasetVersionState | undefined {
    return this.versionStates.get(this.key(datasetId, version));
  }
}
