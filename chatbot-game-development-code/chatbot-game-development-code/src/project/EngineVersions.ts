import { canonicalJson, digestJson } from '../common/CanonicalJson';
import { isWellFormedUnicode } from '../common/Unicode';

export type EngineKind = 'godot' | 'unity' | 'unreal' | 'rpg-maker-mz';

export interface VersionEvidence {
  engine: EngineKind;
  exactVersion: string;
  origin: 'executable' | 'project-file' | 'build-file';
  /** Path/hash or process evidence identifier supplied by the authenticated host. */
  evidenceId: string;
}

function bounded(value: string): string {
  if (typeof value !== 'string' || value.length > 1_048_576 || value.includes('\0')
      || !isWellFormedUnicode(value)) throw new Error('INVALID_VERSION_INPUT');
  return value.replace(/^\uFEFF/, '');
}

/** Parse stdout captured from an explicitly selected Godot executable --version. */
export function parseGodotExecutableVersion(stdout: string): string {
  const value = bounded(stdout).trim();
  if (value.length > 256 || !/^\d+\.\d+(?:\.\d+)?\.(?:stable|dev\d*|alpha\d*|beta\d*|rc\d*)(?:\.[A-Za-z0-9_-]+)*$/.test(value)) {
    throw new Error('UNRECOGNIZED_GODOT_VERSION');
  }
  return value;
}

/** Unity release suffixes are meaningful; do not coerce them to generic semver. */
export function parseUnityProjectVersion(projectVersionText: string): string {
  const source = bounded(projectVersionText);
  let version: string | undefined;
  // Horizontal whitespace only: a blank value must never consume the next line.
  // Splitting the bounded input avoids multiline \s* rescanning long blank files.
  for (const line of source.split(/\r\n|\n|\r/)) {
    if (!/^[ \t]*m_EditorVersion[ \t]*:/.test(line)) continue;
    const match = /^[ \t]*m_EditorVersion[ \t]*:[ \t]*(\S{1,64})[ \t]*$/.exec(line);
    const value = match?.[1];
    if (version !== undefined || value === undefined || !/^\d+\.\d+\.\d+[abfp]\d+$/.test(value)) {
      throw new Error('UNRECOGNIZED_UNITY_VERSION');
    }
    version = value;
  }
  if (version === undefined) throw new Error('UNRECOGNIZED_UNITY_VERSION');
  return version;
}

/** An Unreal EngineAssociation can be a registry GUID; it is not an engine version. */
export function parseUnrealAssociation(projectText: string): string {
  const document: unknown = JSON.parse(bounded(projectText));
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('INVALID_UNREAL_PROJECT');
  const association = (document as Record<string, unknown>).EngineAssociation;
  if (typeof association !== 'string' || !association.trim() || association.length > 256) throw new Error('UNRESOLVED_UNREAL_ASSOCIATION');
  return association;
}

function unrealBuildDocument(buildText: string): Record<string, unknown> {
  const document: unknown = JSON.parse(bounded(buildText));
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('INVALID_UNREAL_BUILD');
  return document as Record<string, unknown>;
}

function unrealReleaseVersion(document: Record<string, unknown>): string {
  const fields = ['MajorVersion', 'MinorVersion', 'PatchVersion'] as const;
  const numbers = fields.map(field => document[field]);
  if (numbers.some(value => !Number.isSafeInteger(value) || (value as number) < 0)) throw new Error('INVALID_UNREAL_BUILD');
  return numbers.join('.');
}

/** Release/display version only; use parseUnrealBuildIdentity for exact build binding. */
export function parseUnrealBuildVersion(buildText: string): string {
  return unrealReleaseVersion(unrealBuildDocument(buildText));
}

export interface UnrealBuildIdentity {
  readonly releaseVersion: string;
  readonly buildIdentityDigest: string;
  /** All parsed fields, including optional/extension fields, in canonical JSON. */
  readonly canonicalBuildMetadata: string;
}

/**
 * Parses a full Build.version record. Its digest includes every metadata field;
 * whitespace/key order do not matter. The host must bind this record to a probed
 * installation and executable hash: metadata alone does not attest an executable.
 */
