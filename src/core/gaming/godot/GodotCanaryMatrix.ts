/**
 * Godot Validation Canary Matrix (PX08-T13)
 *
 * Runs end-to-end integration and verification on Godot projects:
 * 1. Connects to project root
 * 2. Inspects project, scene, and script metadata
 * 3. Proposes an undoable scene mutation
 * 4. Approves proposal with cryptographic digest
 * 5. Applies transaction atomically with pre-mutation snapshots
 * 6. Executes runtime scenario and verifies assertions
 * 7. Rolls back transaction and verifies clean project state
 */

import * as fs from 'fs';
import * as path from 'path';
import { GodotMcpXAdapter } from './GodotMcpXAdapter';
import { GodotProjectManifest } from './GodotProjectManifest';
import { EngineMutationAction } from '../engine/GameEngineTypes';

export interface GodotCanaryResult {
  passed: boolean;
  projectConnected: boolean;
  inspectedScenesCount: number;
  mutationApplied: boolean;
  runtimeAssertionsPassed: boolean;
  rollbackSuccessful: boolean;
  cleanStateVerified: boolean;
  durationMs: number;
  stepsLog: string[];
  error?: string;
}

export class GodotCanaryMatrix {
  /**
   * Run the complete Godot verification canary flow on a test workspace
   */
  public static async runCanary(
    fixtureDir: string,
    adapter: GodotMcpXAdapter = new GodotMcpXAdapter()
  ): Promise<GodotCanaryResult> {
    const startTime = Date.now();
    const stepsLog: string[] = [];

    // Ensure fixture directory and basic project.godot exist
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    const projectGodotPath = path.join(fixtureDir, 'project.godot');
    if (!fs.existsSync(projectGodotPath)) {
      fs.writeFileSync(
        projectGodotPath,
        `config_version=5\n\n[application]\nconfig/name="CanaryGame"\nrun/main_scene="res://Main.tscn"\n`
      );
    }

    const mainTscnPath = path.join(fixtureDir, 'Main.tscn');
    if (!fs.existsSync(mainTscnPath)) {
      fs.writeFileSync(
        mainTscnPath,
        `[gd_scene format=3 uid="uid://canary123"]\n\n[node name="Main" type="Node2D"]\n`
      );
    }

    const initialManifest = GodotProjectManifest.capture(fixtureDir);
    stepsLog.push(`[Step 1] Baseline manifest captured with ${initialManifest.totalFiles} files.`);

    try {
      // 1. Connect
      await adapter.connect({
        engine: 'godot',
        projectRoot: fixtureDir,
        versionOverride: '4.2.x'
      });
      stepsLog.push('[Step 2] Godot adapter connected successfully.');

      // 2. Inspect
      const projectInfo = await adapter.inspectProject();
      const sceneInfo = await adapter.inspectScene('Main.tscn');
      stepsLog.push(`[Step 3] Inspected project: ${projectInfo.name}, scene nodes: ${sceneInfo.nodeCount}.`);

      // 3. Propose mutation
      const addPlayerAction: EngineMutationAction = {
        type: 'add_node',
        targetPath: 'Main.tscn',
        params: {
          nodeName: 'Player',
          nodeType: 'CharacterBody2D',
          parent: '.'
        }
      };

      const proposal = await adapter.proposeMutation({
        engine: 'godot',
        projectId: projectInfo.name,
        title: 'Add Player Node',
        description: 'Instantiate CharacterBody2D player into main scene',
        risk: 'low',
        actions: [addPlayerAction]
      });
      stepsLog.push(`[Step 4] Mutation proposed with ID: ${proposal.id}`);

      // 4. Approve
      const txManager = adapter.getTransactionManager();
      const approved = txManager.approveProposal(proposal.id, 'canary-tester');
      stepsLog.push(`[Step 5] Proposal approved with digest: ${approved.approvalDigest}`);

      // 5. Apply
      const tx = await adapter.applyMutation(proposal.id, approved.approvalDigest!);
      stepsLog.push(`[Step 6] Transaction applied with ID: ${tx.id}`);

      // Verify scene file changed
      const mutatedScene = await adapter.inspectScene('Main.tscn');
      const mutationApplied = mutatedScene.rootNode.children.some(c => c.name === 'Player');
      stepsLog.push(`[Step 7] Mutation verified on disk: Player node present = ${mutationApplied}`);

      // 6. Runtime play & assertions
      const report = await adapter.runRuntimeScenario({ scenePath: 'Main.tscn' }, [
        { type: 'node_exists', target: 'Player', expected: true },
        { type: 'fps_above', target: 'viewport', expected: 30 }
      ]);
      stepsLog.push(`[Step 8] Runtime scenario executed; assertions passed: ${report.passed}`);

      // 7. Rollback
      const rollbackSuccess = await adapter.rollbackTransaction(tx.id);
      stepsLog.push(`[Step 9] Transaction rolled back: ${rollbackSuccess}`);

      // 8. Reconcile clean state
      const finalManifest = GodotProjectManifest.capture(fixtureDir);
      const cleanState = initialManifest.manifestDigest === finalManifest.manifestDigest;
      stepsLog.push(`[Step 10] Clean state reconciliation verified: ${cleanState}`);

      const durationMs = Date.now() - startTime;

      return {
        passed: mutationApplied && report.passed && rollbackSuccess && cleanState,
        projectConnected: true,
        inspectedScenesCount: projectInfo.scenes.length,
        mutationApplied,
        runtimeAssertionsPassed: report.passed,
        rollbackSuccessful: rollbackSuccess,
        cleanStateVerified: cleanState,
        durationMs,
        stepsLog
      };
    } catch (err: any) {
      stepsLog.push(`[Error] Canary execution error: ${err.message}`);
      return {
        passed: false,
        projectConnected: false,
        inspectedScenesCount: 0,
        mutationApplied: false,
        runtimeAssertionsPassed: false,
        rollbackSuccessful: false,
        cleanStateVerified: false,
        durationMs: Date.now() - startTime,
        stepsLog,
        error: err.message
      };
    }
  }
}
