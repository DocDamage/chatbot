import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { classifyProjectFile, projectRelativePath } from '../../src/project/ProjectFilePolicy';
import {
  parseGodotExecutableVersion,
  parseUnityProjectVersion,
  parseUnrealBuildIdentity,
  parseUnrealBuildVersion,
  selectExactRuntime,
  type InstalledRuntime,
} from '../../src/project/EngineVersions';

const unrealMetadata = {
  MajorVersion: 5, MinorVersion: 8, PatchVersion: 3,
  Changelist: 12345, CompatibleChangelist: 12000,
  IsLicenseeVersion: 0, IsPromotedBuild: 1,
  BranchName: 'synthetic-test-branch', BuildId: 'synthetic-test-build',
};

function unrealRuntime(overrides: Partial<InstalledRuntime> = {}): InstalledRuntime {
  return {
    runtimeId: 'unreal-fixture-a', engine: 'unreal', exactVersion: '5.8.3',
    executableSha256: 'a'.repeat(64), evidenceId: 'authenticated-host-probe-fixture',
    buildIdentityDigest: parseUnrealBuildIdentity(JSON.stringify(unrealMetadata)).buildIdentityDigest,
    ...overrides,
  };
}

test('project paths reject Unicode aliases while preserving valid supplementary characters', () => {
  for (const file of ['scripts/\ud800.gd', 'scripts/\ud801.gd', 'scripts/\udfff.gd', 'scripts/a\ud800x.gd']) {
    assert.throws(() => projectRelativePath(file), /INVALID_PROJECT_PATH/);
  }
  assert.equal(projectRelativePath('Scenes/🎮.tscn'), 'Scenes/🎮.tscn');
  assert.equal(classifyProjectFile('godot', 'Scripts/über.gd').role, 'editable-text');
});

test('credential stores and key filenames do not become editable ROM source', () => {
  for (const file of [
    '.azure/accessTokens.json', '.config/gcloud/application_default_credentials.json',
    '.docker/config.json', 'nested/.aws/config.json', 'credentials/game.json',
    'secrets/config.json', '.secrets/config.json', 'api keys/provider.json',
    'private/config.json', 'data/api_keys.json', 'data/api-key.json', '.npmrc', '.netrc',
    '.git-credentials', 'id_rsa', 'id_ed25519', 'nested/.ssh/known_hosts',
  ]) assert.equal(classifyProjectFile('rom', file).role, 'excluded', file);
  assert.equal(classifyProjectFile('rom', 'data/levels.inc').role, 'editable-text');
});

test('Windows reserved aliases include superscript device numbers and console handles', () => {
  for (const file of ['a/COM¹.txt', 'a/com².asm', 'a/COM³', 'a/LPT¹.inc', 'a/lpt².txt', 'a/LPT³', 'a/CONIN$', 'a/conout$.txt']) {
    assert.throws(() => projectRelativePath(file), /AMBIGUOUS_PROJECT_PATH/, file);
  }
  assert.equal(projectRelativePath('Source/COM10.cpp'), 'Source/COM10.cpp');
  assert.equal(projectRelativePath('Source/Controller.cpp'), 'Source/Controller.cpp');
});

test('Unity generated roots are excluded without blocking authored subdirectories', () => {
  for (const file of ['Library/Cache.cs', 'Temp/Cache.cs', 'obj/Generated.cs', 'Logs/Session.txt']) {
    assert.equal(classifyProjectFile('unity', file).role, 'excluded', file);
  }
  for (const file of ['Assets/Library/User.cs', 'Assets/Gameplay/Temp/State.cs', 'Assets/Logs/Viewer.cs']) {
    assert.equal(classifyProjectFile('unity', file).role, 'editable-text', file);
  }
});

test('Unreal excludes project and plugin generated trees before authored-tree boundaries', () => {
  for (const file of [
    'Intermediate/Build/File.cpp', 'Binaries/File.cpp', 'Saved/Backup.cpp', 'DerivedDataCache/File.cpp',
    'Plugins/MyPlugin/Intermediate/Generated.cpp', 'Plugins/MyPlugin/Binaries/Generated.cpp',
    'Plugins/Category/MyPlugin/Saved/Backup.cpp', 'Plugins/Category/MyPlugin/DerivedDataCache/File.cpp',
  ]) assert.equal(classifyProjectFile('unreal', file).role, 'excluded', file);
  for (const file of [
    'Source/Game/Saved/Actual.cpp', 'Source/Game/Intermediate/Actual.cpp',
    'Plugins/MyPlugin/Source/Game/Saved/Actual.cpp',
    'Plugins/Category/MyPlugin/Source/Game/Binaries/Actual.cpp',
  ]) assert.equal(classifyProjectFile('unreal', file).role, 'editable-text', file);
  assert.equal(classifyProjectFile('unreal', 'Plugins/MyPlugin/Content/Saved/Asset.uasset').role, 'engine-native');
});

test('Unreal module Private remains source while unrelated private data is excluded', () => {
  for (const file of [
    'Source/Game/Private/Actor.cpp',
    'Plugins/MyPlugin/Source/Module/Private/Actor.cpp',
    'Plugins/Category/MyPlugin/Source/Module/Private/Actor.cpp',
  ]) assert.equal(classifyProjectFile('unreal', file).role, 'editable-text', file);
  assert.equal(classifyProjectFile('unreal', 'Plugins/MyPlugin/private/credentials.cpp').role, 'excluded');
  assert.equal(classifyProjectFile('rom', 'src/private/game.c').role, 'excluded');
});

