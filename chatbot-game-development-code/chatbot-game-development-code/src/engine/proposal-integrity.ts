import { createHash } from 'node:crypto';
import { canonicalJson, digestJson as domainDigest } from '../common/CanonicalJson';
export { canonicalJson } from '../common/CanonicalJson';

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function sha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

export function digestJson(value: unknown): string {
  return domainDigest('game-contract:v1', value);
}

export function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

export interface ProposalScope {
  schemaVersion: 1;
  runId: string;
  projectId: string;
  /** Server-resolved real path, including volume/case normalization on Windows. */
  canonicalProjectRoot: string;
  requesterId: string;
  tenantId: string;
  environment: string;
  engine: 'godot' | 'unity' | 'unreal' | 'rpg-maker-mz';
  exactEngineVersion: string;
  profileDigest: string;
  adapterVersion: string;
  executablePath: string;
  executableSha256: string;
  actions: readonly { type: string; targetPath: string; params: JsonValue }[];
  /** Null is an explicit assertion that the target must not yet exist. */
  inputFileHashes: Readonly<Record<string, string | null>>;
  expectedOutputs: readonly string[];
  verificationPlanDigest: string;
  expiresAtMs: number;
}

export interface SealedProposal {
  readonly id: string;
  readonly digest: string;
  readonly scope: ProposalScope;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

/** An immutable copy prevents caller mutation after review. This does not grant approval. */
export function sealProposal(id: string, scope: ProposalScope): SealedProposal {
  if (!id.trim() || scope.schemaVersion !== 1 || !scope.actions.length) throw new Error('A nonempty proposal is required.');
  for (const field of [scope.runId, scope.projectId, scope.canonicalProjectRoot, scope.requesterId,
    scope.tenantId, scope.environment, scope.exactEngineVersion, scope.adapterVersion, scope.executablePath]) {
    if (typeof field !== 'string' || !field.trim()) throw new Error('Proposal identity is incomplete.');
  }
  if (![scope.profileDigest, scope.executableSha256, scope.verificationPlanDigest].every(isSha256)) {
    throw new Error('Proposal version and verification hashes are required.');
  }
  if (!Number.isSafeInteger(scope.expiresAtMs) || scope.expiresAtMs <= 0) throw new Error('Invalid proposal expiry.');
  for (const action of scope.actions) {
    if (!action.type || !action.targetPath || !Object.hasOwn(scope.inputFileHashes, action.targetPath)) {
      throw new Error('Each action requires an explicit input file hash or absence assertion.');
    }
  }
  for (const hash of Object.values(scope.inputFileHashes)) {
    if (hash !== null && !isSha256(hash)) throw new Error('Invalid input file hash.');
  }
  if (new Set(scope.expectedOutputs).size !== scope.expectedOutputs.length) throw new Error('Duplicate expected output.');
  const serialized = canonicalJson(scope);
  const snapshot = JSON.parse(serialized) as ProposalScope;
  return deepFreeze({ id, digest: digestJson(snapshot), scope: snapshot });
}

/** Read immediately before apply while holding the project lease. */
export function assertInputsUnchanged(
  proposal: SealedProposal,
  currentHashes: Readonly<Record<string, string | null>>,
): void {
  if (digestJson(proposal.scope) !== proposal.digest) throw new Error('Proposal content changed after sealing.');
  for (const [file, expected] of Object.entries(proposal.scope.inputFileHashes)) {
    if (!Object.hasOwn(currentHashes, file) || currentHashes[file] !== expected) {
      throw new Error(`Input changed or was not checked: ${file}`);
    }
  }
}
