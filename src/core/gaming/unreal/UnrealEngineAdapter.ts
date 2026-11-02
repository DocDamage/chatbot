/**
 * Unreal Engine 5 Adapter (PX09-T06)
 *
 * Implements IGameEngineAdapter for Unreal Engine 5 with read-only asset,
 * actor, Blueprint, and PIE inspection behind the UnrealLicenseGate.
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
  EngineRuntimeOptions,
  EngineAssertionReport,
  EngineProfileSnapshot,
  EngineExportPreset,
  EngineExportResult,
  GameEngineError
} from '../engine/GameEngineTypes';
import { IGameEngineAdapter } from '../engine/GameEngineBridge';
import { UnrealLicenseGate } from './UnrealLicenseGate';
import { resolveProjectPath } from '../engine/ProjectPathGuard';
import * as crypto from 'crypto';
import { NativeEditorBackend } from '../engine/NativeEditorBackend';
import { ProjectMutationStore } from '../engine/ProjectMutationStore';

export class UnrealEngineAdapter implements IGameEngineAdapter {
  public readonly engine: EngineType = 'unreal';

  private projectRoot = '';
  private connectionState: EngineStatus['state'] = 'disconnected';
  private connectedAt?: string;
  private version = '5.4.x';
  private mutationStore?: ProjectMutationStore;

  constructor(private readonly editorBackend?: NativeEditorBackend) {}

  public async connect(config: EngineConnectionConfig): Promise<EngineStatus> {
    UnrealLicenseGate.assertCleared();
    this.projectRoot = path.resolve(config.projectRoot);
    this.version = config.versionOverride || '5.4.x';
    if (!fs.existsSync(this.projectRoot) || !fs.readdirSync(this.projectRoot).some(file => file.endsWith('.uproject'))) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Unreal .uproject descriptor not found in: ${this.projectRoot}`);
    }

    this.connectionState = 'connected';
    this.connectedAt = new Date().toISOString();
    this.mutationStore = new ProjectMutationStore('unreal', this.projectRoot);

    return this.getStatus();
  }

  public async disconnect(): Promise<void> {
    this.connectionState = 'disconnected';
    this.connectedAt = undefined;
  }

  public getStatus(): EngineStatus {
    return {
      engine: 'unreal',
      state: this.connectionState,
      version: this.version,
      projectPath: this.projectRoot,
      projectName: path.basename(this.projectRoot || 'Unconnected'),
      connectedAt: this.connectedAt,
      toolMode: 'minimal'
    };
  }

  private ensureConnected(): void {
    UnrealLicenseGate.assertCleared();
    if (this.connectionState !== 'connected') {
      throw new GameEngineError('ENGINE_NOT_CONNECTED', 'Unreal adapter is not connected');
    }
  }

  public async inspectProject(): Promise<EngineProjectInfo> {
    this.ensureConnected();
    const contentDir = path.join(this.projectRoot, 'Content');
    const scenes: string[] = [];
    const assets: string[] = [];

    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        const rel = path.relative(this.projectRoot, full).replace(/\\/g, '/');

        if (e.isDirectory()) {
          scan(full);
        } else if (e.isFile()) {
          const ext = path.extname(e.name).toLowerCase();
          if (ext === '.umap') scenes.push(rel);
          else if (ext === '.uasset') assets.push(rel);
        }
      }
    };

    if (fs.existsSync(contentDir)) {
      scan(contentDir);
    }

    return {
      name: path.basename(this.projectRoot),
      path: this.projectRoot,
      engine: 'unreal',
      engineVersion: this.version,
      scenes,
      scripts: [],
      resources: [],
      assets,
      configSummary: { descriptorPresent: true, inspectionMode: 'filesystem_only' }
    };
  }

  public async inspectScene(scenePath: string): Promise<EngineSceneInfo> {
    this.ensureConnected();
    if (this.editorBackend?.inspectScene) return this.editorBackend.inspectScene('unreal', this.projectRoot, scenePath);
    const full = resolveProjectPath(this.projectRoot, scenePath);
    if (!fs.existsSync(full)) throw new GameEngineError('SCENE_NOT_FOUND', `Unreal map not found: ${scenePath}`);
    const bytes = fs.readFileSync(full);
    return {
      path: scenePath,
      name: path.basename(scenePath, path.extname(scenePath)),
      rootNode: {
        id: `unreal-map:${scenePath}`,
        name: path.basename(scenePath),
        type: 'UnrealMapBinary',
        children: [],
        properties: { byteSize: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
      },
      nodeCount: 1,
      dependencies: []
    };
  }

  public async inspectScript(scriptPath: string): Promise<EngineScriptInfo> {
    this.ensureConnected();
    const full = resolveProjectPath(this.projectRoot, scriptPath);
    if (!fs.existsSync(full)) throw new GameEngineError('SCENE_NOT_FOUND', `Unreal source file not found: ${scriptPath}`);
    const content = fs.readFileSync(full, 'utf8');
    const methods = Array.from(content.matchAll(/\b([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:const)?\s*(?:;|\{)/g))
      .map(match => ({ name: match[1], args: match[2].split(',').map(arg => arg.trim()).filter(Boolean) }));
    return {
      path: scriptPath,
      language: 'cpp',
      methods,
      properties: [],
      signals: [],
      linesOfCode: content.split('\n').length,
      digest: crypto.createHash('sha256').update(content).digest('hex')
    };
  }

  public async proposeMutation(
    proposal: EngineProposalDraft
  ): Promise<EngineMutationProposal> {
    this.ensureConnected();
    return this.mutationStore!.createProposal(proposal);
  }

  public async approveMutation(proposalId: string, approverId: string): Promise<EngineMutationProposal> {
    this.ensureConnected();
    return this.mutationStore!.approve(proposalId, approverId);
  }

  public async applyMutation(
    proposalId: string,
    approvalDigest: string,
    options?: { callerId?: string; tenantId?: string }
  ): Promise<EngineTransaction> {
    this.ensureConnected();
    return this.mutationStore!.apply(proposalId, approvalDigest, options);
  }

  public async rollbackTransaction(transactionId: string): Promise<boolean> {
    this.ensureConnected();
    return this.mutationStore!.rollback(transactionId);
  }

  public async runRuntimeScenario(
    options: EngineRuntimeOptions,
    assertions: any[] = []
  ): Promise<EngineAssertionReport> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unreal')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNREAL_EDITOR_BACKEND_UNAVAILABLE: Unreal Editor is not installed or configured.');
    return this.editorBackend.runScenario('unreal', this.projectRoot, options, assertions);
  }

  public async profilePerformance(durationMs?: number): Promise<EngineProfileSnapshot> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unreal')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNREAL_EDITOR_BACKEND_UNAVAILABLE: Unreal Editor is not installed or configured.');
    return this.editorBackend.profile('unreal', this.projectRoot, durationMs);
  }

  public async exportProject(preset: EngineExportPreset): Promise<EngineExportResult> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unreal')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNREAL_EDITOR_BACKEND_UNAVAILABLE: Unreal Editor is not installed or configured.');
    return this.editorBackend.exportProject('unreal', this.projectRoot, preset);
  }
}
