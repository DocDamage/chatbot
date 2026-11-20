/** G00 native scene-observation regression. Synthetic fixtures do not qualify gameplay. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GodotCliBackend } from '../../src/core/gaming/godot/GodotCliBackend';
import { EngineAssertion } from '../../src/core/gaming/engine/GameEngineTypes';
import { discoverLocalRuntimes } from '../../src/core/native-runtime/RuntimeDiscovery';
import { runNativeCommand } from '../../src/core/native-runtime/NativeCommandRunner';

async function main(): Promise<void> {
  const workspace = process.cwd();
  const executable = discoverLocalRuntimes(workspace).godot;
  if (!executable) throw new Error('No Godot executable discovered. Configure GODOT_PATH.');
  const output = path.resolve(process.argv[2] || 'docs/implementation/evidence/game-development/2026-11-03-g00/native-observations.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-g00-native-'));
  try {
    const version = await runNativeCommand(executable, ['--version'], { timeoutMs: 15_000 });
    assert.equal(version.exitCode, 0);
    fs.writeFileSync(path.join(root, 'project.godot'), 'config_version=5\n[application]\nconfig/name="G00 synthetic observation fixture"\nrun/main_scene="res://Main.tscn"\n[rendering]\nrenderer/rendering_method="gl_compatibility"\n');
    fs.writeFileSync(path.join(root, 'Main.tscn'), '[gd_scene format=3]\n[node name="Main" type="Node"]\n[node name="Player" type="Node" parent="."]\nprocess_priority = 7\n[node name="Status" type="Label" parent="."]\ntext = "Ready"\n');
    const backend = new GodotCliBackend(executable, workspace);
    const options = { scenePath: 'res://Main.tscn', maxDurationSeconds: 15 };
    const assertions: EngineAssertion[] = [
      { type: 'node_exists', target: 'Player', expected: true },
      { type: 'node_exists', target: 'Missing', expected: false },
      { type: 'property_equals', target: 'Player', property: 'process_priority', expected: 7 },
      { type: 'screen_text', target: 'Status', expected: 'Ready' }
    ];
    const matching = await backend.runScenario(root, options, assertions);
    const mismatched = await backend.runScenario(root, options, [{ type: 'screen_text', target: 'Status', expected: 'Wrong' }]);
    const empty = await backend.runScenario(root, options, []);
    const missingScene = await backend.runScenario(root, { ...options, scenePath: 'res://Absent.tscn' }, [{ type: 'node_exists', target: 'Missing', expected: false }]);
    const unsupported = await backend.runScenario(root, options, [{ type: 'custom', target: 'Player', expected: true }]);
    const record = {
      recordedAt: new Date().toISOString(), scope: 'Synthetic headless scene observations only; no input/death/respawn gameplay scenario or export.',
      executable, executableSha256: crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),
      version: version.stdout.trim(), matching, mismatched, empty, missingScene, unsupported
    };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
    assert.equal(matching.passed, true, matching.error || matching.capturedLogs.join('\n'));
    for (const report of [mismatched, empty, missingScene, unsupported]) assert.equal(report.passed, false);
    console.log(`Godot ${record.version}: 5 scene-observation gates passed. Evidence: ${output}`);
  } finally {
    // Only the mkdtemp-owned fixture is removed; never an enrolled game project.
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('godot-g00-native-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
