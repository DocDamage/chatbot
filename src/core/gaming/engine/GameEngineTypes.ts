/**
 * Game Engine Common Types & Contracts (PX-08 / PX-09)
 *
 * Defines unified interfaces for game engine inspection, scene manipulation,
 * script editing, transactions, profiling, and runtime execution.
 */

export type EngineType = 'godot' | 'unity' | 'unreal' | 'custom';

export type EngineConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export type ToolMode = 'minimal' | '2d' | '3d' | 'ui' | 'test' | 'all';

export type MutationRisk = 'low' | 'medium' | 'high' | 'destructive';

export interface EngineConnectionConfig {
  engine: EngineType;
  projectRoot: string;
  endpoint?: string;
  transport?: 'mcp' | 'cli' | 'websocket' | 'ipc';
  toolMode?: ToolMode;
  timeoutMs?: number;
  authToken?: string;
  versionOverride?: string;
}

export interface EngineStatus {
  engine: EngineType;
  state: EngineConnectionState;
  version: string;
  projectPath: string;
  projectName: string;
  connectedAt?: string;
  toolMode: ToolMode;
  error?: string;
}

export interface EngineProjectInfo {
  name: string;
  path: string;
  engine: EngineType;
  engineVersion: string;
  mainScene?: string;
  scenes: string[];
  scripts: string[];
  resources: string[];
  assets: string[];
  configSummary: Record<string, any>;
}

export interface EngineNodeInfo {
  id: string;
  name: string;
  type: string;
  parentPath?: string;
  children: EngineNodeInfo[];
  properties: Record<string, any>;
  signals?: Array<{ name: string; target: string; method: string }>;
  scriptPath?: string;
  metadata?: Record<string, any>;
}

export interface EngineSceneInfo {
  path: string;
  name: string;
  rootNode: EngineNodeInfo;
  nodeCount: number;
  dependencies: string[];
  isMainScene?: boolean;
}

export interface EngineScriptInfo {
  path: string;
  language: 'gdscript' | 'csharp' | 'cpp' | 'blueprint' | 'lua';
  extendsClass?: string;
  methods: Array<{ name: string; args: string[]; returnType?: string }>;
  properties: Array<{ name: string; type: string; defaultValue?: any }>;
  signals: Array<{ name: string; args: string[] }>;
  linesOfCode: number;
  digest: string;
}

export interface EngineMutationAction {
  type:
    | 'create_scene'
    | 'delete_scene'
    | 'save_scene'
    | 'add_node'
    | 'remove_node'
    | 'rename_node'
    | 'reparent_node'
    | 'set_property'
    | 'connect_signal'
    | 'disconnect_signal'
    | 'create_script'
    | 'update_script'
    | 'attach_script'
    | 'modify_resource'
    | 'update_project_setting'
    | 'custom';
  targetPath: string;
  params: Record<string, any>;
  beforeValue?: any;
  afterValue?: any;
}

export interface EngineMutationProposal {
  id: string;
  engine: EngineType;
  projectId: string;
  title: string;
  description: string;
  risk: MutationRisk;
  actions: EngineMutationAction[];
  inputDigest: string;
  approvalDigest?: string;
  createdAt: string;
  expiresAt: string;
  status: 'proposed' | 'approved' | 'applied' | 'rejected' | 'rolled_back';
}

export type EngineProposalDraft = Omit<
  EngineMutationProposal,
  'id' | 'createdAt' | 'status' | 'inputDigest' | 'expiresAt' | 'approvalDigest'
>;

export interface EngineTransaction {
  id: string;
  proposalId: string;
  timestamp: string;
  actions: EngineMutationAction[];
  snapshots: Array<{ path: string; previousContent: string | null }>;
  rolledBack: boolean;
}

export interface EngineRuntimeOptions {
  scenePath?: string;
  headless?: boolean;
  debug?: boolean;
  args?: string[];
  maxDurationSeconds?: number;
}

export interface EngineAssertion {
  type: 'node_exists' | 'property_equals' | 'screen_text' | 'fps_above' | 'custom';
  target: string;
  property?: string;
  expected: any;
  actual?: any;
  passed?: boolean;
}

export interface EngineAssertionReport {
  scenarioName: string;
  passed: boolean;
  durationMs: number;
  assertions: EngineAssertion[];
  capturedLogs: string[];
  screenshotArtifactId?: string;
  error?: string;
}

export interface EngineProfileSnapshot {
  timestamp: string;
  fps: number;
  frameTimeMs: number;
  drawCalls?: number;
  nodeCount: number;
  memoryMb: number;
  vramMb?: number;
  physicsTickRate?: number;
  regressions?: Array<{ metric: string; delta: number; severity: 'info' | 'warning' | 'critical' }>;
}

export interface EngineExportPreset {
  name: string;
  platform: 'windows' | 'linux' | 'macos' | 'web' | 'android' | 'ios';
  exportPath: string;
  templateVersion: string;
  customOptions?: Record<string, any>;
}

export interface EngineExportResult {
  presetName: string;
  success: boolean;
  outputArtifactPath: string;
  durationMs: number;
  byteSize: number;
  logs: string[];
  error?: string;
}

export type SafeEngineErrorCode =
  | 'ENGINE_NOT_CONNECTED'
  | 'ENGINE_ALREADY_CONNECTED'
  | 'HOSTED_MODE_DENIED'
  | 'OUT_OF_BOUNDS_PATH'
  | 'SCENE_NOT_FOUND'
  | 'NODE_NOT_FOUND'
  | 'SCRIPT_VALIDATION_FAILED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_DIGEST_MISMATCH'
  | 'STALE_PROJECT_MANIFEST'
  | 'TRANSACTION_ROLLBACK_FAILED'
  | 'RUNTIME_EXECUTION_FAILED'
  | 'LICENSE_GATE_BLOCKED'
  | 'UNSUPPORTED_ENGINE_VERSION'
  | 'INTERNAL_ADAPTER_ERROR';

export class GameEngineError extends Error {
  constructor(
    public readonly code: SafeEngineErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(`[${code}] ${message}`);
    this.name = 'GameEngineError';
  }
}