export function parseUnrealBuildIdentity(buildText: string): UnrealBuildIdentity {
  const document = unrealBuildDocument(buildText);
  const releaseVersion = unrealReleaseVersion(document);
  for (const field of ['Changelist', 'CompatibleChangelist']) {
    const value = document[field];
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('INCOMPLETE_UNREAL_BUILD_IDENTITY');
  }
  for (const field of ['IsLicenseeVersion', 'IsPromotedBuild']) {
    if (document[field] !== 0 && document[field] !== 1) throw new Error('INCOMPLETE_UNREAL_BUILD_IDENTITY');
  }
  const branch = document.BranchName;
  if (typeof branch !== 'string' || branch.length > 2048 || !isWellFormedUnicode(branch)
      || /[\x00-\x1f\x7f]/.test(branch)) throw new Error('INCOMPLETE_UNREAL_BUILD_IDENTITY');
  for (const field of ['BuildId', 'BuildVersion']) {
    const value = document[field];
    if (value !== undefined && (typeof value !== 'string' || value.length > 2048
        || !isWellFormedUnicode(value) || /[\x00-\x1f\x7f]/.test(value))) {
      throw new Error('INVALID_UNREAL_BUILD_IDENTITY');
    }
  }
  const canonicalBuildMetadata = canonicalJson(document);
  return Object.freeze({
    releaseVersion,
    buildIdentityDigest: digestJson('unreal-build-identity:v1', document),
    canonicalBuildMetadata,
  });
}

export interface InstalledRuntime {
  runtimeId: string;
  engine: EngineKind;
  exactVersion: string;
  executableSha256: string;
  evidenceId: string;
  /** For Unreal, from parseUnrealBuildIdentity and bound to this installation by the host. */
  buildIdentityDigest?: string;
}

/**
 * Compatibility decisions belong in an explicit policy. Unreal's release label
 * requires either a matching full-build digest or an explicitly selected verified
 * runtime ID. If both are provided, both must match.
 */
export function selectExactRuntime(
  engine: EngineKind,
  exactVersion: string,
  runtimes: readonly InstalledRuntime[],
  selectedId?: string,
  expectedBuildDigest?: string,
): InstalledRuntime {
  if (typeof exactVersion !== 'string' || !exactVersion.trim() || exactVersion !== exactVersion.trim()
      || exactVersion.length > 256 || !isWellFormedUnicode(exactVersion)
      || /[\x00-\x1f\x7f]/.test(exactVersion) || /^(unknown|latest|stable)$/i.test(exactVersion)) {
    throw new Error('UNRESOLVED_TARGET_VERSION');
  }
  if (selectedId !== undefined && (typeof selectedId !== 'string' || !selectedId.trim()
      || selectedId !== selectedId.trim() || selectedId.length > 256 || !isWellFormedUnicode(selectedId)
      || /[\x00-\x1f\x7f]/.test(selectedId))) throw new Error('INVALID_RUNTIME_SELECTION');
  if (expectedBuildDigest !== undefined && (engine !== 'unreal' || !/^[0-9a-f]{64}$/.test(expectedBuildDigest))) {
    throw new Error('INVALID_EXPECTED_BUILD_IDENTITY');
  }
  if (engine === 'unreal' && selectedId === undefined && expectedBuildDigest === undefined) {
    throw new Error('UNREAL_BUILD_BINDING_REQUIRED');
  }
  let candidates = runtimes.filter(runtime => runtime.engine === engine && runtime.exactVersion === exactVersion
    && (selectedId === undefined || runtime.runtimeId === selectedId));
  if (candidates.length === 0) throw new Error('RUNTIME_VERSION_NOT_INSTALLED');
  if (expectedBuildDigest !== undefined) {
    candidates = candidates.filter(runtime => runtime.buildIdentityDigest === expectedBuildDigest);
    if (candidates.length === 0) throw new Error('UNREAL_BUILD_IDENTITY_MISMATCH');
  }
  if (candidates.length !== 1) throw new Error('AMBIGUOUS_RUNTIME_SELECTION');
  const candidate = candidates[0]!;
  if (!candidate.runtimeId || candidate.runtimeId !== candidate.runtimeId.trim() || !candidate.evidenceId
      || candidate.evidenceId !== candidate.evidenceId.trim() || !/^[0-9a-f]{64}$/i.test(candidate.executableSha256)
      || (candidate.buildIdentityDigest !== undefined && !/^[0-9a-f]{64}$/.test(candidate.buildIdentityDigest))) {
    throw new Error('UNVERIFIED_RUNTIME');
  }
  return { ...candidate };
}
