import { parseGodotExecutableVersion, parseUnityExecutableVersion, parseUnityProjectVersion, parseUnrealAssociation, parseUnrealBuildIdentity, validateUnrealExecutableVersion, selectExactRuntime, InstalledRuntime } from './EngineVersions';

const build = { MajorVersion: 5, MinorVersion: 8, PatchVersion: 3, Changelist: 12345, CompatibleChangelist: 12000,
  IsLicenseeVersion: 0, IsPromotedBuild: 1, BranchName: 'fixture-branch', BuildId: 'fixture-build' };
const runtime = (overrides: Partial<InstalledRuntime> = {}): InstalledRuntime => ({ runtimeId: 'fixture', engine: 'unreal', exactVersion: '5.8.3',
  executableSha256: 'a'.repeat(64), evidenceId: 'host-fixture', buildIdentityDigest: parseUnrealBuildIdentity(JSON.stringify(build)).buildIdentityDigest, ...overrides });

describe('G01 exact version contracts ported from the reference kit', () => {
  it.each(['4.7.1.stable.official.a13da4feb', '4.4.dev12.mono.custom_build.abcd1234', '4.4.rc1.official.abcd1234'])('preserves the complete Godot identity %s', version => {
    expect(parseGodotExecutableVersion(`${version}\n`)).toBe(version);
  });
  it.each(['4.7', 'latest', '4.4.devX.official.abcd1234', '4.7.1.stable\nother', '\ud800'])('rejects unresolved/malformed Godot output %s', version => {
    expect(() => parseGodotExecutableVersion(version)).toThrow();
  });
  it.each(['6000.4.5f1', '2022.3.7p2', '6000.5.0b3', '6000.5.0a1'])('preserves Unity release suffix %s', version => {
    expect(parseUnityProjectVersion(`\ufeffm_EditorVersion: ${version}\r\n`)).toBe(version);
  });
  it('parses the observed Unity file-resource revision format without accepting arbitrary suffixes', () => {
    expect(parseUnityExecutableVersion('6000.4.5f1_cc83ebd631f8')).toBe('6000.4.5f1');
    expect(() => parseUnityExecutableVersion('6000.4.5f1_arbitrary-text')).toThrow('UNRECOGNIZED_UNITY_EXECUTABLE_VERSION');
  });
  it.each(['m_EditorVersion:\n6000.4.5f1', 'm_EditorVersion: 6000.4.5f1 extra', 'm_EditorVersion: 6000.4.5f1\nm_EditorVersion: 6000.4.5f1'])('rejects ambiguous Unity metadata', value => {
    expect(() => parseUnityProjectVersion(value)).toThrow('UNRECOGNIZED_UNITY_VERSION');
  });
  it('treats an Unreal GUID as an association and binds the whole build record', () => {
    const guid = '{00000000-0000-0000-0000-000000000001}';
    expect(parseUnrealAssociation(JSON.stringify({ EngineAssociation: guid }))).toBe(guid);
    const original = parseUnrealBuildIdentity(JSON.stringify(build));
    for (const change of [{ Changelist: 12346 }, { BranchName: 'different' }, { BuildId: 'different' }, { Extension: { Toolchain: 'other' } }]) {
      expect(parseUnrealBuildIdentity(JSON.stringify({ ...build, ...change })).buildIdentityDigest).not.toBe(original.buildIdentityDigest);
    }
    expect(parseUnrealBuildIdentity(JSON.stringify(Object.fromEntries(Object.entries(build).reverse()))).buildIdentityDigest).toBe(original.buildIdentityDigest);
  });
  it('rejects incomplete build identity, release-only selection, duplicate installs and foreign build identity', () => {
    expect(() => parseUnrealBuildIdentity('{"MajorVersion":5,"MinorVersion":8,"PatchVersion":3}')).toThrow('INCOMPLETE_UNREAL_BUILD_IDENTITY');
    const first = runtime(), second = runtime({ runtimeId: 'other' });
    expect(() => selectExactRuntime('unreal', '5.8.3', [first])).toThrow('UNREAL_BUILD_BINDING_REQUIRED');
    expect(() => selectExactRuntime('unreal', '5.8.3', [first, second], undefined, first.buildIdentityDigest)).toThrow('AMBIGUOUS_RUNTIME_SELECTION');
    expect(() => selectExactRuntime('unreal', '5.8.3', [first], first.runtimeId, 'b'.repeat(64))).toThrow('UNREAL_BUILD_IDENTITY_MISMATCH');
    expect(selectExactRuntime('unreal', '5.8.3', [first, second], first.runtimeId).runtimeId).toBe(first.runtimeId);
    expect(() => selectExactRuntime('unreal', '5.8.3', [runtime({ evidenceId: '' })], first.runtimeId)).toThrow('UNVERIFIED_RUNTIME');
  });
  it('cross-checks Unreal resource branch/changelist without requiring a release prefix in ProductVersion', () => {
    const identity = parseUnrealBuildIdentity(JSON.stringify({ ...build, BranchName: '++UE5+Release-5.8' }));
    expect(() => validateUnrealExecutableVersion('++UE5+Release-5.8-CL-12345', identity)).not.toThrow();
    expect(() => validateUnrealExecutableVersion('5.8.3-12345+++UE5+Release-5.8', identity)).not.toThrow();
    for (const wrong of ['5.8.3', '++UE5+Release-5.8-CL-12346', '++UE5+Other-CL-12345', '5.8.4-12345+++UE5+Release-5.8']) {
      expect(() => validateUnrealExecutableVersion(wrong, identity)).toThrow('UNREAL_EXECUTABLE_BUILD_VERSION_MISMATCH');
    }
  });
});
