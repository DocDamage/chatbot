import fs from 'node:fs';
import path from 'node:path';
import { InstalledGameEditorBackend } from '../../src/core/native-runtime/NativeGameEditorBackends';
import { discoverLocalRuntimes } from '../../src/core/native-runtime/RuntimeDiscovery';

const workspace = path.resolve(__dirname, '..', '..');
const runId = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
const runRoot = path.join(workspace, 'data', 'native-runtime', 'certification', runId);
const unityRoot = path.join(runRoot, 'unity');
const unrealRoot = path.join(runRoot, 'unreal');

fs.mkdirSync(runRoot, { recursive: true });
fs.mkdirSync(path.join(unityRoot, 'Assets'), { recursive: true });
fs.mkdirSync(path.join(unityRoot, 'Packages'), { recursive: true });
fs.mkdirSync(path.join(unityRoot, 'ProjectSettings'), { recursive: true });
fs.mkdirSync(unrealRoot, { recursive: true });
fs.writeFileSync(path.join(unityRoot, 'Assets', 'Smoke.cs'), `using UnityEngine;

public sealed class Smoke : MonoBehaviour
{
    public string status = "Ready";

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void Bootstrap()
    {
        if (GameObject.Find("ChatBotSmokeProbe") != null) return;
        var probe = new GameObject("ChatBotSmokeProbe");
        probe.AddComponent<Smoke>();
        Object.DontDestroyOnLoad(probe);
    }
}
`, 'utf8');
fs.writeFileSync(path.join(unityRoot, 'Packages', 'manifest.json'), '{\n  "dependencies": {}\n}\n', 'utf8');
fs.writeFileSync(path.join(unityRoot, 'ProjectSettings', 'ProjectVersion.txt'), 'm_EditorVersion: 6000.4.5f1\nm_EditorVersionWithRevision: 6000.4.5f1 (cc83ebd631f8)\n', 'utf8');
fs.writeFileSync(path.join(unrealRoot, 'Smoke.uproject'), `${JSON.stringify({
  FileVersion: 3,
  EngineAssociation: '5.8',
  Category: '',
  Description: 'ChatBot native runtime certification project',
  Plugins: [
    { Name: 'PythonScriptPlugin', Enabled: true },
    { Name: 'EditorScriptingUtilities', Enabled: true }
  ]
}, null, 2)}\n`, 'utf8');

const runtimes = discoverLocalRuntimes(workspace);
if (!runtimes.unity || !runtimes.unreal) throw new Error('Both complete Unity and Unreal editor installations are required.');
const backend = new InstalledGameEditorBackend(runtimes);
const runUnity = !process.argv.includes('--unreal-only');
const runUnreal = !process.argv.includes('--unity-only');
const evidence: Record<string, unknown> = {
  runId,
  timestamp: new Date().toISOString(),
  runtimes: { unity: runtimes.unity, unreal: runtimes.unreal },
  projects: { unity: unityRoot, unreal: unrealRoot }
};

async function main(): Promise<void> {
  try {
    if (runUnity) {
      evidence.unityScenario = await backend.runScenario('unity', unityRoot, { headless: true, maxDurationSeconds: 300 }, [
        { type: 'node_exists', target: 'ChatBotSmokeProbe', expected: true },
        { type: 'property_equals', target: 'ChatBotSmokeProbe', property: 'Smoke.status', expected: 'Ready' },
        { type: 'fps_above', target: 'runtime', expected: 1 }
      ]);
      evidence.unityProfile = await backend.profile('unity', unityRoot, 2_000);
    }
    if (runUnreal) {
      evidence.unrealScenario = await backend.runScenario('unreal', unrealRoot, { headless: true, maxDurationSeconds: 300 }, [
        { type: 'node_exists', target: '*', expected: true }
      ]);
      evidence.unrealProfile = await backend.profile('unreal', unrealRoot, 2_000);
    }
    const unityScenario = evidence.unityScenario as { passed: boolean } | undefined;
    const unrealScenario = evidence.unrealScenario as { passed: boolean } | undefined;
    evidence.passed = (!runUnity || unityScenario?.passed === true) && (!runUnreal || unrealScenario?.passed === true);
    if (!evidence.passed) throw new Error('One or more installed-editor scenarios failed.');
  } catch (error) {
    evidence.passed = false;
    evidence.error = error instanceof Error ? error.message : String(error);
  } finally {
    const evidencePath = path.join(runRoot, 'game-editor-certification.json');
    fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ evidencePath, ...evidence }, null, 2)}\n`);
  }

  if (!evidence.passed) process.exitCode = 1;
}

void main();
