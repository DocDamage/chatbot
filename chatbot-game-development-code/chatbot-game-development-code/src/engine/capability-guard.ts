import { digestJson, isSha256, type ProposalScope, type SealedProposal } from './proposal-integrity.js';

export type EngineId = ProposalScope['engine'];
export type TargetKind = 'source' | 'project_config' | 'godot_scene' | 'godot_resource'
  | 'unity_asset' | 'unreal_asset' | 'mz_database' | 'mz_events' | 'mz_plugin' | 'mz_plugin_registry';
export type HandlerId = 'text_transaction' | 'structured_config' | 'godot_scene'
  | 'unity_editor' | 'unreal_editor' | 'mz_json_schema' | 'mz_event_schema' | 'mz_plugin_js' | 'mz_plugin_registry';

export interface ActionCapability {
  action: string;
  targetKind: TargetKind;
  handler: HandlerId;
  /** Set by a certified adapter registry, never by model output or the request body. */
  enabled: boolean;
}

export interface EngineCapabilityProfile {
  engine: EngineId;
  exactEngineVersion: string;
  profileDigest: string;
  adapterVersion: string;
  executablePath: string;
  executableSha256: string;
  capabilities: readonly ActionCapability[];
}

export interface GuardContext {
  deploymentMode: 'local-trusted' | 'local-restricted' | 'hosted';
  workMode: 'chat' | 'plan' | 'implement' | 'debug';
  principal: { userId: string; tenantId: string };
  projectId: string;
  canonicalProjectRoot: string;
  environment: string;
  nowMs: number;
  profile: EngineCapabilityProfile;
  /** An existing CodingAuthorization decision from the authenticated server. */
  authorization: { approved: boolean; action: 'create_patch' | 'apply_patch' | 'repair' };
  isRepair: boolean;
}

export interface ApprovalRecord {
  id: string;
  proposalId: string;
  proposalDigest: string;
  /** The existing bridge's approval digest is retained, not reconstructed here. */
  bridgeApprovalDigest: string;
  actorId: string;
  tenantId: string;
  projectId: string;
  expiresAtMs: number;
  revoked: boolean;
}

export interface ApprovalReader {
  /** Must read the authenticated, durable server store, not echo user-provided fields. */
  read(approvalId: string): Promise<ApprovalRecord | undefined>;
}

export class CapabilityDenied extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(reasons.join(' '));
    this.name = 'CapabilityDenied';
  }
}

export function classifyTarget(engine: EngineId, file: string): TargetKind | undefined {
  // Canonical real-path confinement is separately required through ProjectPathGuard.
  // This check also rejects drive names, ADS, UNC paths and mixed path separators.
  if (!file || file.includes('\\') || file.includes(':') || file.startsWith('/') || /[\u0000-\u001f]/.test(file)
      || file.split('/').some(part => !part || part === '.' || part === '..')) return undefined;
  if (engine === 'godot') {
    if (file === 'project.godot' || file === 'export_presets.cfg') return 'project_config';
    if (/\.gd$/.test(file)) return 'source';
    if (/\.tscn$/.test(file)) return 'godot_scene';
    if (/\.tres$/.test(file)) return 'godot_resource';
  }
  if (engine === 'unity') {
    if (/^Assets\/.+\.cs$/.test(file)) return 'source';
    if (/^(ProjectSettings\/[^/]+\.asset|Packages\/(manifest|packages-lock)\.json)$/.test(file)) return 'project_config';
    if (/^Assets\/.+\.(unity|prefab|asset|mat)$/.test(file)) return 'unity_asset';
  }
  if (engine === 'unreal') {
    if (/^(Source|Plugins)\/.+\.(cpp|h|hpp|cs)$/.test(file)) return 'source';
    if (/^(Config\/.+\.ini|[^/]+\.uproject)$/.test(file)) return 'project_config';
    if (/^(Content|Plugins)\/.+\.(umap|uasset)$/.test(file)) return 'unreal_asset';
  }
  if (engine === 'rpg-maker-mz') {
    if (/^js\/plugins\/[^/]+\.js$/.test(file)) return 'mz_plugin';
    if (file === 'js/plugins.js') return 'mz_plugin_registry';
    if (/^data\/(Map\d{3,}|CommonEvents|Troops)\.json$/.test(file)) return 'mz_events';
    if (/^data\/(Actors|Classes|Skills|Items|Weapons|Armors|Enemies|States|Animations|Tilesets|System|MapInfos)\.json$/.test(file)) return 'mz_database';
  }
  return undefined;
}

function requiredHandler(action: string, target: TargetKind): HandlerId | undefined {
  if (action === 'custom') return undefined;
  if (action === 'create_script' || action === 'update_script') {
    return target === 'source' ? 'text_transaction' : target === 'mz_plugin' ? 'mz_plugin_js' : undefined;
  }
  if (action === 'update_project_setting') return target === 'project_config' ? 'structured_config' : undefined;
  if (action === 'edit_mz_database') return target === 'mz_database' ? 'mz_json_schema' : undefined;
  if (action === 'edit_mz_events') return target === 'mz_events' ? 'mz_event_schema' : undefined;
  if (action === 'edit_mz_plugins') return target === 'mz_plugin_registry' ? 'mz_plugin_registry' : undefined;
  const sceneActions = new Set(['create_scene', 'save_scene', 'delete_scene', 'add_node', 'remove_node',
    'rename_node', 'reparent_node', 'set_property', 'connect_signal', 'disconnect_signal', 'attach_script']);
  if (sceneActions.has(action) || action === 'modify_resource') {
    if (target === 'godot_scene' || (target === 'godot_resource' && action === 'modify_resource')) return 'godot_scene';
    if (target === 'unity_asset') return 'unity_editor';
    if (target === 'unreal_asset') return 'unreal_editor';
  }
  return undefined;
}

