import fs from 'fs';
import path from 'path';
import { resolveDeploymentMode } from '../config/EnvironmentDefinitions';
import { AppError } from '../../utils/errors';

export const REA_VERSION = '6.8.0';
export const REA_OPERATIONS = ['auto', 'javascript', 'archive', 'pe', 'managed', 'native', 'model'] as const;
export type ReaOperation = typeof REA_OPERATIONS[number];
export interface ReaConfig {
  enabled: boolean; node: string; entry: string; dataRoot: string; allowedRoots: string[];
  timeoutMs: number; maxInputBytes: number; maxFiles: number;
}

export function reaConfig(workspaceRoot = process.cwd()): ReaConfig {
  const runtimeFile = path.join(workspaceRoot, 'services/rea/runtime.json');
  const runtime = fs.existsSync(runtimeFile) ? JSON.parse(fs.readFileSync(runtimeFile, 'utf8')) : {};
  const roots = process.env.REA_ALLOWED_ROOTS ? JSON.parse(process.env.REA_ALLOWED_ROOTS) : [workspaceRoot];
  if (!Array.isArray(roots) || !roots.length || roots.some(root => typeof root !== 'string' || !path.isAbsolute(root))) {
    throw new AppError('REA_ALLOWED_ROOTS must be a JSON array of absolute directories.', 400, 'REA_CONFIGURATION');
  }
  const timeoutMs = Number(process.env.REA_TIMEOUT_MS || 300000);
  const maxInputBytes = Number(process.env.REA_MAX_INPUT_BYTES || 134217728);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 1800000
    || !Number.isInteger(maxInputBytes) || maxInputBytes < 1024 || maxInputBytes > 536870912) {
    throw new ReaError('REA timeout or input budget is outside the supported range.', 400, 'REA_CONFIGURATION');
  }
  return {
    enabled: process.env.REA_ENABLED === 'true' && resolveDeploymentMode() !== 'hosted',
    node: process.env.REA_NODE_PATH || runtime.node || process.execPath,
    entry: path.join(workspaceRoot, 'services/rea/node_modules/rea-agents/scripts/rea.mjs'),
    dataRoot: path.resolve(workspaceRoot, 'data/rea'), allowedRoots: roots.map(root => path.resolve(root)),
    timeoutMs, maxInputBytes, maxFiles: 3000,
  };
}

export class ReaError extends AppError {
  constructor(message: string, status = 400, code = 'REA_ERROR') { super(message, status, code); }
}
