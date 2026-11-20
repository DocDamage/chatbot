import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createProjectFilePolicy } from '../../gaming/project/ProjectFilePolicy';
import { captureFiles } from './ToolWorkspace';
import { selectAutomaticContext } from './AutomaticContext';
import { buildProjectDependencies } from './ProjectDependencies';

describe('G01.3 bounded static dependency providers', () => {
  let root: string;
  const write = (file: string, value: string) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, value); };
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-dependencies-')); });
  afterEach(() => { expect(path.dirname(root)).toBe(path.resolve(os.tmpdir())); fs.rmSync(root, { recursive: true, force: true }); });

  it('follows Godot scenes, attached scripts, inherited resources, UID sidecars and relative loads as read-only supporting context', () => {
    write('Scenes/Player.tscn', '[gd_scene format=3]\n[ext_resource type="Script" path="res://Scripts/Player.gd" id="1"]\n[ext_resource type="PackedScene" path="uid://base" id="2"]\n[node name="Player" instance=ExtResource("2")]\nscript = ExtResource("1")\n');
    write('Scenes/Base.tscn', '[gd_scene format=3 uid="uid://base"]\n[node name="Base" type="Node"]');
    write('Scripts/Player.gd', 'extends Node\nconst Item = preload("Item.gd")\nvar dynamic = load(next_scene)\nvar asset = load("uid://icon")\nsignal checkpoint\n');
    write('Scripts/Item.gd', 'extends Node\n'); write('Scripts/Icon.gd', 'extends Node\n'); write('Scripts/Icon.gd.uid', 'uid://icon\n');
    write('.godot/imported/Cache.gd', 'NEVER'); write('secrets/Hidden.gd', 'NEVER');
    const filePolicy = createProjectFilePolicy('godot');
    const selected = captureFiles(root, ['Scenes/Player.tscn'], 16000, 12, filePolicy);
    const result = selectAutomaticContext(root, selected, [], 'Fix player scene', true, { filePolicy });
    expect(result.editable.map(f => f.path)).toEqual(['Scenes/Player.tscn']);
    expect(result.readOnly.map(f => f.path)).toEqual(expect.arrayContaining(['Scripts/Player.gd', 'Scenes/Base.tscn', 'Scripts/Item.gd', 'Scripts/Icon.gd']));
    expect(result.dependencies?.edges).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'godot-dynamic-load', reference: 'next_scene', reason: 'Dynamic expressions are not evaluated' })]));
    expect(result.summary.some(f => /Cache|Hidden/.test(f.path))).toBe(false);
  });

  it('keeps missing/duplicate UIDs and dynamic paths unresolved without inventing another project file', () => {
    write('Main.gd', 'extends Node\nvar a = load("uid://duplicate")\nvar b = load("res://Absent.tscn")\n# preload("res://Ignored.gd")\n');
    write('One.gd.uid', 'uid://duplicate'); write('Two.gd.uid', 'uid://duplicate');
    const filePolicy = createProjectFilePolicy('godot');
    const result = selectAutomaticContext(root, captureFiles(root, ['Main.gd'], 16000, 12, filePolicy), [], 'Fix Main', true, { filePolicy });
    expect(result.dependencies?.edges.every(edge => !edge.to)).toBe(true);
    expect(result.dependencies?.edges.some(edge => edge.reference.includes('Ignored'))).toBe(false);
    expect(result.dependencies?.edges).toHaveLength(2);
  });

  it('follows ordered MZ plugins and typed database IDs without evaluating plugin code or granting database edit permission', () => {
    write('js/plugins.js', 'var $plugins = [{"name":"Checkpoint","status":true,"parameters":{}},{"name":"Disabled","status":false}];');
    write('js/plugins/Checkpoint.js', 'globalThis.SHOULD_NOT_EXECUTE = true;'); write('js/plugins/Disabled.js', '// disabled plugin');
    write('data/Map001.json', '{"tilesetId":2,"events":[null,{"actorId":1,"mapId":2}]}');
    write('data/Actors.json', '[null,{"id":1,"classId":1}]'); write('data/Classes.json', '[null,{"id":1}]');
    write('data/MapInfos.json', '[null,{"id":1}]'); write('data/Map002.json', '{}'); write('data/Tilesets.json', '[null,{"id":2}]');
    const filePolicy = createProjectFilePolicy('rpg-maker-mz');
    const result = selectAutomaticContext(root, captureFiles(root, ['data/Map001.json', 'js/plugins.js'], 16000, 12, filePolicy, 'read'), [], '', true, { filePolicy, readOnly: true });
    expect(result.editable).toEqual([]); expect(result.readOnly.map(f => f.path)).toEqual(expect.arrayContaining(['data/Actors.json', 'data/Classes.json', 'data/Tilesets.json', 'data/MapInfos.json', 'js/plugins/Checkpoint.js']));
    expect(result.dependencies?.edges).toContainEqual(expect.objectContaining({ kind: 'mz-plugin-order:1:disabled', to: 'js/plugins/Disabled.js' }));
    expect((globalThis as any).SHOULD_NOT_EXECUTE).toBeUndefined();
  });

  it('bounds assembly include cycles and records binary includes without reading ROM bytes', () => {
    write('data/main.asm', 'incsrc "levels.inc"\nincbin "original.sfc"\nincsrc "../secrets/keys.inc"\nincsrc "../../outside.inc"\n');
    write('data/levels.inc', 'include "main.asm"\nLabel:\n'); write('data/original.sfc', 'DO_NOT_READ_ROM_BYTES'); write('secrets/keys.inc', 'NEVER');
    const filePolicy = createProjectFilePolicy('rom');
    const result = selectAutomaticContext(root, captureFiles(root, ['data/main.asm'], 16000, 12, filePolicy), [], 'Fix label', true, { filePolicy });
    expect(result.readOnly.map(f => f.path)).toEqual(['data/levels.inc']);
    expect(result.dependencies?.edges).toContainEqual(expect.objectContaining({ kind: 'rom-binary-include', to: 'data/original.sfc' }));
    expect(result.omissions).toContainEqual(expect.objectContaining({ path: 'data/original.sfc', reason: expect.stringContaining('metadata only') }));
    expect(JSON.stringify(result)).not.toContain('DO_NOT_READ_ROM_BYTES');
    expect(result.dependencies?.edges.filter(edge => edge.reference.includes('outside') || edge.reference.includes('secrets')).every(edge => !edge.to)).toBe(true);
  });

  it('records exactly which necessary dependencies exceeded the unchanged capture budget', () => {
    write('Main.gd', 'extends Node\nconst Big = preload("res://Big.gd")'); write('Big.gd', '#'.repeat(18000));
    const filePolicy = createProjectFilePolicy('godot');
    const result = selectAutomaticContext(root, captureFiles(root, ['Main.gd'], 16000, 12, filePolicy), [], 'Fix Main', true, { filePolicy });
    expect(result.omissions).toContainEqual({ path: 'Big.gd', reason: expect.stringContaining('16 KB') });
    expect(result.summary.reduce((sum, file) => sum + file.bytes, 0)).toBeLessThanOrEqual(16000);
    const disabled = selectAutomaticContext(root, captureFiles(root, ['Main.gd'], 16000, 12, filePolicy), [], '', false, { filePolicy });
    expect(disabled.readOnly).toEqual([]); expect(disabled.scannedFiles).toBe(0);
  });

  it('resolves unique Unreal headers and Unity GUID metadata but does not infer native asset semantics', () => {
    const cpp = { path: 'Source/Game/Private/Player.cpp', content: '#include "Player.h"\n#include "Ambiguous.h"', sha256: '' };
    const known = new Set([cpp.path, 'Source/Game/Public/Player.h', 'Source/A/Ambiguous.h', 'Source/B/Ambiguous.h']);
    const unreal = buildProjectDependencies([cpp], known, createProjectFilePolicy('unreal'));
    expect(unreal.edges).toContainEqual(expect.objectContaining({ to: 'Source/Game/Public/Player.h' }));
    expect(unreal.edges.find(edge => edge.reference === 'Ambiguous.h')?.to).toBeUndefined();
    const guid = 'a'.repeat(32), meta = { path: 'Assets/Player.prefab.meta', content: `guid: ${guid}`, sha256: '' };
    const unity = buildProjectDependencies([meta], new Set([meta.path, 'Assets/Player.prefab']), createProjectFilePolicy('unity'));
    expect(unity.edges[0]).toMatchObject({ kind: 'unity-guid', to: 'Assets/Player.prefab' });
    expect(unity.limitations.join()).toContain('editor inspection');
  });

  it('reports malformed JSON, missing sentinels and executable plugin assignments without evaluating them', () => {
    const records = [{ path: 'data/Actors.json', content: '[{"classId":1}]', sha256: '' }, { path: 'data/Map001.json', content: '{', sha256: '' },
      { path: 'js/plugins.js', content: 'var $plugins = runCode();', sha256: '' }];
    const graph = buildProjectDependencies(records, new Set(records.map(f => f.path)), createProjectFilePolicy('rpg-maker-mz'));
    expect(graph.edges.map(edge => edge.kind)).toEqual(expect.arrayContaining(['mz-null-sentinel', 'mz-data', 'mz-plugins']));
    expect(graph.edges.every(edge => !edge.to)).toBe(true);
  });
});
