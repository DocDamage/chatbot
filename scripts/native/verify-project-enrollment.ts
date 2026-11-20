/** G01.1 native version observation + real HTTP/SQLite restart. No gameplay qualification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { Database } from '../../src/core/database/Database';
import { GameProjectStore } from '../../src/core/gaming/project/GameProjectStore';
import { createGameStudioRouter } from '../../src/server/routes/game-studio/gameStudioRoutes';
import { errorHandler } from '../../src/middleware/errorHandler';
import { discoverLocalRuntimes } from '../../src/core/native-runtime/RuntimeDiscovery';

async function main(): Promise<void> {
  const output = path.resolve(process.argv[2] || 'docs/implementation/evidence/game-development/2026-11-03-g01/native-enrollment.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-enrollment-native-'));
  const filename = path.join(root, 'profiles.db');
  let database: Database | undefined;
  let server: Server | undefined;
  let base: string;
  const start = async () => {
    database = new Database({ type: 'sqlite', filePath: filename }); await database.initialize();
    const app = express(); app.use(express.json());
    // Synthetic trusted principal for this loopback-only fixture; JWT/security gates are covered separately.
    app.use((req, _res, next) => { req.user = { userId: 'native-enrollment-fixture', roles: ['developer'] }; next(); });
    app.use(createGameStudioRouter(root, { projectStore: new GameProjectStore(database) }), errorHandler);
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  const stop = async () => {
    if (server) { const current = server; server = undefined; current.closeIdleConnections(); await new Promise<void>((resolve, reject) => current.close(error => error ? reject(error) : resolve())); }
    if (database) { await database.close(); database = undefined; }
  };
  const api = async (url: string, body?: unknown, expected = 200) => {
    const response = await fetch(`${base}${url}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json() as any;
    assert.equal(response.status, expected, JSON.stringify(result));
    return result;
  };
  try {
    await start();
    const inventory = await api('/api/game-studio/runtimes?engine=godot');
    assert.equal(inventory.runtimes.length, 1, 'This fixture requires one unambiguous host Godot installation; inspect/select multiple installations explicitly.');
    const runtime = inventory.runtimes[0];
    const feature = runtime.exactVersion.match(/^(\d+\.\d+)/)[1];
    for (const name of ['one', 'two', 'wrong']) {
      const directory = path.join(root, name); fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'project.godot'), `config_version=5\n[application]\nconfig/name="Synthetic enrollment fixture"\nconfig/features=PackedStringArray("${feature}")\n`);
    }
    const first = await api('/api/game-studio/projects', { engine: 'godot', projectRoot: path.join(root, 'one'), selectedRuntimeId: runtime.runtimeId }, 201);
    const second = await api('/api/game-studio/projects', { engine: 'godot', projectRoot: path.join(root, 'two'), selectedRuntimeId: runtime.runtimeId }, 201);
    assert.equal(first.profile.resolution, 'resolved'); assert.equal(second.profile.resolution, 'resolved');
    assert.notEqual(first.projectId, second.projectId); assert.notEqual(first.profile.profileDigest, second.profile.profileDigest);
    assert.equal(first.profile.targetId, second.profile.targetId);
    const wrong = await api('/api/game-studio/projects', { engine: 'godot', projectRoot: path.join(root, 'wrong'), expectedVersion: '4.0.0.stable.official.fixture' }, 201);
    assert.equal(wrong.profile.resolution, 'blocked'); assert.equal(wrong.profile.targetId, null);
    assert.ok(wrong.profile.blockers.some((item: any) => item.code === 'PROJECT_RUNTIME_VERSION_MISMATCH'));
    await stop(); await start();
    const restored = await api(`/api/game-studio/projects/${first.projectId}`);
    assert.equal(restored.profile.profileDigest, first.profile.profileDigest); assert.equal(restored.revision, 1);
    fs.appendFileSync(path.join(root, 'one/project.godot'), '# changed after enrollment\n');
    const stale = await api(`/api/game-studio/projects/${first.projectId}`, undefined, 409);
    const refreshed = await api(`/api/game-studio/projects/${first.projectId}/refresh`, { expectedRevision: 1 });
    assert.equal(refreshed.revision, 2); assert.notEqual(refreshed.profile.profileDigest, first.profile.profileDigest);
    // Read Windows file-version resources/build metadata; do not launch either licensed editor.
    const [unityInventory, unrealInventory] = await Promise.all([
      api('/api/game-studio/runtimes?engine=unity'), api('/api/game-studio/runtimes?engine=unreal')
    ]);
    const unrealEnrollments = [];
    for (const [index, unreal] of unrealInventory.runtimes.entries()) {
      const directory = path.join(root, `unreal-${index}`); fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'Fixture.uproject'), JSON.stringify({ FileVersion: 3, EngineAssociation: unreal.exactVersion, Plugins: [], Modules: [] }));
      const enrolled = await api('/api/game-studio/projects', { engine: 'unreal', projectRoot: directory,
        selectedRuntimeId: unreal.runtimeId, expectedBuildDigest: unreal.buildIdentityDigest }, 201);
      assert.equal(enrolled.profile.resolution, 'resolved');
      assert.equal(enrolled.profile.runtime.executableSha256, unreal.executableSha256);
      const checked = await api(`/api/game-studio/projects/${enrolled.projectId}`);
      assert.equal(checked.profile.profileDigest, enrolled.profile.profileDigest);
      unrealEnrollments.push(enrolled);
    }
    const record = { recordedAt: new Date().toISOString(), scope: 'Native Godot --version, exact executable hash, HTTP enrollment and SQLite/server restart on synthetic projects only.',
      inventory, first, second, wrong, restored, stale, refreshed, otherEditorMetadata: { unityInventory, unrealInventory }, unrealEnrollments,
      discoveredUnrealEditor: discoverLocalRuntimes(root).unreal || null,
      gates: ['exact runtime observation', 'distinct physical/profile identity', 'shared compatibility target', 'wrong-version blocker', 'server/database restart persistence', 'stale descriptor rejection', 'revision-checked refresh',
        ...(unrealEnrollments.length ? ['exact Unreal metadata/profile enrollment with fresh descriptor/executable/build checks'] : [])] };
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`Godot ${runtime.exactVersion}: ${record.gates.length} enrollment gates passed. Evidence: ${output}`);
  } finally {
    await stop();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('godot-enrollment-native-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
