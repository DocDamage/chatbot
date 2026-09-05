/**
 * Capability Pack Manifest Schema & Type Definitions (PX-02 / PX02-T01)
 * Formalizes capability pack contracts, provenance, lifecycle, permissions,
 * tools, agents, connectors, health checks, tests, and rollback definitions.
 */

import { z } from 'zod';

export type IntegrationMode = 'native' | 'external_service' | 'clean_room';
export type PackMaturity = 'disabled' | 'experimental' | 'preview' | 'supported';
export type SupportedProfile = 'HOSTED' | 'LOCAL_TRUSTED';

export interface CapabilitySourceMetadata {
  repository?: string;
  revision?: string;
  license: string;
  integration: IntegrationMode;
  notices: string[];
}

export interface CapabilityDeclaration {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'coding' | 'multimodal' | 'agents' | 'data' | 'integrations' | 'gaming' | 'audio' | 'voice' | 'writing' | 'study' | 'web';
  maturity: PackMaturity;
  processingLocation: 'local' | 'hosted' | 'hybrid' | 'browser' | 'external_provider';
  requiredRole?: 'user' | 'developer' | 'admin';
  requiredPermissions: string[];
  localOnly?: boolean;
}

export interface ToolDeclaration {
  id: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  isDangerous?: boolean;
  requiredConfirmationScope?: string;
}

export interface CommandDeclaration {
  id: string;
  name: string;
  description: string;
  argsSchema?: Record<string, unknown>;
}

export interface SkillDeclaration {
  id: string;
  name: string;
  description: string;
  promptPath?: string;
}

export interface AgentRoleDeclaration {
  id: string;
  name: string;
  role: string;
  description: string;
  systemPrompt?: string;
  allowedTools: string[];
}

export interface ConnectorDeclaration {
  id: string;
  name: string;
  type: 'http' | 'mcp' | 'websocket' | 'cli' | 'stdio';
  endpoint?: string;
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth2';
}

export interface PermissionDeclaration {
  permission: string;
  description: string;
  scope: 'global' | 'project' | 'session';
  requiresApproval: boolean;
}

export interface RequirementDeclaration {
  type: 'binary' | 'model' | 'vram' | 'ram' | 'disk' | 'os' | 'env';
  target: string;
  minVersion?: string;
  minAmountBytes?: number;
  optional?: boolean;
}

export interface HealthCheckDeclaration {
  id: string;
  name: string;
  intervalSeconds?: number;
  timeoutMs?: number;
  checkType: 'ping' | 'binary_version' | 'permission_check' | 'custom';
}

export interface CapabilityTestDeclaration {
  id: string;
  name: string;
  testType: 'contract' | 'unit' | 'integration' | 'canary';
  expectedDurationMs?: number;
}

export interface CapabilityEvaluationDeclaration {
  id: string;
  domain: string;
  minScore: number;
}

export interface RollbackDeclaration {
  canRollback: boolean;
  dataRetentionStrategy: 'retain_audit' | 'purge_all' | 'quarantine';
  remediationSteps: string[];
}

export interface CapabilityPackManifest {
  schemaVersion: string;
  id: string;
  displayName: string;
  version: string;
  description: string;
  source: CapabilitySourceMetadata;
  maturity: PackMaturity;
  profiles: SupportedProfile[];
  capabilities: CapabilityDeclaration[];
  tools?: ToolDeclaration[];
  commands?: CommandDeclaration[];
  skills?: SkillDeclaration[];
  agents?: AgentRoleDeclaration[];
  connectors?: ConnectorDeclaration[];
  permissions: PermissionDeclaration[];
  requirements?: RequirementDeclaration[];
  configurationSchema?: Record<string, unknown>;
  healthChecks?: HealthCheckDeclaration[];
  tests?: CapabilityTestDeclaration[];
  evaluations?: CapabilityEvaluationDeclaration[];
  rollback: RollbackDeclaration;
  metadata?: Record<string, unknown>;
}

// Zod validation schema for runtime validation and forward-compatibility
export const CapabilitySourceMetadataSchema = z.object({
  repository: z.string().optional(),
  revision: z.string().optional(),
  license: z.string().min(1),
  integration: z.enum(['native', 'external_service', 'clean_room']),
  notices: z.array(z.string()).default([]),
});

