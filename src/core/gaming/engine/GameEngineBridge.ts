/**
 * Game Engine Bridge Core (PX08-T01)
 *
 * Server-authoritative engine bridge managing adapter lifecycles, project confinement,
 * profile security enforcement, and unified dispatch.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  EngineType,
  EngineConnectionConfig,
  EngineStatus,
  EngineProjectInfo,
  EngineSceneInfo,
  EngineScriptInfo,
  EngineMutationProposal,
  EngineProposalDraft,
  EngineTransaction,
  EngineAssertionReport,
  EngineProfileSnapshot,
  EngineExportPreset,
  EngineExportResult,
  EngineRuntimeOptions,
  GameEngineError
} from './GameEngineTypes';
import { resolveDeploymentMode, RuntimeProfile } from '../../config/EnvironmentDefinitions';
import { ENGINE_CERTIFICATION_PROFILES, EngineCertificationProfile } from './EngineCertificationProfile';

export interface IGameEngineAdapter {
  readonly engine: EngineType;
  connect(config: EngineConnectionConfig): Promise<EngineStatus>;
  disconnect(): Promise<void>;
  getStatus(): EngineStatus;
  inspectProject(): Promise<EngineProjectInfo>;
  inspectScene(scenePath: string): Promise<EngineSceneInfo>;
  inspectScript(scriptPath: string): Promise<EngineScriptInfo>;
  proposeMutation(proposal: EngineProposalDraft): Promise<EngineMutationProposal>;
  approveMutation(proposalId: string, approverId: string): Promise<EngineMutationProposal>;
  applyMutation(proposalId: string, approvalDigest: string, options?: { callerId?: string; tenantId?: string }): Promise<EngineTransaction>;
  rollbackTransaction(transactionId: string): Promise<boolean>;
  runRuntimeScenario(options: EngineRuntimeOptions, assertions?: any[]): Promise<EngineAssertionReport>;
  profilePerformance(durationMs?: number): Promise<EngineProfileSnapshot>;
  exportProject(preset: EngineExportPreset): Promise<EngineExportResult>;
}

export class GameEngineBridge {
  private adapters = new Map<EngineType, IGameEngineAdapter>();
  private activeConnections = new Map<EngineType, EngineStatus>();
  private approvedRoots = new Set<string>();

  constructor(private readonly runtimeProfile: RuntimeProfile = resolveDeploymentMode()) {}

  /**
   * Register an engine adapter implementation
   */
  public registerAdapter(adapter: IGameEngineAdapter): void {
    this.adapters.set(adapter.engine, adapter);
  }

  /**
   * Add an approved project root directory for local workspace safety
   */
  public addApprovedRoot(rootPath: string): void {
    const resolved = path.resolve(rootPath);
    this.approvedRoots.add(resolved);
  }

  /**
   * Clear approved roots
   */
  public clearApprovedRoots(): void {
    this.approvedRoots.clear();
  }

  /**
   * Validate that an engine project root is within approved boundaries
   */
  public validateProjectRoot(targetPath: string): string {
    // Hosted mode strictly denies local game engine operations
    if (this.runtimeProfile === 'hosted') {
      throw new GameEngineError(
        'HOSTED_MODE_DENIED',
        'Game Engine Bridge and desktop editor control are strictly disabled in hosted deployment profile'
      );
    }

    const resolved = path.resolve(targetPath);

    if (this.approvedRoots.size > 0) {
      let isAllowed = false;
      for (const root of this.approvedRoots) {
        if (resolved === root || resolved.startsWith(root + path.sep)) {
          isAllowed = true;
          break;
        }
      }
      if (!isAllowed) {
        throw new GameEngineError(
          'OUT_OF_BOUNDS_PATH',
          `Project path '${targetPath}' is outside approved workspace roots`,
          { targetPath: resolved, approvedRoots: Array.from(this.approvedRoots) }
        );
      }
    }

    return resolved;
  }

  /**
   * Connect to a game engine project
   */
  public async connect(config: EngineConnectionConfig): Promise<EngineStatus> {
    const verifiedRoot = this.validateProjectRoot(config.projectRoot);
    const adapter = this.adapters.get(config.engine);

    if (!adapter) {
      throw new GameEngineError(
        'ENGINE_NOT_CONNECTED',
        `No adapter registered for engine type: ${config.engine}`
      );
    }

    const status = await adapter.connect({
      ...config,
      projectRoot: verifiedRoot
    });

    this.activeConnections.set(config.engine, status);
    return status;
  }

  /**
   * Disconnect an active engine session
   */
  public async disconnect(engine: EngineType): Promise<void> {
    const adapter = this.adapters.get(engine);
    if (adapter) {
      await adapter.disconnect();
      this.activeConnections.delete(engine);
    }
  }

  /**
   * Get connection status for an engine
   */
  public getStatus(engine: EngineType): EngineStatus {
    const adapter = this.adapters.get(engine);
    if (!adapter) {
      return {
        engine,
        state: 'disconnected',
        version: 'unknown',
        projectPath: '',
        projectName: '',
        toolMode: 'minimal'
      };
    }
    return adapter.getStatus();
  }

  /**
   * List all active connections
   */
  public listActiveConnections(): EngineStatus[] {
    return Array.from(this.activeConnections.values());
  }

  /**
   * Get adapter certification profile
   */
  public getCertificationProfile(engine: EngineType): EngineCertificationProfile {
    return ENGINE_CERTIFICATION_PROFILES[engine] || ENGINE_CERTIFICATION_PROFILES.custom;
  }

  /**
   * Safe getter for active adapter
   */
  public getAdapter(engine: EngineType): IGameEngineAdapter {
    const adapter = this.adapters.get(engine);
    if (!adapter) {
      throw new GameEngineError(
        'ENGINE_NOT_CONNECTED',
        `Engine adapter not registered or connected for '${engine}'`
      );
    }
    return adapter;
  }

  /**
   * Inspect project metadata
   */
  public async inspectProject(engine: EngineType): Promise<EngineProjectInfo> {
    return this.getAdapter(engine).inspectProject();
  }

  /**
   * Inspect scene structure
   */
  public async inspectScene(engine: EngineType, scenePath: string): Promise<EngineSceneInfo> {
    return this.getAdapter(engine).inspectScene(scenePath);
  }

  /**
   * Inspect script symbols
   */
  public async inspectScript(engine: EngineType, scriptPath: string): Promise<EngineScriptInfo> {
    return this.getAdapter(engine).inspectScript(scriptPath);
  }

  /**
   * Propose a mutation
   */
  public async proposeMutation(
    engine: EngineType,
    proposal: EngineProposalDraft
  ): Promise<EngineMutationProposal> {
    return this.getAdapter(engine).proposeMutation(proposal);
  }

  /**
   * Explicitly approve an exact mutation proposal before it can be applied
   */
  public async approveMutation(
    engine: EngineType,
    proposalId: string,
    approverId: string
  ): Promise<EngineMutationProposal> {
    return this.getAdapter(engine).approveMutation(proposalId, approverId);
  }

  /**
   * Apply an approved mutation transaction
   */
  public async applyMutation(
    engine: EngineType,
    proposalId: string,
    approvalDigest: string,
    options?: { callerId?: string; tenantId?: string }
  ): Promise<EngineTransaction> {
    return this.getAdapter(engine).applyMutation(proposalId, approvalDigest, options);
  }

  /**
   * Roll back a previous transaction
   */
  public async rollbackTransaction(engine: EngineType, transactionId: string): Promise<boolean> {
    return this.getAdapter(engine).rollbackTransaction(transactionId);
  }

  /**
   * Run runtime play scenario with assertions
   */
  public async runRuntimeScenario(
    engine: EngineType,
    options: EngineRuntimeOptions,
    assertions?: any[]
  ): Promise<EngineAssertionReport> {
    return this.getAdapter(engine).runRuntimeScenario(options, assertions);
  }

  /**
   * Profile performance snapshot
   */
  public async profilePerformance(engine: EngineType, durationMs?: number): Promise<EngineProfileSnapshot> {
    return this.getAdapter(engine).profilePerformance(durationMs);
  }

  /**
   * Export build artifact
   */
  public async exportProject(engine: EngineType, preset: EngineExportPreset): Promise<EngineExportResult> {
    return this.getAdapter(engine).exportProject(preset);
  }
}
