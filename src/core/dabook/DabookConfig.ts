/**
 * Environment-driven configuration for the DABOOK structured-PDF integration.
 *
 * DABOOK is off by default (`DABOOK_ENABLED=false`): the Chatbot keeps using `pdf-parse` until an
 * operator turns it on. Even when enabled, every failure falls back to `pdf-parse`.
 */

import path from 'node:path';

export const DABOOK_PROFILES = ['fast', 'balanced', 'accurate', 'lowram'] as const;
export type DabookProfile = (typeof DABOOK_PROFILES)[number];

export interface DabookConfig {
  enabled: boolean;
  /** Absolute path of the DABOOK workspace (content-addressed cache + datasets). */
  workspace: string;
  profile: DabookProfile;
  /** Hard wall-clock budget for one `dabook ingest` call. */
  timeoutMs: number;
  /** Whether the optional DABOOK dashboard (port 8765) is expected to be used by the operator. */
  dashboard: boolean;
  /** Interpreters to try, in order. The first one that can `import dabook` wins. */
  interpreterCandidates: Array<{ source: 'DABOOK_PYTHON' | 'CHATBOT_NATIVE_PYTHON' | 'managed-venv'; path: string }>;
  warnings: string[];
}

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_TIMEOUT_MS = 5_000;

function truthy(value: string | undefined): boolean {
  return value !== undefined && ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** `services/dabook/.venv` interpreter created by `npm run setup:dabook`. */
export function managedVenvPython(cwd: string = process.cwd(), platform: NodeJS.Platform = process.platform): string {
  const venv = path.join(cwd, 'services', 'dabook', '.venv');
  return platform === 'win32' ? path.join(venv, 'Scripts', 'python.exe') : path.join(venv, 'bin', 'python');
}

export function isDabookEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return truthy(env.DABOOK_ENABLED);
}

export function resolveDabookConfig(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  platform: NodeJS.Platform = process.platform
): DabookConfig {
  const warnings: string[] = [];

  const requestedProfile = (env.DABOOK_PROFILE || 'balanced').trim().toLowerCase();
  let profile: DabookProfile = 'balanced';
  if ((DABOOK_PROFILES as readonly string[]).includes(requestedProfile)) {
    profile = requestedProfile as DabookProfile;
  } else {
    warnings.push(`DABOOK_PROFILE=${env.DABOOK_PROFILE} is not one of ${DABOOK_PROFILES.join('|')}; using balanced`);
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (env.DABOOK_TIMEOUT_MS !== undefined && env.DABOOK_TIMEOUT_MS !== '') {
    const parsed = Number(env.DABOOK_TIMEOUT_MS);
    if (Number.isFinite(parsed) && parsed >= MIN_TIMEOUT_MS) {
      timeoutMs = Math.floor(parsed);
    } else {
      warnings.push(`DABOOK_TIMEOUT_MS=${env.DABOOK_TIMEOUT_MS} must be a number >= ${MIN_TIMEOUT_MS}; using ${DEFAULT_TIMEOUT_MS}`);
    }
  }

  const candidates: DabookConfig['interpreterCandidates'] = [];
  if (env.DABOOK_PYTHON?.trim()) candidates.push({ source: 'DABOOK_PYTHON', path: env.DABOOK_PYTHON.trim() });
  if (env.CHATBOT_NATIVE_PYTHON?.trim()) candidates.push({ source: 'CHATBOT_NATIVE_PYTHON', path: env.CHATBOT_NATIVE_PYTHON.trim() });
  candidates.push({ source: 'managed-venv', path: managedVenvPython(cwd, platform) });

  return {
    enabled: isDabookEnabled(env),
    workspace: path.resolve(cwd, env.DABOOK_WORKSPACE?.trim() || path.join('data', 'dabook_workspace')),
    profile,
    timeoutMs,
    dashboard: truthy(env.DABOOK_DASHBOARD),
    interpreterCandidates: candidates,
    warnings
  };
}
