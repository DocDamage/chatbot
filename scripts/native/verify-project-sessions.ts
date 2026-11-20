/** G01.2 real HTTP/native session isolation on disposable projects; no gameplay/export claim. */
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

async function main(): Promise<void> {
  const output = path.resolve(process.argv[2] || 'docs/implementation/evidence/game-development/2026-11-03-g01-sessions/native-sessions.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-sessions-native-'));
  let database: Database | undefined, server: Server | undefined, base: string;
  const start = async () => {
    database = new Database({ type: 'sqlite', filePath: path.join(root, 'profiles.db') }); await database.initialize();
    const app = express(); app.use(express.json());
    // Loopback synthetic principal only. Production JWT/route security is checked separately.
    app.use((req, _res, next) => { req.user = { userId: req.header('x-fixture-user') || 'native-session-fixture', roles: ['developer'] }; next(); });
    app.use(createGameStudioRouter(root, { projectStore: new GameProjectStore(database) }), errorHandler);
    server = await new Promise<Server>(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/game-studio`;
  };
  const stop = async () => {
    if (server) { const current = server; server = undefined; current.closeIdleConnections(); await new Promise<void>((resolve, reject) => current.close(error => error ? reject(error) : resolve())); }
    if (database) { await database.close(); database = undefined; }
  };
  const api = async (url: string, body?: unknown, expected = 200, actor?: string) => {
    const response = await fetch(`${base}${url}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(actor ? { 'x-fixture-user': actor } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json() as any; assert.equal(response.status, expected, JSON.stringify(result)); return result;
  };
  try {
    await start();
    const inventory = await api('/runtimes?engine=godot');
    assert.equal(inventory.runtimes.length, 1, 'Select an exact Godot runtime if host discovery is ambiguous.');
    const runtime = inventory.runtimes[0], feature = runtime.exactVersion.match(/^(\d+\.\d+)/)[1];
    const projects = [];
    for (const name of ['one', 'two']) {
      const directory = path.join(root, name); fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, 'project.godot'), `config_version=5\n[application]\nconfig/name="G01.2 synthetic session ${name}"\nconfig/features=PackedStringArray("${feature}")\nrun/main_scene="res://Main.tscn"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n`);
      fs.writeFileSync(path.join(directory, 'Main.tscn'), `[gd_scene format=3]\n[node name="Main" type="Node"]\n[node name="Status" type="Label" parent="."]\ntext = "${name}"\n`);
      projects.push(await api('/projects', { engine: 'godot', projectRoot: directory, selectedRuntimeId: runtime.runtimeId }, 201));
    }
    const sessions = await Promise.all(projects.map(p => api('/connect', { projectId: p.projectId })));
    assert.notEqual(sessions[0].sessionId, sessions[1].sessionId);
    for (const s of sessions) { assert.equal(s.version, runtime.exactVersion); assert.equal(s.runtimeId, runtime.runtimeId); }
    const scenes = await Promise.all(sessions.map(s => api(`/scene?sessionId=${s.sessionId}&path=Main.tscn`)));
    const observations = await Promise.all(sessions.map((s, i) => api('/runtime/scenario', { sessionId: s.sessionId, scenePath: 'res://Main.tscn',
      assertions: [{ type: 'node_exists', target: 'Status', expected: true }, { type: 'screen_text', target: 'Status', expected: ['one', 'two'][i] }] })));
    observations.forEach((report, i) => { assert.equal(report.passed, true, JSON.stringify(report)); assert.equal(report.checkKind, 'scene_observation'); assert.equal(report.projectScope.sessionId, sessions[i].sessionId); assert.equal(report.evidence.projectRoot, projects[i].canonicalRoot); });
    assert.notEqual(observations[0].evidence.runId, observations[1].evidence.runId);
    assert.notEqual(observations[0].evidence.requestDigest, observations[1].evidence.requestDigest);
    const repeated = await api('/runtime/scenario', { sessionId: sessions[0].sessionId, scenePath: 'res://Main.tscn', assertions: [{ type: 'screen_text', target: 'Status', expected: 'one' }] });
    assert.equal(repeated.passed, true); assert.notEqual(repeated.evidence.runId, observations[0].evidence.runId);
    const proposals = await Promise.all(sessions.map((s, i) => api('/proposals', { sessionId: s.sessionId, title: 'Native session isolation source fixture',
      actions: [{ type: 'create_script', targetPath: 'Created.gd', params: { content: `extends Node\n# scoped ${i}\n` } }] })));
    const approvals = await Promise.all(proposals.map((p, i) => api(`/proposals/${p.id}/approve`, { sessionId: sessions[i].sessionId })));
    const foreignGrant = await api(`/proposals/${proposals[0].id}/apply`, { sessionId: sessions[1].sessionId, approvalDigest: approvals[0].approvalDigest }, 404);
    const foreignOwner = await api(`/sessions/${sessions[0].sessionId}`, undefined, 404, 'foreign-owner');
    const transactions = await Promise.all(proposals.map((p, i) => api(`/proposals/${p.id}/apply`, { sessionId: sessions[i].sessionId, approvalDigest: approvals[i].approvalDigest })));
    for (const [i, project] of projects.entries()) assert.equal(fs.readFileSync(path.join(project.canonicalRoot, 'Created.gd'), 'utf8'), `extends Node\n# scoped ${i}\n`);
    const foreignRollback = await api(`/transactions/${transactions[0].id}/rollback`, { sessionId: sessions[1].sessionId }); assert.equal(foreignRollback.success, false);
    await api(`/transactions/${transactions[0].id}/rollback`, { sessionId: sessions[0].sessionId });
    assert.equal(fs.existsSync(path.join(projects[0].canonicalRoot, 'Created.gd')), false); assert.equal(fs.existsSync(path.join(projects[1].canonicalRoot, 'Created.gd')), true);
    await stop(); await start();
    const restored = await api(`/projects/${projects[1].projectId}`); assert.equal(restored.profile.profileDigest, projects[1].profile.profileDigest);
    const oldSession = await api(`/sessions/${sessions[1].sessionId}`, undefined, 404);
    const reconnected = await api('/connect', { projectId: projects[1].projectId }); assert.notEqual(reconnected.sessionId, sessions[1].sessionId);
    const oldGrant = await api(`/proposals/${proposals[1].id}/apply`, { sessionId: reconnected.sessionId, approvalDigest: approvals[1].approvalDigest }, 404);
    fs.appendFileSync(path.join(projects[1].canonicalRoot, 'project.godot'), '# profile changed externally\n');
    const stale = await api(`/sessions/${reconnected.sessionId}`, undefined, 409);
    await api('/disconnect', { sessionId: reconnected.sessionId });
    const record = { recordedAt: new Date().toISOString(), scope: 'Real headless Godot scene observations and HTTP source-write/session isolation on disposable projects; no gameplay, rendered output, export or licensed-editor execution.',
      runtime, projects, sessions, scenes, observations, repeated, proposals, approvals, transactions, foreignGrant, foreignOwner, foreignRollback, restored, oldSession, reconnected, oldGrant, stale,
      gates: ['exact enrolled executable/version', 'two concurrent same-engine sessions', 'native distinct scene observations', 'fresh run/request binding', 'independent source writes', 'foreign-session grant rejection', 'owner isolation', 'rollback isolation', 'SQLite/server restart keeps enrollment', 'restart discards sessions/grants', 'stale profile rejection', 'stale session disconnect'] };
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    console.log(`Godot ${runtime.exactVersion}: ${record.gates.length} native session gates passed. Evidence: ${output}`);
  } finally {
    await stop(); assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir())); assert.ok(path.basename(root).startsWith('godot-sessions-native-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
