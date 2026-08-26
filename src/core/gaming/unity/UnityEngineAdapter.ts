/**
 * Unity Engine Adapter (PX09-T02)
 *
 * Implements IGameEngineAdapter for Unity projects with modular prefab
 * inspection, MAST layout generation, and undo-safe mutation proposals.
 */

import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
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
import { UnityMastService } from './UnityMastService';
import { NativeEditorBackend } from '../engine/NativeEditorBackend';
import { ProjectMutationStore } from '../engine/ProjectMutationStore';
import { resolveProjectPath } from '../engine/ProjectPathGuard';

export class UnityEngineAdapter implements IGameEngineAdapter {
  public readonly engine: EngineType = 'unity';

  private projectRoot = '';
  private connectionState: EngineStatus['state'] = 'disconnected';
  private connectedAt?: string;
  private version = '2022.3 LTS';
  private mutationStore?: ProjectMutationStore;

  constructor(private readonly editorBackend?: NativeEditorBackend) {}

  /**
   * Connect to a Unity project root directory
   */
  public async connect(config: EngineConnectionConfig): Promise<EngineStatus> {
    this.projectRoot = path.resolve(config.projectRoot);
    this.version = config.versionOverride || '2022.3 LTS';

    const assetsDir = path.join(this.projectRoot, 'Assets');
    if (!fs.existsSync(assetsDir)) {
      throw new GameEngineError('SCENE_NOT_FOUND', `Unity project Assets directory not found: ${assetsDir}`);
    }

    this.connectionState = 'connected';
    this.connectedAt = new Date().toISOString();
    this.mutationStore = new ProjectMutationStore('unity', this.projectRoot);

    return this.getStatus();
  }

  /**
   * Disconnect from Unity session
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
      engine: 'unity',
      state: this.connectionState,
      version: this.version,
      projectPath: this.projectRoot,
      projectName: path.basename(this.projectRoot || 'Unconnected'),
      connectedAt: this.connectedAt,
      toolMode: 'all'
    };
  }

  private ensureConnected(): void {
    if (this.connectionState !== 'connected') {
      throw new GameEngineError('ENGINE_NOT_CONNECTED', 'Unity adapter is not connected');
    }
  }

  /**
   * Inspect Unity project assets and scenes
   */
  public async inspectProject(): Promise<EngineProjectInfo> {
    this.ensureConnected();
    const assetsDir = path.join(this.projectRoot, 'Assets');
    const scenes: string[] = [];
    const scripts: string[] = [];
    const resources: string[] = [];
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
          if (ext === '.unity') scenes.push(rel);
          else if (ext === '.cs') scripts.push(rel);
          else if (ext === '.mat' || ext === '.prefab' || ext === '.asset') resources.push(rel);
          else if (['.png', '.jpg', '.fbx', '.wav'].includes(ext)) assets.push(rel);
        }
      }
    };

    if (fs.existsSync(assetsDir)) {
      scan(assetsDir);
    }

    return {
      name: path.basename(this.projectRoot),
      path: this.projectRoot,
      engine: 'unity',
      engineVersion: this.version,
      scenes,
      scripts,
      resources,
      assets,
      configSummary: { backend: 'Mono', apiCompatibility: '.NET Standard 2.1' }
    };
  }

  /**
   * Inspect Unity scene (.unity)
   */
  public async inspectScene(scenePath: string): Promise<EngineSceneInfo> {
    this.ensureConnected();
    if (this.editorBackend?.inspectScene) return this.editorBackend.inspectScene('unity', this.projectRoot, scenePath);
    const full = resolveProjectPath(this.projectRoot, scenePath);
    if (!fs.existsSync(full)) throw new GameEngineError('SCENE_NOT_FOUND', `Unity scene not found: ${scenePath}`);
    const content = fs.readFileSync(full, 'utf8');
    const names = Array.from(content.matchAll(/^\s*m_Name:\s*(.+)$/gm)).map(match => match[1].trim()).filter(Boolean);
    const rootName = names[0] || path.basename(scenePath, path.extname(scenePath));
    return {
      path: scenePath,
      name: rootName,
      rootNode: {
        id: `unity-scene:${scenePath}`,
        name: rootName,
        type: 'UnityScene',
        children: names.slice(1, 1000).map((name, index) => ({ id: `unity-object:${index}`, name, type: 'GameObject', children: [], properties: {} })),
        properties: { serialization: 'yaml' }
      },
      nodeCount: names.length,
      dependencies: Array.from(content.matchAll(/guid:\s*([a-f0-9]{32})/gi)).map(match => match[1]),
      isMainScene: false
    };
  }

  /**
   * Inspect C# script
   */
  public async inspectScript(scriptPath: string): Promise<EngineScriptInfo> {
    this.ensureConnected();
    const full = resolveProjectPath(this.projectRoot, scriptPath);
    if (!fs.existsSync(full)) throw new GameEngineError('SCENE_NOT_FOUND', `Unity script not found: ${scriptPath}`);
    const content = fs.readFileSync(full, 'utf8');
    const methods = Array.from(content.matchAll(/\b(?:public|private|protected|internal)?\s*(?:static\s+)?[A-Za-z_][\w<>,\[\]?]*\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/g))
      .map(match => ({ name: match[1], args: match[2].split(',').map(arg => arg.trim()).filter(Boolean) }));

    return {
      path: scriptPath,
      language: 'csharp',
      extendsClass: content.match(/:\s*([A-Za-z_]\w*)/)?.[1],
      methods,
      properties: [],
      signals: [],
      linesOfCode: content.split('\n').length,
      digest: crypto.createHash('sha256').update(content).digest('hex')
    };
  }

  /**
   * Propose a mutation or MAST placement layout
   */
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

  /**
   * Apply mutation
   */
  public async applyMutation(proposalId: string, approvalDigest: string): Promise<EngineTransaction> {
    this.ensureConnected();
    return this.mutationStore!.apply(proposalId, approvalDigest);
  }

  /**
   * Roll back mutation
   */
  public async rollbackTransaction(transactionId: string): Promise<boolean> {
    this.ensureConnected();
    return this.mutationStore!.rollback(transactionId);
  }

  /**
   * Run runtime scenario
   */
  public async runRuntimeScenario(
    options: EngineRuntimeOptions,
    assertions: any[] = []
  ): Promise<EngineAssertionReport> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unity')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNITY_EDITOR_BACKEND_UNAVAILABLE: Unity Editor is not installed or configured.');
    return this.editorBackend.runScenario('unity', this.projectRoot, options, assertions);
  }

  /**
   * Profile performance
   */
  public async profilePerformance(durationMs?: number): Promise<EngineProfileSnapshot> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unity')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNITY_EDITOR_BACKEND_UNAVAILABLE: Unity Editor is not installed or configured.');
    return this.editorBackend.profile('unity', this.projectRoot, durationMs);
  }

  /**
   * Export build
   */
  public async exportProject(preset: EngineExportPreset): Promise<EngineExportResult> {
    this.ensureConnected();
    if (!this.editorBackend?.isAvailable('unity')) throw new GameEngineError('RUNTIME_EXECUTION_FAILED', 'UNITY_EDITOR_BACKEND_UNAVAILABLE: Unity Editor is not installed or configured.');
    return this.editorBackend.exportProject('unity', this.projectRoot, preset);
  }
}
