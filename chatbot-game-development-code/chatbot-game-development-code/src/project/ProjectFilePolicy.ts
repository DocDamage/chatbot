import { isWellFormedUnicode } from '../common/Unicode';

export type ProjectKind = 'godot' | 'unity' | 'unreal' | 'rpg-maker-mz' | 'rom';
export type FileRole = 'editable-text' | 'structured-data' | 'engine-native' | 'binary-tool' | 'read-only' | 'excluded';
export interface FileDecision { path: string; role: FileRole; reason: string; }

/** Lexical validation only. The host must additionally enforce realpath and write gates. */
export function projectRelativePath(input: string): string {
  if (typeof input !== 'string' || !input || input.length > 2048 || !isWellFormedUnicode(input)
      || /[\x00-\x1f\x7f]/.test(input)) throw new Error('INVALID_PROJECT_PATH');
  const normalized = input.replace(/\\/g, '/');
  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) throw new Error('ABSOLUTE_PROJECT_PATH');
  const parts = normalized.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || /[. ]$/.test(part) || /[:<>"|?*]/.test(part)
      || /^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i.test(part))) {
    throw new Error('AMBIGUOUS_PROJECT_PATH');
  }
  return normalized;
}

// Mirrors the application's credential-store policy, plus Azure and tool-owned
// roots. A host's realpath, owner, and write-policy checks remain authoritative.
const sensitiveDirectories = new Set([
  '.git', 'node_modules', 'api keys', 'credentials', 'private', 'secrets', '.secrets',
  '.aws', '.azure', '.ssh', '.codex', '.claude', '.cursor', '.config', '.docker', '.kube',
]);
const sensitiveFileNames = new Set(['.npmrc', '.netrc', '.git-credentials', 'id_rsa', 'id_ed25519']);
const unrealGeneratedDirectories = new Set(['intermediate', 'deriveddatacache', 'saved', 'binaries']);
const unrealAuthoredDirectories = new Set(['source', 'content', 'config', 'resources', 'shaders']);

function unrealPrivateSourceDirectory(parts: readonly string[], index: number): boolean {
  // Private is a normal Unreal module source directory, not a credential store.
  return (parts[0] === 'source' && index === 2)
    || (parts[0] === 'plugins' && index >= 4 && parts[index - 2] === 'source');
}

function unrealGeneratedPath(parts: readonly string[]): boolean {
  if (unrealGeneratedDirectories.has(parts[0] ?? '')) return true;
  if (parts[0] !== 'plugins') return false;
  // Plugins may be grouped into category directories. Once an authored tree
  // begins, a nested folder named Saved/Intermediate is ordinary source data.
  for (let index = 2; index < parts.length - 1; index++) {
    const part = parts[index]!;
    if (unrealAuthoredDirectories.has(part)) return false;
    if (unrealGeneratedDirectories.has(part)) return true;
  }
  return false;
}

export function classifyProjectFile(kind: ProjectKind, input: string): FileDecision {
  const file = projectRelativePath(input), lower = file.toLowerCase();
  const parts = lower.split('/'), name = parts[parts.length - 1];
  const result = (role: FileRole, reason: string): FileDecision => ({ path: file, role, reason });
  if (parts.some((part, index) => sensitiveDirectories.has(part)
        && !(part === 'private' && kind === 'unreal' && unrealPrivateSourceDirectory(parts, index))) ||
      parts.some(part => /^\.env(?:\.|$)/.test(part)) || sensitiveFileNames.has(name ?? '')
      || /^(?:credentials?|secrets?|tokens?|auth|api[_-]?keys?)(?:\.|$)/.test(name ?? '') || /\.(?:pem|key|pfx|p12)$/.test(name ?? '')) {
    return result('excluded', 'Sensitive or tool-owned path');
  }
  if (kind === 'godot') {
    if (parts[0] === '.godot') return result('excluded', 'Godot generated cache');
    if (/\.(?:gd|tscn|tres|gdshader|gdshaderinc|cs)$/.test(lower) || lower === 'project.godot') return result('editable-text', 'Godot source or text resource');
    if (/\.(?:uid|import|csproj|sln)$/.test(lower) || lower === 'export_presets.cfg') return result('read-only', 'Identity, build, or export metadata requires a dedicated operation');
    if (/\.(?:scn|res)$/.test(lower)) return result('engine-native', 'Binary Godot resource');
  } else if (kind === 'unity') {
    if (/^(?:library|temp|obj|logs)$/.test(parts[0] ?? '')) return result('excluded', 'Unity generated content');
    if (/^assets\/.+\.(?:cs|shader|hlsl|cginc|compute)$/.test(lower)) return result('editable-text', 'Unity source');
    if (/^assets\/.+\.(?:unity|prefab|asset|controller|anim)$/.test(lower)) return result('engine-native', 'Edit through Unity serialization and editor APIs');
    if (/\.meta$/.test(lower) || /^(?:packages|projectsettings)\//.test(lower) || /\.asmdef$/.test(lower)) return result('read-only', 'Dependency or GUID metadata');
  } else if (kind === 'unreal') {
    if (unrealGeneratedPath(parts)) return result('excluded', 'Unreal generated content');
    if (/\.(?:uasset|umap)$/.test(lower)) return result('engine-native', 'Unreal serialized asset; never UTF-8 edit');
    if (/^(?:source|plugins)\/.+\.(?:c|cpp|h|hpp|cs|usf|ush)$/.test(lower)) return result('editable-text', 'Unreal source or build rules');
    if (/\.(?:uproject|uplugin)$/.test(lower) || /^config\/.+\.ini$/.test(lower)) return result('read-only', 'Project/plugin/config changes require a dedicated operation');
  } else if (kind === 'rpg-maker-mz') {
    if (/^js\/plugins\/.+\.js$/.test(lower)) return result('editable-text', 'Project plugin implementation');
    if (/^data\/[a-z0-9_-]+\.json$/.test(lower)) return result('structured-data', 'MZ schema and cross-reference validation required');
    if (lower === 'js/plugins.js') return result('structured-data', 'Parse assignment statically; preserve plugin order and parameters');
    if (/^js\/rmmz_[a-z]+\.js$/.test(lower) || /\.rmmzproject$/.test(lower)) return result('read-only', 'Engine runtime or project identity');
    if (/^save\//.test(lower)) return result('excluded', 'Player saves are outside project editing');
  } else if (kind === 'rom') {
    if (/\.(?:asm|s|inc|c|cpp|h|hpp|cfg|ld|tbl|json|toml|yaml|yml)$/.test(lower)) return result('editable-text', 'ROM project source; including legitimate data directories');
    if (/\.(?:smc|sfc|nes|gb|gbc|gba|nds|z64|n64|v64|bin|iso|cue|chd|bps|ips|ups|xdelta)$/.test(lower)) return result('binary-tool', 'Identity-checked format-specific operation required');
    if (/\.(?:sym|map|lst)$/.test(lower) || /^(?:makefile|gnumakefile)$/.test(name)) return result('read-only', 'Symbols or toolchain instructions');
  }
  if (/\.(?:md|rst|txt)$/.test(lower)) return result('read-only', 'Project documentation');
  if (/\.(?:png|jpg|jpeg|webp|ogg|wav|mp3|glb|gltf|fbx|obj)$/.test(lower)) return result('read-only', 'Asset catalog input; inspect through the asset pipeline');
  return result('excluded', 'Unsupported path or format; explicitly register support before use');
}
