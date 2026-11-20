import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { discoverLocalRuntimes } from './RuntimeDiscovery';
import { discoverEpicUnrealInstallations, discoverUnrealLibraryInstallations } from './EpicUnrealInstallations';
import type { RuntimeCandidate } from '../gaming/project/ProjectEnrollmentTypes';

function unwrap(candidate: string): string | undefined {
  if (!fs.existsSync(candidate)) return undefined;
  if (path.extname(candidate).toLowerCase() !== '.cmd') return candidate;
  const source = fs.readFileSync(candidate, 'utf8');
  // Inspect the existing launcher convention; never execute a shell wrapper.
  const match = source.match(/^@echo off\r?\n"([^"\r\n]+\.exe)" %\*\s*$/i);
  const target = match?.[1].replace(/%([^%]+)%/g, (_value, key: string) => process.env[key] || '');
  return target && fs.existsSync(target) ? target : undefined;
}

export function discoverGameRuntimeCandidates(workspaceRoot: string): RuntimeCandidate[] {
  const legacy = discoverLocalRuntimes(workspaceRoot);
  const candidates: RuntimeCandidate[] = [];
  const add = (engine: RuntimeCandidate['engine'], executable: string | undefined, associations: string[] = []) => {
    if (!executable) return;
    const executablePath = unwrap(executable);
    if (executablePath) candidates.push({ engine, executablePath, associations });
  };
  add('godot', legacy.godot); add('unity', legacy.unity); add('unreal', legacy.unreal);
  for (const installation of [...discoverEpicUnrealInstallations(), ...discoverUnrealLibraryInstallations()]) add('unreal', installation.executablePath, installation.association ? [installation.association] : []);
  for (const name of ['godot', 'godot4']) {
    try {
      const found = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', process.platform === 'win32' ? [name] : ['-a', name],
        { encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
      for (const value of found.trim().split(/\r?\n/).slice(0, 32)) add('godot', value);
    } catch { /* Missing locator entries are not installations. */ }
  }
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const unityRoot = path.join(programFiles, 'Unity', 'Hub', 'Editor');
  if (fs.existsSync(unityRoot)) for (const entry of fs.readdirSync(unityRoot, { withFileTypes: true })) {
    if (entry.isDirectory()) add('unity', path.join(unityRoot, entry.name, 'Editor', 'Unity.exe'));
  }
  for (const root of [path.join(programFiles, 'Epic Games'), 'D:\\Unreal']) {
    if (fs.existsSync(root)) for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && /^UE_/.test(entry.name)) add('unreal', path.join(root, entry.name, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe'), [entry.name.slice(3)]);
    }
  }
  if (process.platform === 'win32') {
    try {
      const output = execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe'),
        ['query', 'HKCU\\Software\\Epic Games\\Unreal Engine\\Builds'],
        { encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of output.split(/\r?\n/)) {
        const match = line.match(/^\s*(\{?[0-9a-f-]{36}\}?)\s+REG_SZ\s+(.+?)\s*$/i);
        if (match) add('unreal', path.join(match[2], 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe'), [match[1]]);
      }
    } catch { /* An unregistered association remains unresolved; never infer a GUID's version. */ }
  }
  return candidates;
}
