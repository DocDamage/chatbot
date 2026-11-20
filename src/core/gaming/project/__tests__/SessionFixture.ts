import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Database } from '../../../database/Database';
import { GameProjectStore } from '../GameProjectStore';
import { GameProjectRegistry } from '../GameProjectRegistry';
import { ProjectRuntimeCatalog } from '../ProjectRuntimeCatalog';
import { ProjectProfileResolver } from '../ProjectProfileResolver';
import { EnrolledRuntime, ProjectOwner } from '../ProjectEnrollmentTypes';
import { GameEngineBridge } from '../../engine/GameEngineBridge';
import { GodotMcpXAdapter } from '../../godot/GodotMcpXAdapter';
import { UnityEngineAdapter } from '../../unity/UnityEngineAdapter';
import { UnrealEngineAdapter } from '../../unreal/UnrealEngineAdapter';
import { GodotRuntimeBackend } from '../../godot/GodotRuntimeRunner';
import { GodotExportBackend } from '../../godot/GodotAssetPipeline';
import { ProjectBridgeFactory } from '../ProjectBridgeFactory';

/** Synthetic host inventory with real SQLite/byte hashes. No fixture process is executed. */
export async function createSessionFixture(root: string, backend?: GodotRuntimeBackend, exporter?: GodotExportBackend) {
  const database = new Database({ type: 'sqlite', filePath: path.join(root, 'session-fixture.sqlite') }); await database.initialize();
  const runtimes: EnrolledRuntime[] = (['godot', 'unity', 'unreal'] as const).map(engine => {
    const executablePath = path.join(root, `.fixture-${engine}.exe`); fs.writeFileSync(executablePath, `fixture ${engine} runtime bytes`);
    const exactVersion = engine === 'godot' ? '4.7.1.stable.official.fixture' : engine === 'unity' ? '6000.4.5f1' : '5.8.4';
    return { runtimeId: `fixture-${engine}`, engine, exactVersion, executablePath, executableSha256: crypto.createHash('sha256').update(fs.readFileSync(executablePath)).digest('hex'),
      evidenceId: `synthetic-host-evidence-${engine}`, versionSource: engine === 'godot' ? 'executable-stdout' : 'file-version-resource', versionOutput: exactVersion,
      observedAt: new Date().toISOString(), associations: engine === 'unreal' ? ['5.8'] : [], ...(engine === 'unreal' ? { buildIdentityDigest: 'a'.repeat(64) } : {}) };
  });
  const catalog = new ProjectRuntimeCatalog(root, () => []);
  jest.spyOn(catalog, 'inventory').mockImplementation(async engine => ({ runtimes: structuredClone(runtimes.filter(runtime => runtime.engine === engine)), blockers: [] }));
  const registry = new GameProjectRegistry(root, new GameProjectStore(database), new ProjectProfileResolver(catalog), 'test');
  const bridgeFactory: ProjectBridgeFactory = project => {
    const bridge = new GameEngineBridge('test'); bridge.addApprovedRoot(root);
    if (project.profile.facts.engine === 'godot') bridge.registerAdapter(new GodotMcpXAdapter(backend, exporter));
    else if (project.profile.facts.engine === 'unity') bridge.registerAdapter(new UnityEngineAdapter());
    else bridge.registerAdapter(new UnrealEngineAdapter());
    return bridge;
  };
  const writeProject = (directory: string, engine: 'godot' | 'unity' | 'unreal' = 'godot') => {
    fs.mkdirSync(directory, { recursive: true });
    const write = (file: string, content: string) => { const target = path.join(directory, file); if (!fs.existsSync(target)) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); } };
    if (engine === 'godot') write('project.godot', 'config_version=5\n[application]\nconfig/features=PackedStringArray("4.7")\n');
    else if (engine === 'unity') {
      fs.mkdirSync(path.join(directory, 'Assets'), { recursive: true }); write('ProjectSettings/ProjectVersion.txt', 'm_EditorVersion: 6000.4.5f1\n');
      write('Packages/manifest.json', '{"dependencies":{}}'); write('Packages/packages-lock.json', '{"dependencies":{}}');
    } else write('Game.uproject', '{"EngineAssociation":"5.8","Plugins":[],"Modules":[]}');
  };
  const enroll = async (directory: string, engine: 'godot' | 'unity' | 'unreal' = 'godot', owner: ProjectOwner = { ownerId: 'local-operator', tenantId: 'local' }) => {
    writeProject(directory, engine); return registry.enroll(owner, directory, engine, { selectedRuntimeId: `fixture-${engine}` });
  };
  return { database, registry, bridgeFactory, runtimes, enroll, writeProject, close: () => database.close() };
}
