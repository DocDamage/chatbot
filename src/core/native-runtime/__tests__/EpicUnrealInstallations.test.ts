import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverEpicUnrealInstallations, discoverUnrealLibraryInstallations, unrealBuildRank } from '../EpicUnrealInstallations';

describe('Epic Launcher Unreal installation discovery', () => {
  let root: string, manifest: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'epic-unreal-discovery-')); manifest = path.join(root, 'LauncherInstalled.dat'); });
  afterEach(() => {
    expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  it('discovers arbitrary registered locations, keeps distinct engines and excludes marketplace plugins', () => {
    const first = path.join(root, 'custom-library/UE_5.8.3'), second = path.join(root, 'another-library/UE_5.8.4');
    fs.writeFileSync(manifest, JSON.stringify({ InstallationList: [
      { AppName: 'UE_5.8', InstallLocation: first, AppVersion: 'not-trusted-as-runtime-proof' },
      { AppName: 'UE_5.8', InstallLocation: second },
      { AppName: 'UE_5.8', InstallLocation: first },
      { AppName: 'QuixelBridge_5.8', InstallLocation: first },
      { AppName: 'UE_5.7', InstallLocation: 'relative-location' }
    ] }));
    expect(discoverEpicUnrealInstallations(manifest)).toEqual([
      { executablePath: path.join(first, 'Engine/Binaries/Win64/UnrealEditor.exe'), association: '5.8' },
      { executablePath: path.join(second, 'Engine/Binaries/Win64/UnrealEditor.exe'), association: '5.8' }
    ]);
  });
  it.each(['missing', 'malformed', 'oversized', 'wrong-shape'])('does not invent installations from %s manifests', kind => {
    if (kind === 'malformed') fs.writeFileSync(manifest, '{broken');
    if (kind === 'oversized') fs.writeFileSync(manifest, Buffer.alloc(1_048_577));
    if (kind === 'wrong-shape') fs.writeFileSync(manifest, '{"InstallationList":{}}');
    expect(discoverEpicUnrealInstallations(manifest)).toEqual([]);
  });
  it('ranks using complete installed build metadata and rejects a misleading directory label', () => {
    const misleading = path.join(root, 'UE_99.9/Engine/Binaries/Win64/UnrealEditor.exe');
    expect(unrealBuildRank(misleading)).toEqual([0, 0, 0, 0]);
    const executable = path.join(root, 'custom-location/Engine/Binaries/Win64/UnrealEditor.exe');
    const metadata = path.join(root, 'custom-location/Engine/Build/Build.version');
    fs.mkdirSync(path.dirname(metadata), { recursive: true });
    fs.writeFileSync(metadata, JSON.stringify({ MajorVersion: 5, MinorVersion: 8, PatchVersion: 4, Changelist: 60000,
      CompatibleChangelist: 55000, IsLicenseeVersion: 0, IsPromotedBuild: 1, BranchName: 'fixture' }));
    expect(unrealBuildRank(executable)).toEqual([5, 8, 4, 60000]);
  });
  it('finds engines at a library root and its immediate UE_* children without descending into projects', () => {
    const library = path.join(root, 'Epic Games');
    const writeEngine = (location: string) => {
      const editor = path.join(location, 'Engine/Binaries/Win64/UnrealEditor.exe');
      fs.mkdirSync(path.dirname(editor), { recursive: true }); fs.writeFileSync(editor, 'fixture');
    };
    writeEngine(library); writeEngine(path.join(library, 'UE_5.8.4')); writeEngine(path.join(library, 'Projects/Unenrolled'));
    const found = discoverUnrealLibraryInstallations([library]);
    expect(found.map(item => item.executablePath)).toEqual([
      path.join(library, 'Engine/Binaries/Win64/UnrealEditor.exe'), path.join(library, 'UE_5.8.4/Engine/Binaries/Win64/UnrealEditor.exe')
    ]);
  });
});