/** Pure preflight. A passing result is not approval and does not perform writes. */
export function capabilityIssues(proposal: SealedProposal, context: GuardContext): string[] {
  const issues: string[] = [];
  const { scope } = proposal;
  const profile = context.profile;
  if (context.deploymentMode !== 'local-trusted') issues.push('Native mutations require the local-trusted deployment profile.');
  if (!Number.isSafeInteger(context.nowMs) || context.nowMs < 0) issues.push('Invalid server time.');
  if (!context.principal.userId || !context.principal.tenantId) issues.push('Authenticated identity is required.');
  if (context.workMode !== 'implement' && !(context.workMode === 'debug' && context.isRepair)) {
    issues.push('The current coding mode does not authorize this mutation.');
  }
  if (!context.authorization.approved) issues.push('The existing CodingAuthorization policy denied this action.');
  if (context.isRepair && context.authorization.action !== 'repair') issues.push('A repair authorization is required.');
  if (!context.isRepair && context.authorization.action === 'repair') issues.push('A repair grant cannot authorize an unrelated mutation.');
  if (scope.requesterId !== context.principal.userId || scope.tenantId !== context.principal.tenantId
      || scope.projectId !== context.projectId || scope.canonicalProjectRoot !== context.canonicalProjectRoot
      || scope.environment !== context.environment) issues.push('Proposal authority or project scope changed.');
  if (scope.expiresAtMs <= context.nowMs) issues.push('Proposal expired.');
  for (const key of ['engine', 'exactEngineVersion', 'profileDigest', 'adapterVersion', 'executablePath', 'executableSha256'] as const) {
    if (scope[key] !== profile[key]) issues.push(`Installed profile changed: ${key}.`);
  }
  if (!isSha256(profile.profileDigest) || !isSha256(profile.executableSha256)) issues.push('The installed profile is unverified.');
  try {
    if (digestJson(scope) !== proposal.digest) issues.push('Proposal bytes changed after review.');
  } catch {
    issues.push('Proposal is not canonical JSON.');
  }
  if (scope.actions.length === 0) issues.push('A proposal must contain an action.');
  for (const action of scope.actions) {
    const target = classifyTarget(scope.engine, action.targetPath);
    const handler = target === undefined ? undefined : requiredHandler(action.type, target);
    if (!target || !handler) {
      issues.push(`Unsupported action or target: ${action.type} ${action.targetPath}.`);
      continue;
    }
    const entries = profile.capabilities.filter(entry => entry.action === action.type && entry.targetKind === target);
    if (entries.length !== 1 || !entries[0].enabled || entries[0].handler !== handler) {
      issues.push(`No unique certified ${handler} handler for ${action.type} ${action.targetPath}.`);
    }
    if ((action.type === 'create_script' || action.type === 'update_script')
        && (action.params === null || Array.isArray(action.params) || typeof action.params !== 'object'
          || typeof action.params.content !== 'string' || action.params.content.length === 0)) {
      issues.push(`Script content is missing: ${action.targetPath}.`);
    }
    if (action.params !== null && !Array.isArray(action.params) && typeof action.params === 'object'
        && Object.hasOwn(action.params, 'skipValidation')) issues.push('Generated actions cannot bypass validation.');
  }
  return issues;
}

export async function authorizeApply(
  proposal: SealedProposal,
  context: GuardContext,
  approvalId: string,
  approvals: ApprovalReader,
  now: () => number = Date.now,
): Promise<ApprovalRecord> {
  const issues = capabilityIssues(proposal, context);
  if (context.authorization.action !== (context.isRepair ? 'repair' : 'apply_patch')) {
    issues.push('Apply requires an existing apply or repair authorization decision.');
  }
  if (issues.length) throw new CapabilityDenied(issues);
  const record = approvalId ? await approvals.read(approvalId) : undefined;
  // An asynchronous store lookup can outlast an otherwise valid approval.
  const checkedAtMs = now();
  if (!Number.isSafeInteger(checkedAtMs) || checkedAtMs < context.nowMs || checkedAtMs >= proposal.scope.expiresAtMs) {
    throw new CapabilityDenied(['The proposal expired or the server clock moved backwards during authorization.']);
  }
  if (!record || record.id !== approvalId || record.revoked || !Number.isSafeInteger(record.expiresAtMs)
      || record.expiresAtMs <= checkedAtMs || record.expiresAtMs > proposal.scope.expiresAtMs
      || record.proposalId !== proposal.id || record.proposalDigest !== proposal.digest
      || record.actorId !== context.principal.userId || record.tenantId !== context.principal.tenantId
      || record.projectId !== context.projectId || !isSha256(record.bridgeApprovalDigest)) {
    throw new CapabilityDenied(['No current exact-scope approval exists for this actor and proposal.']);
  }
  return { ...record };
}