test('Godot numbered dev releases retain their complete identity', () => {
  for (const version of ['4.4.dev1.official.abcd1234', '4.4.dev12.mono.custom_build.abcd1234', '4.4.dev.official.abcd1234']) {
    assert.equal(parseGodotExecutableVersion(`${version}\n`), version);
  }
  assert.throws(() => parseGodotExecutableVersion('4.4.devX.official.abcd1234'), /UNRECOGNIZED_GODOT_VERSION/);
});

test('Unity per-line parsing supports CRLF and rejects cross-line and duplicate values', () => {
  assert.equal(parseUnityProjectVersion('\uFEFFm_EditorVersion: 6000.4.5f1\r\nm_EditorVersionWithRevision: 6000.4.5f1 (fixture)\r\n'), '6000.4.5f1');
  assert.equal(parseUnityProjectVersion('\tm_EditorVersion :\t2022.3.7p2 \r\n'), '2022.3.7p2');
  for (const value of [
    'm_EditorVersion:\n6000.4.5f1\n',
    'm_EditorVersion: \r\n6000.4.5f1\r\n',
    'm_EditorVersion: 6000.4.5f1\nm_EditorVersion: 6000.4.5f1',
    'm_EditorVersion: 6000.4.5f1 extra',
    `m_EditorVersion: ${'1'.repeat(65)}.1.1f1`,
  ]) assert.throws(() => parseUnityProjectVersion(value), /UNRECOGNIZED_UNITY_VERSION/);
});

test('Unity long blank inputs are bounded and do not affect a later valid line', () => {
  const blankLines = '\n'.repeat(100000);
  assert.throws(() => parseUnityProjectVersion(blankLines), /UNRECOGNIZED_UNITY_VERSION/);
  assert.equal(parseUnityProjectVersion(`${blankLines}m_EditorVersion: 6000.4.5f1\n`), '6000.4.5f1');
  assert.throws(() => parseUnityProjectVersion(' '.repeat(1_048_577)), /INVALID_VERSION_INPUT/);
});

test('Unreal full build identity distinguishes metadata beyond the release string', () => {
  const original = parseUnrealBuildIdentity(JSON.stringify(unrealMetadata));
  assert.equal(original.releaseVersion, '5.8.3');
  assert.equal(Object.isFrozen(original), true);
  assert.deepEqual(JSON.parse(original.canonicalBuildMetadata), unrealMetadata);
  for (const changed of [
    { ...unrealMetadata, Changelist: 12346 },
    { ...unrealMetadata, BranchName: 'another-test-branch' },
    { ...unrealMetadata, BuildId: 'another-test-build' },
    { ...unrealMetadata, HostExtension: { Toolchain: 'another-test-toolchain' } },
  ]) {
    assert.equal(parseUnrealBuildVersion(JSON.stringify(changed)), original.releaseVersion);
    assert.notEqual(parseUnrealBuildIdentity(JSON.stringify(changed)).buildIdentityDigest, original.buildIdentityDigest);
  }
  const reordered = Object.fromEntries(Object.entries(unrealMetadata).reverse());
  assert.equal(parseUnrealBuildIdentity(JSON.stringify(reordered, null, 2)).buildIdentityDigest, original.buildIdentityDigest);
});

test('Unreal build identity rejects incomplete or invalid build records', () => {
  assert.throws(() => parseUnrealBuildIdentity('{"MajorVersion":5,"MinorVersion":8,"PatchVersion":3}'), /INCOMPLETE_UNREAL_BUILD_IDENTITY/);
  for (const change of [
    { Changelist: -1 }, { CompatibleChangelist: '12000' }, { IsLicenseeVersion: true },
    { IsPromotedBuild: 2 }, { BranchName: null }, { BranchName: 'bad\nbranch' }, { BuildId: 42 },
  ]) assert.throws(() => parseUnrealBuildIdentity(JSON.stringify({ ...unrealMetadata, ...change })), /UNREAL_BUILD_IDENTITY/);
});

test('Unreal release-only selection fails even when exactly one runtime is installed', () => {
  const runtime = unrealRuntime();
  assert.throws(() => selectExactRuntime('unreal', '5.8.3', [runtime]), /UNREAL_BUILD_BINDING_REQUIRED/);
  assert.equal(selectExactRuntime('unreal', '5.8.3', [runtime], undefined, runtime.buildIdentityDigest).runtimeId, runtime.runtimeId);
});

test('Unreal full build binding filters same-release runtimes and cannot be bypassed by selectedId', () => {
  const correct = unrealRuntime();
  const other = unrealRuntime({ runtimeId: 'unreal-fixture-b', buildIdentityDigest: 'b'.repeat(64) });
  assert.equal(selectExactRuntime('unreal', '5.8.3', [correct, other], undefined, correct.buildIdentityDigest).runtimeId, correct.runtimeId);
  assert.throws(() => selectExactRuntime('unreal', '5.8.3', [other], other.runtimeId, correct.buildIdentityDigest), /UNREAL_BUILD_IDENTITY_MISMATCH/);
  assert.throws(() => selectExactRuntime('unreal', '5.8.3', [other], undefined, 'latest'), /INVALID_EXPECTED_BUILD_IDENTITY/);
});

test('explicit Unreal runtime selection requires verified installation evidence', () => {
  const runtime = unrealRuntime();
  assert.equal(selectExactRuntime('unreal', '5.8.3', [runtime], runtime.runtimeId).runtimeId, runtime.runtimeId);
  for (const changed of [{ ...runtime, evidenceId: '' }, { ...runtime, executableSha256: 'unknown' }]) {
    assert.throws(() => selectExactRuntime('unreal', '5.8.3', [changed], runtime.runtimeId), /UNVERIFIED_RUNTIME/);
  }
  assert.throws(() => selectExactRuntime('unreal', '5.8.3', [runtime], ''), /INVALID_RUNTIME_SELECTION/);
});
