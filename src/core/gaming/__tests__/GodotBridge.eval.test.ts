/**
 * Phase PX-08 Evaluation & Contract Test Suite
 *
 * Tests Godot Editor/Runtime Bridge, ClassDB grounding, project inspection,
 * Forge-style manifests, transactions/approvals, runtime assertions, and canary matrix.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GameEngineBridge } from '../engine/GameEngineBridge';
import { GodotMcpXAdapter } from '../godot/GodotMcpXAdapter';
import { GodotProjectInspector } from '../godot/GodotProjectInspector';
import { GodotProjectManifest } from '../godot/GodotProjectManifest';
import { GodotTransactionManager } from '../godot/GodotTransactionManager';
import { GodotClassDbValidator } from '../godot/GodotClassDbValidator';
import { GodotProfiler } from '../godot/GodotProfiler';
import { GodotAssetPipeline } from '../godot/GodotAssetPipeline';
import { GodotCanaryMatrix } from '../godot/GodotCanaryMatrix';
import { GameEngineError } from '../engine/GameEngineTypes';

describe('Phase PX-08: Godot Editor/Runtime Bridge and Game Studio', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-test-'));
    // Setup standard minimal Godot project
    fs.writeFileSync(
      path.join(tempDir, 'project.godot'),
      `config_version=5\n\n[application]\nconfig/name="TestGame"\nrun/main_scene="res://Main.tscn"\n`
    );
    fs.writeFileSync(
      path.join(tempDir, 'Main.tscn'),
      `[gd_scene format=3 uid="uid://test1234"]\n\n[node name="Main" type="Node2D"]\n`
    );
    fs.writeFileSync(
      path.join(tempDir, 'Player.gd'),
      `extends CharacterBody2D\n\n@export var speed: float = 300.0\n\nfunc _physics_process(delta: float) -> void:\n\tmove_and_slide()\n`
    );
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  function createGodotAdapter(): GodotMcpXAdapter {
    return new GodotMcpXAdapter(
      {
        async runScenario(_projectRoot, options, assertions) {
          return {
            scenarioName: options.scenePath || 'Main',
            passed: true,
            durationMs: 1,
            assertions: assertions.map(assertion => ({ ...assertion, actual: assertion.expected, passed: true })),
            capturedLogs: ['Fixture Godot runtime completed.']
          };
        }
      },
      {
        async exportProject(_projectRoot, preset, outputDirectory) {
          const outputArtifactPath = path.join(outputDirectory, `${preset.name}.exe`);
          fs.writeFileSync(outputArtifactPath, Buffer.from('fixture-export'));
          return { presetName: preset.name, success: true, outputArtifactPath, durationMs: 1, byteSize: 0, logs: ['Fixture export completed.'] };
        }
      }
    );
  }

  describe('PX08-T01: GameEngineBridge Contract & Root Confinement', () => {
    it('enforces approved root boundaries and denies out-of-bounds paths', async () => {
      const bridge = new GameEngineBridge('local');
      bridge.addApprovedRoot(tempDir);
      const adapter = new GodotMcpXAdapter();
      bridge.registerAdapter(adapter);

      const status = await bridge.connect({
        engine: 'godot',
        projectRoot: tempDir
      });

      expect(status.state).toBe('connected');
      expect(status.engine).toBe('godot');

      // Attempt out-of-bounds path
      await expect(
        bridge.connect({
          engine: 'godot',
          projectRoot: path.join(os.tmpdir(), 'unapproved-dir')
        })
      ).rejects.toThrow(GameEngineError);
    });

    it('strictly denies all game engine operations in hosted deployment profile', async () => {
      const hostedBridge = new GameEngineBridge('hosted');
      hostedBridge.addApprovedRoot(tempDir);

      await expect(
        hostedBridge.connect({
          engine: 'godot',
          projectRoot: tempDir
        })
      ).rejects.toThrow(/HOSTED_MODE_DENIED/);
    });
  });

  describe('PX08-T03: Read-Only Project Inspection', () => {
    it('inspects project settings, scenes, and scripts accurately', async () => {
      const projectInfo = GodotProjectInspector.inspectProject(tempDir);
      expect(projectInfo.name).toBe('TestGame');
      expect(projectInfo.scenes).toContain('Main.tscn');
      expect(projectInfo.scripts).toContain('Player.gd');

      const sceneInfo = GodotProjectInspector.inspectScene(tempDir, 'Main.tscn');
      expect(sceneInfo.name).toBe('Main');
      expect(sceneInfo.rootNode.name).toBe('Main');
      expect(sceneInfo.rootNode.type).toBe('Node2D');

      const scriptInfo = GodotProjectInspector.inspectScript(tempDir, 'Player.gd');
      expect(scriptInfo.extendsClass).toBe('CharacterBody2D');
      expect(scriptInfo.methods.some(m => m.name === '_physics_process')).toBe(true);
      expect(scriptInfo.properties.some(p => p.name === 'speed')).toBe(true);
    });

    it('rejects absolute and relative scene/script paths outside the project root', () => {
      const outsideScene = path.join(path.dirname(tempDir), `${path.basename(tempDir)}-outside.tscn`);
      const outsideScript = path.join(path.dirname(tempDir), `${path.basename(tempDir)}-outside.gd`);
      fs.writeFileSync(outsideScene, '[gd_scene format=3]\n');
      fs.writeFileSync(outsideScript, 'extends Node\n');
      try {
        expect(() => GodotProjectInspector.inspectScene(tempDir, outsideScene)).toThrow(/outside/i);
        expect(() => GodotProjectInspector.inspectScript(tempDir, `../${path.basename(outsideScript)}`)).toThrow(/outside/i);
      } finally {
        fs.rmSync(outsideScene, { force: true });
        fs.rmSync(outsideScript, { force: true });
      }
    });

    it('rejects a project-local link that resolves outside the project root', () => {
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'godot-outside-'));
      const linkedDir = path.join(tempDir, 'linked-outside');
      fs.writeFileSync(path.join(outsideDir, 'Escaped.tscn'), '[gd_scene format=3]\n');
      try {
        fs.symlinkSync(outsideDir, linkedDir, process.platform === 'win32' ? 'junction' : 'dir');
        expect(() => GodotProjectInspector.inspectScene(tempDir, 'linked-outside/Escaped.tscn'))
          .toThrow(/link outside/i);
      } finally {
        fs.rmSync(linkedDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });
  });

  describe('PX08-T04: Forge-Style Project Manifest & Reconciliation', () => {
    it('detects external modifications and drift in project files', () => {
      const baseline = GodotProjectManifest.capture(tempDir);
      expect(baseline.totalFiles).toBeGreaterThan(0);

      // Verify clean initial state
      const cleanReconcile = GodotProjectManifest.reconcile(baseline);
      expect(cleanReconcile.isClean).toBe(true);
      expect(cleanReconcile.driftCount).toBe(0);

      // Modify a file externally
      fs.appendFileSync(path.join(tempDir, 'Player.gd'), '\n# external edit\n');

      const dirtyReconcile = GodotProjectManifest.reconcile(baseline);
      expect(dirtyReconcile.isClean).toBe(false);
      expect(dirtyReconcile.modifiedFiles).toContain('Player.gd');
    });
  });

  describe('PX08-T05 & PX08-T06: Mutation Proposals, Approvals, and Atomic Transactions', () => {
    it('proposes mutations with input digest, validates approval, applies changes, and rolls back cleanly', async () => {
      const txManager = new GodotTransactionManager(tempDir);

      const proposal = txManager.createProposal({
        projectId: 'TestGame',
        title: 'Add Score Label',
        description: 'Add Control Label to Main scene',
        actions: [
          {
            type: 'add_node',
            targetPath: 'Main.tscn',
            params: {
              nodeName: 'ScoreLabel',
              nodeType: 'Label',
              parent: '.'
            }
          }
        ]
      });

      expect(proposal.status).toBe('proposed');
      expect(proposal.inputDigest).toBeDefined();

      // Approve proposal
      const approved = txManager.approveProposal(proposal.id, 'lead-developer');
      expect(approved.status).toBe('approved');
      expect(approved.approvalDigest).toBeDefined();

      // Execute transaction
      const tx = await txManager.executeTransaction(
        proposal.id,
        approved.approvalDigest!,
        async (action, root) => {
          fs.appendFileSync(
            path.join(root, action.targetPath),
            `\n[node name="${action.params.nodeName}" type="${action.params.nodeType}" parent="${action.params.parent}"]\n`
          );
        }
      );

      expect(tx.id).toBeDefined();
      expect(fs.readFileSync(path.join(tempDir, 'Main.tscn'), 'utf8')).toContain('ScoreLabel');

      // Rollback transaction
      const rolledBack = txManager.rollbackTransaction(tx.id);
      expect(rolledBack).toBe(true);
      expect(fs.readFileSync(path.join(tempDir, 'Main.tscn'), 'utf8')).not.toContain('ScoreLabel');
    });

    it('rejects approval digest mismatches', async () => {
      const txManager = new GodotTransactionManager(tempDir);
      const proposal = txManager.createProposal({
        projectId: 'TestGame',
        title: 'Tampered proposal',
        description: 'Test tamper detection',
        actions: [{ type: 'create_scene', targetPath: 'New.tscn', params: {} }]
      });

      txManager.approveProposal(proposal.id, 'dev');

      await expect(
        txManager.executeTransaction(proposal.id, 'invalid-fake-digest', async () => {})
      ).rejects.toThrow(GameEngineError);
    });

    it('rejects unapproved proposals and mutation paths outside the project root', async () => {
      const txManager = new GodotTransactionManager(tempDir);
      const proposal = txManager.createProposal({
        projectId: 'TestGame',
        title: 'Escape attempt',
        description: 'Must never write outside the project',
        actions: [{ type: 'create_scene', targetPath: '../escape.tscn', params: {} }]
      });

      await expect(txManager.executeTransaction(proposal.id, 'anything', async () => {}))
        .rejects.toThrow(/cannot be applied/i);

      const approved = txManager.approveProposal(proposal.id, 'developer');
      await expect(txManager.executeTransaction(proposal.id, approved.approvalDigest!, async () => {}))
        .rejects.toThrow(/outside/i);
    });
  });

  describe('PX08-T11: ClassDB-Grounded GDScript Validator', () => {
    it('validates standard Godot 4 GDScript and catches Godot 3 syntax errors', () => {
      const validGd4 = `extends CharacterBody2D\n\n@export var speed: float = 200.0\n@onready var sprite = $Sprite2D\n\nfunc _ready() -> void:\n\tpass\n`;
      const validResult = GodotClassDbValidator.validateScript(validGd4);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors.length).toBe(0);

      const legacyGd3 = `extends KinematicBody2D\n\nonready var sprite = get_node("Sprite")\nexport var speed = 100\n\nfunc _ready():\n\tvar bullet = bullet_scene.instance()\n`;
      const invalidResult = GodotClassDbValidator.validateScript(legacyGd3);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors.some(e => e.includes('CharacterBody2D'))).toBe(true);
      expect(invalidResult.errors.some(e => e.includes('@onready'))).toBe(true);
      expect(invalidResult.errors.some(e => e.includes('.instantiate()'))).toBe(true);
    });
  });

  describe('PX08-T08 & PX08-T09: Profiling and Asset Pipeline', () => {
    it('profiles performance and flags regressions against baseline', () => {
      const profiler = new GodotProfiler();
      const baseline = profiler.captureSnapshot({ fps: 60.0, frameTimeMs: 16.6, memoryMb: 100, nodeCount: 120 });
      profiler.setBaseline(baseline);

      const degraded = profiler.captureSnapshot({ fps: 35.0, frameTimeMs: 28.5, memoryMb: 160, nodeCount: 120 });
      expect(degraded.regressions).toBeDefined();
      expect(degraded.regressions!.some(r => r.metric === 'fps')).toBe(true);
    });

    it('exports project preset package', async () => {
      const pipeline = new GodotAssetPipeline(tempDir, {
        async exportProject(_projectRoot, preset, outputDirectory) {
          const outputArtifactPath = path.join(outputDirectory, `${preset.name}.exe`);
          fs.writeFileSync(outputArtifactPath, Buffer.from('fixture-export'));
          return { presetName: preset.name, success: true, outputArtifactPath, durationMs: 1, byteSize: 0, logs: [] };
        }
      });
      const outDir = path.join(tempDir, 'builds');

      const result = await pipeline.exportPreset(
        {
          name: 'TestGame',
          platform: 'windows',
          exportPath: 'builds/TestGame.exe',
          templateVersion: '4.2.2'
        },
        outDir
      );

      expect(result.success).toBe(true);
      expect(fs.existsSync(result.outputArtifactPath)).toBe(true);
    });

    it('fails closed when a Godot export backend is absent', async () => {
      await expect(new GodotAssetPipeline(tempDir).exportPreset({
        name: 'NoBackend', platform: 'windows', exportPath: 'builds/no.exe', templateVersion: '4.2.2'
      }, path.join(tempDir, 'builds'))).rejects.toThrow(/GODOT_EXPORT_BACKEND_UNAVAILABLE/);
    });
  });

  describe('PX08-T13: Godot Canary Matrix Integration', () => {
    it('passes complete end-to-end Godot canary verification flow', async () => {
      const canaryResult = await GodotCanaryMatrix.runCanary(tempDir, createGodotAdapter());
      expect(canaryResult.passed).toBe(true);
      expect(canaryResult.mutationApplied).toBe(true);
      expect(canaryResult.runtimeAssertionsPassed).toBe(true);
      expect(canaryResult.rollbackSuccessful).toBe(true);
      expect(canaryResult.cleanStateVerified).toBe(true);
    });

    it('does not certify a Godot runtime without a real runner backend', async () => {
      const canaryResult = await GodotCanaryMatrix.runCanary(tempDir);
      expect(canaryResult.passed).toBe(false);
      expect(canaryResult.error).toMatch(/GODOT_RUNTIME_BACKEND_UNAVAILABLE/);
    });
  });
});
