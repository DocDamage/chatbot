/** Real HTTP/SQLite source context and current Godot identity; synthetic projects, no model/native gameplay claim. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

async function main(): Promise<void> {
  const output = path.resolve(process.argv[2] || 'docs/implementation/evidence/game-development/2026-11-03-g01-context/http-context.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'game-context-native-'));
  let database: Database | undefined, server: Server | undefined, base: string;
  const write = (file: string, text: string) => { const full = path.join(root, file); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, text); };
  const start = async () => {
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.sqlite') }); await database.initialize();
    const app = express(); app.use(express.json());
    // This fixture server only listens on loopback. JWT/role gates are tested in the HTTP regression suite.
    app.use((req, _res, next) => { req.user = { userId: req.header('x-fixture-user') || 'context-fixture', roles: ['developer'] }; next(); });
    app.use(createGameStudioRouter(root, { projectStore: new GameProjectStore(database) }), errorHandler);
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/game-studio`;
  };
  const stop = async () => {
    if (server) { const current = server; server = undefined; current.closeIdleConnections(); await new Promise<void>((resolve, reject) => current.close(error => error ? reject(error) : resolve())); }
    if (database) { await database.close(); database = undefined; }
  };
  const api = async (route: string, body?: object, expected = 200, actor?: string) => {
    const response = await fetch(`${base}${route}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(actor ? { 'x-fixture-user': actor } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json() as any; assert.equal(response.status, expected, JSON.stringify(result)); return result;
  };
  try {
    await start();
    const inventory = await api('/runtimes?engine=godot'); assert.equal(inventory.runtimes.length, 1);
    const runtime = inventory.runtimes[0], feature = runtime.exactVersion.match(/^(\d+\.\d+)/)[1];
    write('godot/project.godot', `config_version=5\n[application]\nconfig/features=PackedStringArray("${feature}")\nrun/main_scene="res://Main.tscn"\n`);
    write('godot/Main.tscn', '[gd_scene format=3]\n[ext_resource type="Script" path="res://Player.gd" id="1"]\n[node name="SOURCE_CONTEXT_CANARY" type="Node"]\nscript = ExtResource("1")\n');
    write('godot/Player.gd', '\ufeffextends Node\r\nconst Scene = preload("res://Item.tres")\r\n'); write('godot/Item.tres', '[gd_resource type="Resource" format=3]\n[resource]\n');
    write('godot/.godot/imported/Cache.gd', 'PRIVATE_CACHE_CANARY'); write('godot/secrets/Secret.gd', 'PRIVATE_SECRET_CANARY');
    const project = await api('/projects', { engine: 'godot', projectRoot: path.join(root, 'godot'), selectedRuntimeId: runtime.runtimeId }, 201);
    const context = await api(`/projects/${project.projectId}/context`, { files: ['Main.tscn'] });
    assert.equal(context.editable.length, 0);
    assert.deepEqual(context.readOnly.map((file: any) => file.path).filter((file: string) => ['Main.tscn', 'Player.gd', 'Item.tres'].includes(file)).sort(), ['Item.tres', 'Main.tscn', 'Player.gd']);
    const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'godot/Player.gd'))).digest('hex');
    assert.equal(context.sourceHashes['Player.gd'], sourceHash); assert.doesNotMatch(JSON.stringify(context), /PRIVATE_CACHE_CANARY|PRIVATE_SECRET_CANARY/);
    const search = await api(`/projects/${project.projectId}/files/search?q=SOURCE_CONTEXT_CANARY`); assert.equal(search.matches[0].path, 'Main.tscn');
    const foreign = await api(`/projects/${project.projectId}/context`, { files: ['Main.tscn'], ownerId: 'context-fixture' }, 404, 'foreign');
    write('mz/Game.rmmzproject', 'RPGMZ 1.0'); write('mz/js/rmmz_core.js', 'Utils.RPGMAKER_NAME = "MZ"; Utils.RPGMAKER_VERSION = "1.9.0";');
    write('mz/js/plugins.js', 'var $plugins = [];'); write('mz/data/Actors.json', '[null,{"id":1,"classId":1}]'); write('mz/data/Classes.json', '[null,{"id":1}]');
    const mz = await api('/projects', { engine: 'rpg-maker-mz', projectRoot: path.join(root, 'mz') }, 201); assert.equal(mz.profile.resolution, 'blocked');
    const mzContext = await api(`/projects/${mz.projectId}/context`, { files: ['data/Actors.json'] });
    assert.equal(mzContext.summary.find((file: any) => file.path === 'data/Actors.json').fileRole, 'structured-data');
    assert.ok(mzContext.readOnly.some((file: any) => file.path === 'data/Classes.json'));
    await stop(); await start();
    const restarted = await api(`/projects/${project.projectId}/context`, { files: ['Main.tscn'] }); assert.equal(restarted.contextDigest, context.contextDigest);
    fs.appendFileSync(path.join(root, 'godot/Player.gd'), '# external source edit\n');
    const changed = await api(`/projects/${project.projectId}/context`, { files: ['Main.tscn'] }); assert.notEqual(changed.contextDigest, context.contextDigest);
    fs.appendFileSync(path.join(root, 'godot/project.godot'), '# changed profile\n');
    const stale = await api(`/projects/${project.projectId}/context`, { files: ['Main.tscn'] }, 409);
    const record = { recordedAt: new Date().toISOString(), scope: 'Real host Godot identity, production HTTP source context and SQLite restart on synthetic fixtures only. No model generation, native gameplay, MZ execution or ROM tool claim.', runtime, project, context, sourceHash, search, foreign, mz, mzContext, restarted, changed, stale,
      gates: ['exact host runtime/profile', 'scene/script/resource relationships', 'read-only permissions', 'lossless BOM/CRLF hashes', 'secret/cache exclusion', 'search shares policy', 'owner isolation', 'MZ structured-data context while native blocked', 'SQLite/server restart reproduces digest', 'source edits change context digest', 'profile drift rejects context'] };
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`${record.gates.length} HTTP/source context gates passed; Godot identity ${runtime.exactVersion}. Evidence: ${output}`);
  } finally {
    await stop(); assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('game-context-native-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
