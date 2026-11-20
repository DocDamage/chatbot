import fs from 'node:fs';
import path from 'node:path';
import { parseUnrealBuildIdentity } from '../gaming/project/EngineVersions';
import { execFileSync } from 'node:child_process';

export interface EpicUnrealInstallation { executablePath: string; association: string }

let readyDrives: { expires: number; roots: string[] } | undefined;
function fixedDriveRoots(): string[] {
  if (process.platform !== 'win32') return [];
  if (readyDrives && readyDrives.expires > Date.now()) return readyDrives.roots;
  try {
    const output = execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-Command', '[IO.DriveInfo]::GetDrives() | Where-Object { $_.DriveType -eq [IO.DriveType]::Fixed -and $_.IsReady } | ForEach-Object { $_.RootDirectory.FullName }'],
      { encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
    const roots = output.split(/\r?\n/).map(value => value.trim()).filter(value => /^[a-z]:\\$/i.test(value));
    readyDrives = { roots, expires: Date.now() + 60_000 };
    return roots;
  } catch { return []; }
}

/** Inspect only known library roots/immediate UE_* children; never recurse through projects or asset vaults. */
export function discoverUnrealLibraryInstallations(roots?: readonly string[]): EpicUnrealInstallation[] {
  const libraries = roots ?? [process.env.ProgramFiles || 'C:\\Program Files',
    ...fixedDriveRoots().flatMap(drive => [path.join(drive, 'Epic Games'), path.join(drive, 'Unreal'), path.join(drive, 'Games', 'Epic Games'), path.join(drive, 'Program Files', 'Epic Games')])];
  const found = new Map<string, EpicUnrealInstallation>();
  const inspect = (location: string) => {
    const executablePath = path.join(location, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    if (!fs.existsSync(executablePath)) return;
    const rank = unrealBuildRank(executablePath);
    const association = rank[0] > 0 ? `${rank[0]}.${rank[1]}` : '';
    const key = process.platform === 'win32' ? executablePath.toLowerCase() : executablePath;
    found.set(key, { executablePath, association });
  };
  for (const library of new Set(libraries)) {
    try {
      if (!fs.statSync(library).isDirectory()) continue;
      inspect(library);
      for (const entry of fs.readdirSync(library, { withFileTypes: true })) if (entry.isDirectory() && /^UE_/i.test(entry.name)) inspect(path.join(library, entry.name));
    } catch { /* Unavailable libraries are not silently replaced with fabricated installations. */ }
  }
  return [...found.values()];
}

/** Launcher registration supplies locations only. Exact identity still comes from the installed files. */
export function discoverEpicUnrealInstallations(manifestPath = path.join(process.env.ProgramData || 'C:\\ProgramData',
  'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat')): EpicUnrealInstallation[] {
  try {
    if (!fs.statSync(manifestPath).isFile() || fs.statSync(manifestPath).size > 1_048_576) return [];
    const bytes = fs.readFileSync(manifestPath);
    if (bytes.length > 1_048_576 || bytes.includes(0) || !Buffer.from(bytes.toString('utf8')).equals(bytes)) return [];
    const manifest: unknown = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
    const entries = (manifest as { InstallationList?: unknown })?.InstallationList;
    if (!Array.isArray(entries) || entries.length > 1000) return [];
    const found = new Map<string, EpicUnrealInstallation>();
    for (const entry of entries) {
      if (!entry || typeof entry.AppName !== 'string' || !/^UE_\d+\.\d+(?:\.\d+)?$/.test(entry.AppName) ||
        typeof entry.InstallLocation !== 'string' || !path.isAbsolute(entry.InstallLocation) || entry.InstallLocation.includes('\0')) continue;
      const executablePath = path.join(entry.InstallLocation, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
      const key = process.platform === 'win32' ? executablePath.toLowerCase() : executablePath;
      found.set(key, { executablePath, association: entry.AppName.slice(3) });
    }
    return [...found.values()];
  } catch { return []; }
}

/** Rank an installed default using its build record, without treating folder/Launcher labels as version evidence. */
export function unrealBuildRank(executable: string): number[] {
  try {
    const file = path.resolve(path.dirname(executable), '..', '..', 'Build', 'Build.version');
    if (fs.statSync(file).size > 1_048_576) return [0, 0, 0, 0];
    const identity = parseUnrealBuildIdentity(fs.readFileSync(file, 'utf8'));
    return [...identity.releaseVersion.split('.').map(Number), JSON.parse(identity.canonicalBuildMetadata).Changelist];
  } catch { return [0, 0, 0, 0]; }
}
