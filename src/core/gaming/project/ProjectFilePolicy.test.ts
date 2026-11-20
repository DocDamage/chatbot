import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { classifyProjectFile, createProjectFilePolicy, projectRelativePath } from './ProjectFilePolicy';
import { ApprovedRepositoryGateway } from '../../coding/security/ApprovedRepositoryGateway';
import { captureFiles, captureNewFiles } from '../../coding/integrations/ToolWorkspace';
import { PatchConflictDetector } from '../../coding/editing/PatchConflictDetector';

describe('G01.3 shared project file roles and boundaries', () => {
  let root: string;
  const write = (file: string, value: string | Buffer) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, value); };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-file-policy-')); });
  afterEach(() => { expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });

  it('separates editable source, schema-bound data, native assets, binary tools and metadata', () => {
    expect(classifyProjectFile('godot', 'Scenes/Player.tscn').role).toBe('editable-text');
    expect(classifyProjectFile('rpg-maker-mz', 'data/Map001.json').role).toBe('structured-data');
    expect(classifyProjectFile('rpg-maker-mz', 'js/plugins.js').role).toBe('structured-data');
    expect(classifyProjectFile('rom', 'data/levels.inc').role).toBe('editable-text');
    expect(classifyProjectFile('rom', 'original.sfc').role).toBe('binary-tool');
    expect(classifyProjectFile('unity', 'Assets/Player.prefab').role).toBe('engine-native');
    expect(classifyProjectFile('unity', 'Assets/Player.cs.meta').role).toBe('read-only');
    expect(classifyProjectFile('unreal', 'Content/World.umap').role).toBe('engine-native');
    expect(classifyProjectFile('godot', 'README.md').role).toBe('read-only');
  });

  it('rejects ambiguous Windows aliases, streams, traversal and malformed Unicode', () => {
    for (const file of ['../secret', 'C:\\game\\a.gd', '\\\\host\\share\\a', '/root/a', 'a//b', 'a/./b', 'a/CON.txt', 'a/file:stream', 'a/name.', 'a/name ', 'a/\ud800.gd']) expect(() => projectRelativePath(file)).toThrow();
    expect(projectRelativePath('Scenes\\Player.tscn')).toBe('Scenes/Player.tscn');
  });

  it('keeps independent credentials and generated caches excluded for every project kind', () => {
    for (const kind of ['godot', 'unity', 'unreal', 'rpg-maker-mz', 'rom'] as const) {
      for (const file of ['.env.local', 'API Keys/provider.txt', 'data/secrets.json', '.ssh/id_rsa', 'private/value.cpp', '.azure/token.json', '.chatbot-instrumentation/probe.gd']) expect(classifyProjectFile(kind, file).role).toBe('excluded');
    }
    for (const [kind, file] of [['godot', '.godot/imported/secret.gd'], ['unity', 'Library/cache.cs'], ['unreal', 'Plugins/Group/Pack/Intermediate/generated.cpp'], ['rpg-maker-mz', 'save/file.json']] as const) expect(classifyProjectFile(kind, file).role).toBe('excluded');
  });

  it('admits Unreal module Private implementations consistently without admitting unrelated private stores', () => {
    write('Source/Game/Private/Player.cpp', '#include "Player.h"\n// CONTEXT_CANARY');
    write('Source/Game/Public/Player.h', '// header'); write('Source/Game/Private/secrets.json', 'NEVER');
    write('Plugins/Tools/Example/Source/Mod/Private/Helper.cpp', '// helper'); write('Source/private/credential.cpp', 'NEVER');
    const policy = createProjectFilePolicy('unreal'), gateway = new ApprovedRepositoryGateway(root, { filePolicy: policy });
    const files = gateway.listFiles('.', 100);
    expect(files).toContain('Source/Game/Private/Player.cpp'); expect(files).toContain('Plugins/Tools/Example/Source/Mod/Private/Helper.cpp');
    expect(files.some(file => /secrets|credential/.test(file))).toBe(false);
    expect(gateway.searchText('CONTEXT_CANARY').matches[0].path).toBe('Source/Game/Private/Player.cpp');
    expect(captureFiles(root, ['Source/Game/Private/Player.cpp'], undefined, undefined, policy)[0].content).toContain('CONTEXT_CANARY');
    expect(new PatchConflictDetector(root, policy).safe('Source/Game/Private/Player.cpp')).toBe(path.join(root, 'Source/Game/Private/Player.cpp'));
    expect(new ApprovedRepositoryGateway(root).listFiles('.', 100)).not.toContain('Source/Game/Private/Player.cpp');
  });

  it('allows scoped MZ data reads/search while refusing generic data/core/metadata writes and default workspace data access', () => {
    write('data/Actors.json', '[null,{"name":"SCOPED_ACTOR"}]'); write('js/rmmz_core.js', '// engine core');
    const policy = createProjectFilePolicy('rpg-maker-mz'), gateway = new ApprovedRepositoryGateway(root, { filePolicy: policy });
    expect(gateway.listFiles()).toContain('data/Actors.json'); expect(gateway.searchText('SCOPED_ACTOR').matches).toHaveLength(1);
    expect(captureFiles(root, ['data/Actors.json'], 16000, 12, policy, 'read')).toHaveLength(1);
    expect(() => captureFiles(root, ['data/Actors.json'], 16000, 12, policy)).toThrow(/dedicated writer/);
    expect(() => captureNewFiles(root, ['data/Map002.json'], policy)).toThrow();
    expect(() => new PatchConflictDetector(root, policy).safe('data/Actors.json')).toThrow(/dedicated operation/);
    expect(() => new PatchConflictDetector(root, policy).safe('js/rmmz_core.js')).toThrow();
    expect(() => captureFiles(root, ['data/Actors.json'])).toThrow();
    expect(new ApprovedRepositoryGateway(root).searchText('SCOPED_ACTOR').matches).toEqual([]);
  });

  it('preserves exact BOM/CRLF bytes and hashes; invalid UTF-8 and binary roles cannot enter text snapshots', () => {
    const bytes = Buffer.from('\ufeffextends Node\r\n# preserved\r\n'); write('Player.gd', bytes); write('Bad.gd', Buffer.from([0xc3, 0x28])); write('LateNul.gd', Buffer.concat([Buffer.alloc(5000, 65), Buffer.from([0])]));
    write('Player.scn', 'looks like text');
    const policy = createProjectFilePolicy('godot'), record = captureFiles(root, ['Player.gd'], 16000, 12, policy)[0];
    expect(Buffer.from(record.content).equals(bytes)).toBe(true); expect(record.sha256).toBe(crypto.createHash('sha256').update(bytes).digest('hex'));
    for (const file of ['Bad.gd', 'LateNul.gd', 'Player.scn']) expect(() => captureFiles(root, [file], 16000, 12, policy, 'read')).toThrow();
    expect(new ApprovedRepositoryGateway(root, { filePolicy: policy }).searchText('preserved').matches[0].path).toBe('Player.gd');
    expect(fs.readFileSync(path.join(root, 'Player.gd')).equals(bytes)).toBe(true);
  });

  it('rejects links consistently in discovery, explicit capture and write preflight, including in-root links', () => {
    write('src/Player.gd', 'extends Node\n'); fs.symlinkSync(path.join(root, 'src'), path.join(root, 'linked'), process.platform === 'win32' ? 'junction' : 'dir');
    const policy = createProjectFilePolicy('godot'), gateway = new ApprovedRepositoryGateway(root, { filePolicy: policy });
    expect(gateway.listFiles()).not.toContain('linked/Player.gd');
    expect(() => captureFiles(root, ['linked/Player.gd'], 16000, 12, policy)).toThrow(/links/);
    expect(() => new PatchConflictDetector(root, policy).safe('linked/New.gd')).toThrow(/links/);
    expect(createProjectFilePolicy('godot', ['project.godot']).canEditText('project.godot')).toBe(false);
  });
});
