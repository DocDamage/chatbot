import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { discoverLocalRuntimes, isCompleteUnrealEditor } from '../RuntimeDiscovery';

describe('native runtime discovery', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-discovery-'));
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('rejects partial Unreal installs and accepts an editor with shaders and automation tooling', () => {
    const editor = path.join(root, 'Engine', 'Binaries', 'Win64', 'UnrealEditor.exe');
    fs.mkdirSync(path.dirname(editor), { recursive: true });
    fs.writeFileSync(editor, 'fixture');
    expect(isCompleteUnrealEditor(editor)).toBe(false);

    fs.mkdirSync(path.join(root, 'Engine', 'Shaders'), { recursive: true });
    fs.mkdirSync(path.join(root, 'Engine', 'Content'), { recursive: true });
    const runUat = path.join(root, 'Engine', 'Build', 'BatchFiles', 'RunUAT.bat');
    fs.mkdirSync(path.dirname(runUat), { recursive: true });
    fs.writeFileSync(runUat, '@echo off');

    expect(isCompleteUnrealEditor(editor)).toBe(true);
  });

  it('discovers host runtimes without emitting locator failures', () => {
    const inventory = discoverLocalRuntimes(root);
    expect(inventory.ollamaEndpoint).toMatch(/^http/);
    expect(inventory.powershell || inventory.python).toBeTruthy();
  });
});
