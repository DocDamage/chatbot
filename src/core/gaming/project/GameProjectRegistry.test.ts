import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database } from '../../database/Database';
import { GameProjectStore } from './GameProjectStore';
import { GameProjectRegistry } from './GameProjectRegistry';
import { ProjectProfileResolver } from './ProjectProfileResolver';
import { ProjectRuntimeCatalog } from './ProjectRuntimeCatalog';
import { validateEnrollmentPath } from './ProjectIdentity';
import { runNativeCommand } from '../../native-runtime/NativeCommandRunner';

describe('G01 durable project enrollment and freshness (real SQLite, fixture version process)', () => {
  let root: string, game: string, executable: string;
  let database: Database, registry: GameProjectRegistry, catalog: ProjectRuntimeCatalog;
  const owner = { ownerId: 'alice', tenantId: 'local' };
  const selection = { expectedVersion: '4.7.1.stable.official.fixture' };
  const writeGame = (directory: string) => {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'project.godot'), '\ufeffconfig_version=5\r\n[application]\r\nconfig/features=PackedStringArray("4.7", "GL Compatibility")\r\n[rendering]\r\nrenderer/rendering_method="gl_compatibility"\r\n');
  };
  beforeEach(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-project-registry-')); game = path.join(root, 'game'); writeGame(game);
    executable = path.join(root, 'godot-fixture.exe'); fs.writeFileSync(executable, 'fixture executable bytes');
    const run: typeof runNativeCommand = async () => ({ exitCode: 0, stdout: selection.expectedVersion, stderr: '', durationMs: 1 });
    catalog = new ProjectRuntimeCatalog(root, () => [{ engine: 'godot', executablePath: executable }], run);
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.db') }); await database.initialize();
    registry = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'test');
  });
  afterEach(async () => {
    await database.close();
    expect(path.dirname(path.resolve(root))).toBe(path.resolve(os.tmpdir()));
    expect(path.basename(root)).toMatch(/^game-project-registry-/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('keeps physical identity, profile digest and reusable compatibility target separate across owners/roots', async () => {
    const one = await registry.enroll(owner, game, 'godot', selection);
    expect(one.profile).toMatchObject({ resolution: 'resolved', facts: { projectVersion: null }, runtime: { exactVersion: selection.expectedVersion } });
    expect(one.profile.targetId).toMatch(/^[0-9a-f]{64}$/);
    const secondRoot = path.join(root, 'second'); writeGame(secondRoot);
    const two = await registry.enroll({ ...owner, ownerId: 'bob' }, secondRoot, 'godot', selection);
    expect(two.projectId).not.toBe(one.projectId);
    expect(two.profile.profileDigest).not.toBe(one.profile.profileDigest);
    expect(two.profile.targetId).toBe(one.profile.targetId);
    expect((await registry.list(owner)).map(project => project.projectId)).toEqual([one.projectId]);
    await expect(registry.get({ ...owner, ownerId: 'bob' }, one.projectId)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    await expect(registry.get({ ...owner, tenantId: 'other' }, one.projectId)).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
    const shared = await registry.enroll({ ...owner, ownerId: 'bob' }, game, 'godot', selection);
    expect(shared.physicalKey).toBe(one.physicalKey);
    one.profile.facts.language = 'tampered';
    expect((await registry.get(owner, one.projectId)).profile.facts.language).toBe('gdscript');
  });

  it('does not infer an exact release from Godot config_version or a feature label', async () => {
    const pending = await registry.enroll(owner, game, 'godot');
    expect(pending.profile).toMatchObject({ resolution: 'blocked', targetId: null, facts: { projectVersion: null } });
    expect(pending.profile.blockers.map(item => item.code)).toContain('RUNTIME_SELECTION_REQUIRED');
    const wrong = await registry.refresh(owner, pending.projectId, 1, { expectedVersion: '4.6.1.stable.official.fixture' });
    expect(wrong.profile.blockers.map(item => item.code)).toContain('PROJECT_RUNTIME_VERSION_MISMATCH');
    expect(wrong.profile.targetId).toBeNull();
    const resolved = await registry.refresh(owner, pending.projectId, 2, selection);
    expect(resolved.profile.resolution).toBe('resolved');
  });

  it('persists a missing runtime as an actionable blocker instead of choosing an adapter default', async () => {
    const missing = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(new ProjectRuntimeCatalog(root, () => [])), 'test');
    const project = await missing.enroll(owner, game, 'godot', selection);
    expect(project.profile.resolution).toBe('blocked');
    expect(project.profile.blockers.map(item => item.code)).toContain('RUNTIME_NOT_INSTALLED');
    expect(project.profile.runtime).toBeNull();
  });

  it('refreshes changed descriptors with revision checks and rejects concurrent lost updates', async () => {
    const project = await registry.enroll(owner, game, 'godot', selection);
    fs.appendFileSync(path.join(game, 'project.godot'), '\r\n# configuration change\r\n');
    await expect(registry.get(owner, project.projectId)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_STALE' });
    const next = await registry.refresh(owner, project.projectId, 1);
    expect(next.revision).toBe(2);
    expect(next.profile.profileDigest).not.toBe(project.profile.profileDigest);
    expect(next.profile.targetId).toBe(project.profile.targetId);
    await expect(registry.refresh(owner, project.projectId, 1)).rejects.toMatchObject({ code: 'PROJECT_REVISION_CONFLICT' });
    const competing = await Promise.allSettled([registry.refresh(owner, project.projectId, 2), registry.refresh(owner, project.projectId, 2)]);
    expect(competing.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(competing.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect((await registry.get(owner, project.projectId)).revision).toBe(3);
  });

  it('detects newly added configuration and does not silently convert C# to GDScript', async () => {
    const project = await registry.enroll(owner, game, 'godot', selection);
    fs.writeFileSync(path.join(game, 'Game.csproj'), '<Project><PropertyGroup><TargetFramework>net8.0</TargetFramework></PropertyGroup></Project>');
    await expect(registry.get(owner, project.projectId)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_STALE' });
    const changed = await registry.refresh(owner, project.projectId, 1);
    expect(changed.profile.facts.language).toBe('csharp');
    expect(changed.profile.blockers.map(item => item.code)).toContain('GODOT_MONO_RUNTIME_REQUIRED');
  });

  it('invalidates changed executables and requires a new explicit runtime selection', async () => {
    const runtime = (await catalog.inventory('godot')).runtimes[0];
    const project = await registry.enroll(owner, game, 'godot', { selectedRuntimeId: runtime.runtimeId });
    fs.appendFileSync(executable, ' changed');
    await expect(registry.get(owner, project.projectId)).rejects.toMatchObject({ code: 'PROJECT_RUNTIME_STALE' });
    const staleSelection = await registry.refresh(owner, project.projectId, 1);
    expect(staleSelection.profile.resolution).toBe('blocked');
    const replacement = (await catalog.inventory('godot')).runtimes[0];
    expect(replacement.runtimeId).not.toBe(runtime.runtimeId);
    const updated = await registry.refresh(owner, project.projectId, 2, { selectedRuntimeId: replacement.runtimeId });
    expect(updated.profile.resolution).toBe('resolved');
  });

  it('requires re-enrollment after a move, and rejects replacing the enrolled root in place', async () => {
    const project = await registry.enroll(owner, game, 'godot', selection);
    const moved = path.join(root, 'moved'); fs.renameSync(game, moved);
    await expect(registry.get(owner, project.projectId)).rejects.toMatchObject({ code: 'PROJECT_ROOT_MISSING' });
    const relocated = await registry.enroll(owner, moved, 'godot', selection);
    expect(relocated.projectId).not.toBe(project.projectId);
    expect(relocated.profile.targetId).toBe(project.profile.targetId);
    writeGame(game);
    await expect(registry.enroll(owner, game, 'godot', selection)).rejects.toMatchObject({ code: 'PROJECT_ROOT_IDENTITY_CHANGED' });
  });

  it('deduplicates in-workspace junction aliases and confines roots/descriptors', async () => {
    const project = await registry.enroll(owner, game, 'godot', selection);
    const alias = path.join(root, 'alias'); fs.symlinkSync(game, alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect((await registry.enroll(owner, alias, 'godot', selection)).projectId).toBe(project.projectId);
    if (process.platform === 'win32') expect((await registry.enroll(owner, game.toUpperCase(), 'godot', selection)).projectId).toBe(project.projectId);
    const escape = path.join(root, 'escape'); fs.symlinkSync(os.tmpdir(), escape, process.platform === 'win32' ? 'junction' : 'dir');
    await expect(registry.enroll(owner, escape, 'godot', selection)).rejects.toThrow('link outside');
    await expect(registry.enroll(owner, '../', 'godot', selection)).rejects.toMatchObject({ code: 'INVALID_PROJECT_ROOT' });
    await expect(registry.enroll(owner, game, 'unity', selection)).rejects.toMatchObject({ code: 'PROJECT_KIND_CONFLICT' });
  });

  it('rejects addon metadata junctions that escape the project even inside the broader workspace', async () => {
    const outside = path.join(root, 'outside-addon'); fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, 'plugin.cfg'), '[plugin]\nname="Outside"\nversion="1.0"\n');
    fs.mkdirSync(path.join(game, 'addons'));
    fs.symlinkSync(outside, path.join(game, 'addons/escape'), process.platform === 'win32' ? 'junction' : 'dir');
    fs.appendFileSync(path.join(game, 'project.godot'), '[editor_plugins]\nenabled=PackedStringArray("res://addons/escape/plugin.cfg")\n');
    await expect(registry.enroll(owner, game, 'godot', selection)).rejects.toThrow('link outside');
    expect(await registry.list(owner)).toEqual([]);
  });

  it.each(['binary', 'oversized'])('rejects %s descriptor bytes without persisting a misleading profile', async kind => {
    const bytes = kind === 'binary' ? Buffer.from([0xff, 0, 0xfe]) : Buffer.alloc(1_048_577, 32);
    fs.writeFileSync(path.join(game, 'project.godot'), bytes);
    await expect(registry.enroll(owner, game, 'godot', selection)).rejects.toMatchObject({ code: kind === 'binary' ? 'DESCRIPTOR_ENCODING' : 'DESCRIPTOR_LIMIT' });
    expect(await registry.list(owner)).toEqual([]);
  });

  it('detects persisted profile body corruption instead of trusting its digest label', async () => {
    const project = await registry.enroll(owner, game, 'godot', selection);
    const corrupted = { ...project.profile, facts: { ...project.profile.facts, language: 'tampered' } };
    await database.query('UPDATE game_enrolled_projects SET profile_json = ? WHERE owner_id = ? AND tenant_id = ? AND project_id = ?',
      [JSON.stringify(corrupted), owner.ownerId, owner.tenantId, project.projectId]);
    await expect(registry.get(owner, project.projectId)).rejects.toMatchObject({ code: 'PROJECT_PROFILE_CORRUPT' });
  });

  it.each(['game:stream', 'game.', 'game ', 'COM¹', 'a/../b', '\\?\\C:\\game', 'bad\ud800'])('rejects ambiguous path %p before filesystem access', value => {
    expect(() => validateEnrollmentPath(value)).toThrow();
  });

  it('rejects hosted use, missing owners and unqualified PostgreSQL persistence', async () => {
    const hosted = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'hosted');
    await expect(hosted.list(owner)).rejects.toThrow('HOSTED_MODE_DENIED');
    await expect(registry.list({ ...owner, ownerId: '' })).rejects.toMatchObject({ statusCode: 401 });
    const postgres = new GameProjectStore(new Database({ type: 'postgresql' }));
    await expect(postgres.list(owner)).rejects.toMatchObject({ code: 'PROJECT_STORE_UNAVAILABLE' });
  });

  it('applies the additive migration to an existing database backup and preserves prior data across restart', async () => {
    await database.query("INSERT INTO knowledge_sources (id, source, title) VALUES ('prior', 'fixture-prior-source', 'Preserve this document')");
    const project = await registry.enroll(owner, game, 'godot', selection);
    await database.close();
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.db') }); await database.initialize();
    registry = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'test');
    expect((await registry.get(owner, project.projectId)).profile.profileDigest).toBe(project.profile.profileDigest);
    await database.query('DROP TABLE game_enrolled_projects'); // Representative pre-G01 schema, with real existing RAG rows.
    const backupPath = path.join(root, 'pre-g01-backup.db');
    await (database as any).db.backup(backupPath);
    await database.close();
    const restored = path.join(root, 'restored.db'); fs.copyFileSync(backupPath, restored);
    database = new Database({ type: 'sqlite', filePath: restored }); await database.initialize();
    const rows = await database.query("SELECT title FROM knowledge_sources WHERE id = 'prior'");
    expect(rows.rows).toEqual([{ title: 'Preserve this document' }]);
    expect((database as any).db.pragma('integrity_check', { simple: true })).toBe('ok');
    const migrated = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'test');
    expect((await migrated.enroll(owner, game, 'godot', selection)).revision).toBe(1);
    const legacy = require('better-sqlite3')(backupPath, { readonly: true });
    expect(legacy.prepare("SELECT name FROM sqlite_master WHERE name = 'game_enrolled_projects'").all()).toEqual([]);
    expect(legacy.prepare("SELECT title FROM knowledge_sources WHERE id = 'prior'").get().title).toBe('Preserve this document');
    legacy.close();
  });
});
