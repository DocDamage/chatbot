/**
 * Godot MCP X External Adapter (PX08-T02)
 *
 * Implements IGameEngineAdapter for Godot Engine, managing protocol communication,
 * reduced tool modes, and translating MCP calls into safe engine operations.
 */

import * as path from 'path';
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
  EngineRuntimeOptions,
  EngineAssertionReport,
  EngineProfileSnapshot,
  EngineExportPreset,
  EngineExportResult,
  GameEngineError,
  ToolMode
} from '../engine/GameEngineTypes';
import { IGameEngineAdapter } from '../engine/GameEngineBridge';
import { GodotProjectInspector } from './GodotProjectInspector';
import { GodotProjectManifest } from './GodotProjectManifest';
import { GodotTransactionManager } from './GodotTransactionManager';
import { GodotSceneMutator } from './GodotSceneMutator';
import { GodotScriptMutator } from './GodotScriptMutator';
import { GodotRuntimeBackend, GodotRuntimeRunner } from './GodotRuntimeRunner';
import { GodotAssetPipeline, GodotExportBackend } from './GodotAssetPipeline';

export class GodotMcpXAdapter implements IGameEngineAdapter {
  public readonly engine: EngineType = 'godot';

  private projectRoot = '';
  private toolMode: ToolMode = 'all';
  private connectionState: EngineStatus['state'] = 'disconnected';
  private connectedAt?: string;
  private version = '4.2.x';

  private transactionManager?: GodotTransactionManager;
  private runtimeRunner?: GodotRuntimeRunner;
  private assetPipeline?: GodotAssetPipeline;

  constructor(
    private readonly runtimeBackend?: GodotRuntimeBackend,
    private readonly exportBackend?: GodotExportBackend
  ) {}

  /**
   * Connect to a Godot project directory or MCP endpoint
   */
  public async connect(config: EngineConnectionConfig): Promise<EngineStatus> {
    this.projectRoot = path.resolve(config.projectRoot);
    this.toolMode = config.toolMode || 'all';
    this.version = config.versionOverride || '4.2.x';

    this.transactionManager = new GodotTransactionManager(this.projectRoot);
    this.runtimeRunner = new GodotRuntimeRunner(this.projectRoot, this.runtimeBackend);
    this.assetPipeline = new GodotAssetPipeline(this.projectRoot, this.exportBackend);

    this.connectionState = 'connected';
    this.connectedAt = new Date().toISOString();

    return this.getStatus();
  }

  /**
   * Disconnect from current project
   */
  public async disconnect(): Promise<void> {
    this.connectionState = 'disconnected';
    this.connectedAt = undefined;
  }

  /**
   * Get current connection status
   */
  public getStatus(): EngineStatus {
    return {
      engine: 'godot',
      state: this.connectionState,
      version: this.version,
      projectPath: this.projectRoot,
      projectName: path.basename(this.projectRoot || 'Unconnected'),
      connectedAt: this.connectedAt,
      toolMode: this.toolMode
    };
  }

  private ensureConnected(): void {
    if (this.connectionState !== 'connected' || !this.transactionManager) {
      throw new GameEngineError('ENGINE_NOT_CONNECTED', 'Godot adapter is not connected to a project');
    }
  }

  /**
   * Inspect project metadata
   */
  public async inspectProject(): Promise<EngineProjectInfo> {
    this.ensureConnected();
    return GodotProjectInspector.inspectProject(this.projectRoot);
  }

  /**
   * Inspect a scene file
   */
  public async inspectScene(scenePath: string): Promise<EngineSceneInfo> {
    this.ensureConnected();
    return GodotProjectInspector.inspectScene(this.projectRoot, scenePath);
  }

  /**
   * Inspect a GDScript file
   */
  public async inspectScript(scriptPath: string): Promise<EngineScriptInfo> {
    this.ensureConnected();
    return GodotProjectInspector.inspectScript(this.projectRoot, scriptPath);
  }

  /**
   * Propose a mutation
   */
  public async proposeMutation(
    proposal: EngineProposalDraft
  ): Promise<EngineMutationProposal> {
    this.ensureConnected();
    return this.transactionManager!.createProposal({
      projectId: proposal.projectId,
      title: proposal.title,
      description: proposal.description,
      risk: proposal.risk,
      actions: proposal.actions
    });
  }

  public async approveMutation(proposalId: string, approverId: string): Promise<EngineMutationProposal> {
    this.ensureConnected();
    return this.transactionManager!.approveProposal(proposalId, approverId);
  }

  /**
   * Apply an approved mutation
   */
  public async applyMutation(
    proposalId: string,
    approvalDigest: string,
    options?: { callerId?: string; tenantId?: string }
  ): Promise<EngineTransaction> {
    this.ensureConnected();
    return this.transactionManager!.executeTransaction(
      proposalId,
      approvalDigest,
      async (action, root) => {
        if (action.type === 'create_script' || action.type === 'update_script') {
          await GodotScriptMutator.applyAction(action, root);
        } else {
          await GodotSceneMutator.applyAction(action, root);
        }
      },
      options
    );
  }

  /**
   * Roll back a transaction
   */
  public async rollbackTransaction(transactionId: string): Promise<boolean> {
    this.ensureConnected();
    return this.transactionManager!.rollbackTransaction(transactionId);
  }

  /**
   * Run runtime scenario assertions
   */
  public async runRuntimeScenario(
    options: EngineRuntimeOptions,
    assertions: any[] = []
  ): Promise<EngineAssertionReport> {
    this.ensureConnected();
    return this.runtimeRunner!.runScenario(options, assertions);
  }

  /**
   * Capture profile performance
   */
  public async profilePerformance(durationMs?: number): Promise<EngineProfileSnapshot> {
    this.ensureConnected();
    if (!this.runtimeBackend?.profileProject) {
      throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'GODOT_PROFILER_BACKEND_UNAVAILABLE: live metrics require a verified Godot runtime backend.');
    }
    return this.runtimeBackend.profileProject(this.projectRoot, durationMs);
  }

  /**
   * Export build artifact
   */
  public async exportProject(preset: EngineExportPreset): Promise<EngineExportResult> {
    this.ensureConnected();
    const outDir = path.join(this.projectRoot, 'builds');
    return this.assetPipeline!.exportPreset(preset, outDir);
  }

  /**
   * Access underlying transaction manager
   */
  public getTransactionManager(): GodotTransactionManager {
    this.ensureConnected();
    return this.transactionManager!;
  }
}
