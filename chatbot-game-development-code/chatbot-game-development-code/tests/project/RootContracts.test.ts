import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, digestJson } from '../../src/common/CanonicalJson';
import { classifyProjectFile, projectRelativePath } from '../../src/project/ProjectFilePolicy';
import { parseGodotExecutableVersion, parseUnityProjectVersion, parseUnrealAssociation, parseUnrealBuildVersion, selectExactRuntime } from '../../src/project/EngineVersions';

test('proposal integrity changes for nested action changes and preserves array order', () => {
  const first = { actions: [{ type: 'set_property', params: { speed: 100, nested: { enabled: true } } }] };
  const second = { actions: [{ type: 'set_property', params: { speed: 101, nested: { enabled: true } } }] };
  assert.notEqual(digestJson('game-proposal:v1', first), digestJson('game-proposal:v1', second));
  assert.equal(canonicalJson({ b: 2, a: { z: 3, c: 1 } }), canonicalJson({ a: { c: 1, z: 3 }, b: 2 }));
  assert.notEqual(digestJson('x', [1, 2]), digestJson('x', [2, 1]));
});

test('canonical JSON rejects lossy, cyclic and executable inputs', () => {
  const circular: Record<string, unknown> = {}; circular.self = circular;
  for (const value of [undefined, NaN, Infinity, 1n, new Date(), circular, [, 1], { a: undefined }]) assert.throws(() => canonicalJson(value));
  const object = Object.defineProperty({}, 'unsafe', { enumerable: true, get: () => { throw new Error('MUST_NOT_EXECUTE'); } });
  assert.throws(() => canonicalJson(object), /CANONICAL_NON_DATA_PROPERTY/);
});

test('game-aware file roles permit required text and preserve native assets', () => {
  assert.equal(classifyProjectFile('godot', 'Scenes/Player.tscn').role, 'editable-text');
  assert.equal(classifyProjectFile('godot', '.godot/imported/Player.ctex').role, 'excluded');
  assert.equal(classifyProjectFile('rpg-maker-mz', 'data/Map001.json').role, 'structured-data');
  assert.equal(classifyProjectFile('rpg-maker-mz', 'js/plugins.js').role, 'structured-data');
  assert.equal(classifyProjectFile('rom', 'data/levels.inc').role, 'editable-text');
  assert.equal(classifyProjectFile('unreal', 'Content/World.umap').role, 'engine-native');
  assert.equal(classifyProjectFile('unity', 'Assets/Player.prefab').role, 'engine-native');
  assert.equal(classifyProjectFile('unity', 'Assets/Player.cs.meta').role, 'read-only');
  assert.equal(classifyProjectFile('rom', 'original.sfc').role, 'binary-tool');
});

test('path policy rejects Windows aliases, ADS, traversal and sensitive files', () => {
  for (const file of ['../secret', 'C:\\game\\a.gd', '\\\\host\\share\\a', '/root/a', 'a//b', 'a/./b', 'a/CON.txt', 'a/file:stream', 'a/name.', 'a/name ']) assert.throws(() => projectRelativePath(file));
  assert.equal(projectRelativePath('Scenes\\Player.tscn'), 'Scenes/Player.tscn');
  assert.equal(classifyProjectFile('rom', '.env.local').role, 'excluded');
  assert.equal(classifyProjectFile('rom', 'data/secrets.json').role, 'excluded');
});

test('engine versions preserve native release identities', () => {
  assert.equal(parseGodotExecutableVersion('4.7.2.stable.official.abcd1234\n'), '4.7.2.stable.official.abcd1234');
  assert.throws(() => parseGodotExecutableVersion('config_version=5'));
  assert.equal(parseUnityProjectVersion('m_EditorVersion: 6000.4.5f1\r\nm_EditorVersionWithRevision: 6000.4.5f1 (abcd)\r\n'), '6000.4.5f1');
  assert.throws(() => parseUnityProjectVersion('m_EditorVersion: 6000.4.5f1\nm_EditorVersion: 6000.3.1f1'));
  assert.equal(parseUnrealAssociation('{"EngineAssociation":"{local-guid}"}'), '{local-guid}');
  assert.equal(parseUnrealBuildVersion('{"MajorVersion":5,"MinorVersion":8,"PatchVersion":3}'), '5.8.3');
  assert.throws(() => parseUnrealBuildVersion('{"MajorVersion":5,"MinorVersion":8,"PatchVersion":"3"}'));
});

test('runtime resolution does not silently choose newest or ambiguous editors', () => {
  const runtime = { engine: 'unity' as const, runtimeId: 'editor-a', exactVersion: '6000.4.5f1', executableSha256: 'a'.repeat(64), evidenceId: 'probe-1' };
  assert.equal(selectExactRuntime('unity', runtime.exactVersion, [runtime]).runtimeId, 'editor-a');
  assert.throws(() => selectExactRuntime('unity', '6000.3.1f1', [runtime]), /NOT_INSTALLED/);
  assert.throws(() => selectExactRuntime('unity', runtime.exactVersion, [runtime, { ...runtime, runtimeId: 'editor-b' }]), /AMBIGUOUS/);
  assert.equal(selectExactRuntime('unity', runtime.exactVersion, [runtime, { ...runtime, runtimeId: 'editor-b' }], 'editor-b').runtimeId, 'editor-b');
});