export const CapabilityDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  category: z.enum([
    'core', 'coding', 'multimodal', 'agents', 'data',
    'integrations', 'gaming', 'audio', 'voice', 'writing', 'study', 'web'
  ]),
  maturity: z.enum(['disabled', 'experimental', 'preview', 'supported']),
  processingLocation: z.enum(['local', 'hosted', 'hybrid', 'browser', 'external_provider']),
  requiredRole: z.enum(['user', 'developer', 'admin']).optional(),
  requiredPermissions: z.array(z.string()).default([]),
  localOnly: z.boolean().optional().default(false),
});

export const ToolDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  parametersSchema: z.record(z.unknown()).default({}),
  isDangerous: z.boolean().optional(),
  requiredConfirmationScope: z.string().optional(),
});

export const CommandDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  argsSchema: z.record(z.unknown()).optional(),
});

export const SkillDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  promptPath: z.string().optional(),
});

export const AgentRoleDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  role: z.string().min(1),
  description: z.string().default(''),
  systemPrompt: z.string().optional(),
  allowedTools: z.array(z.string()).default([]),
});

export const ConnectorDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['http', 'mcp', 'websocket', 'cli', 'stdio']),
  endpoint: z.string().optional(),
  authType: z.enum(['none', 'api_key', 'bearer', 'oauth2']).optional(),
});

export const PermissionDeclarationSchema = z.object({
  permission: z.string().min(1),
  description: z.string().default(''),
  scope: z.enum(['global', 'project', 'session']).default('project'),
  requiresApproval: z.boolean().default(false),
});

export const RequirementDeclarationSchema = z.object({
  type: z.enum(['binary', 'model', 'vram', 'ram', 'disk', 'os', 'env']),
  target: z.string().min(1),
  minVersion: z.string().optional(),
  minAmountBytes: z.number().optional(),
  optional: z.boolean().optional().default(false),
});

export const HealthCheckDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  intervalSeconds: z.number().optional(),
  timeoutMs: z.number().optional(),
  checkType: z.enum(['ping', 'binary_version', 'permission_check', 'custom']),
});

export const CapabilityTestDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  testType: z.enum(['contract', 'unit', 'integration', 'canary']),
  expectedDurationMs: z.number().optional(),
});

export const CapabilityEvaluationDeclarationSchema = z.object({
  id: z.string().min(1),
  domain: z.string().min(1),
  minScore: z.number().min(0).max(1),
});

export const RollbackDeclarationSchema = z.object({
  canRollback: z.boolean().default(true),
  dataRetentionStrategy: z.enum(['retain_audit', 'purge_all', 'quarantine']).default('retain_audit'),
  remediationSteps: z.array(z.string()).default([]),
});

export const CapabilityPackManifestSchema = z.object({
  schemaVersion: z.string().regex(/^1\.\d+\.\d+$/),
  id: z.string().regex(/^[a-z0-9-]+$/),
  displayName: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/),
  description: z.string().default(''),
  source: CapabilitySourceMetadataSchema,
  maturity: z.enum(['disabled', 'experimental', 'preview', 'supported']).default('disabled'),
  profiles: z.array(z.enum(['HOSTED', 'LOCAL_TRUSTED'])).min(1),
  capabilities: z.array(CapabilityDeclarationSchema).min(1),
  tools: z.array(ToolDeclarationSchema).optional().default([]),
  commands: z.array(CommandDeclarationSchema).optional().default([]),
  skills: z.array(SkillDeclarationSchema).optional().default([]),
  agents: z.array(AgentRoleDeclarationSchema).optional().default([]),
  connectors: z.array(ConnectorDeclarationSchema).optional().default([]),
  permissions: z.array(PermissionDeclarationSchema).default([]),
  requirements: z.array(RequirementDeclarationSchema).optional().default([]),
  configurationSchema: z.record(z.unknown()).optional(),
  healthChecks: z.array(HealthCheckDeclarationSchema).optional().default([]),
  tests: z.array(CapabilityTestDeclarationSchema).optional().default([]),
  evaluations: z.array(CapabilityEvaluationDeclarationSchema).optional().default([]),
  rollback: RollbackDeclarationSchema,
  metadata: z.record(z.unknown()).optional(),
}).passthrough(); // Allow unknown fields forward-compatibly

export function validateCapabilityPackManifest(manifest: unknown): { success: true; data: CapabilityPackManifest } | { success: false; errors: string[] } {
  const result = CapabilityPackManifestSchema.safeParse(manifest);
  if (result.success) {
    return { success: true, data: result.data as CapabilityPackManifest };
  }
  return {
    success: false,
    errors: result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
  };
}
