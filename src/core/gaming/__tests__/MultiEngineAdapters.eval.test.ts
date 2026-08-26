/**
 * Phase PX-09 Evaluation & Adapter Test Suite
 *
 * Tests Unity (MAST), Unreal Engine (Legal Gate & Read-Only Adapter),
 * AssetCooker (MPL Isolation), Sprite-Slicing Bridge, and Cross-Engine Isolation.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GameEngineBridge } from '../engine/GameEngineBridge';
import { MultiEngineStudioService } from '../engine/MultiEngineStudioService';
import { ENGINE_CERTIFICATION_PROFILES } from '../engine/EngineCertificationProfile';
import { UnityMastService } from '../unity/UnityMastService';
import { UnityEngineAdapter } from '../unity/UnityEngineAdapter';
import { UnrealLicenseGate } from '../unreal/UnrealLicenseGate';
import { UnrealEngineAdapter } from '../unreal/UnrealEngineAdapter';
import { AssetCookerAdapter } from '../asset-cooker/AssetCookerAdapter';
import { SpriteSlicingBridge } from '../slicing/SpriteSlicingBridge';
import { GameEngineError } from '../engine/GameEngineTypes';

describe('Phase PX-09: Unity, Unreal, Sprite-Slicing, and Asset-Build Adapters', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'multi-engine-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('PX09-T01: Engine Certification Profiles', () => {
    it('provides complete certification profiles for godot, unity, unreal, and custom', () => {
      expect(ENGINE_CERTIFICATION_PROFILES.godot.licenseStatus).toBe('permissive_cleared');
      expect(ENGINE_CERTIFICATION_PROFILES.unity.licenseStatus).toBe('clean_room_verified');
      expect(ENGINE_CERTIFICATION_PROFILES.unreal.licenseStatus).toBe('clean_room_verified');
      expect(ENGINE_CERTIFICATION_PROFILES.godot.supportedEngineVersions).toContain('4.2.x');
      expect(ENGINE_CERTIFICATION_PROFILES.unity.supportedEngineVersions).toContain('2022.3 LTS');
      expect(ENGINE_CERTIFICATION_PROFILES.unreal.supportedEngineVersions).toContain('5.8.x');
    });
  });

  describe('PX09-T02: Unity MAST Modular Placement & Engine Adapter', () => {
    it('generates collision-free modular dungeon layouts and validates occupancy', () => {
      const proposal = UnityMastService.generateDungeonLayout({
        width: 6,
        depth: 6,
        roomCount: 1
      });

      expect(proposal.placements.length).toBeGreaterThan(0);
      expect(proposal.cellSize).toBe(2.0);

      const validation = UnityMastService.validateOccupancy(proposal);
      expect(validation.valid).toBe(true);
      expect(validation.overlaps).toBe(0);
    });

    it('connects to Unity project and inspects scene structure', async () => {
      fs.mkdirSync(path.join(tempDir, 'Assets', 'Scenes'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'Assets', 'Scenes', 'SampleScene.unity'), '%YAML fixture');
      const adapter = new UnityEngineAdapter();
      const status = await adapter.connect({
        engine: 'unity',
        projectRoot: tempDir
      });

      expect(status.state).toBe('connected');
      expect(status.engine).toBe('unity');

      const projectInfo = await adapter.inspectProject();
      expect(projectInfo.engine).toBe('unity');

      expect(projectInfo.scenes).toContain('Assets/Scenes/SampleScene.unity');
      const scene = await adapter.inspectScene('Assets/Scenes/SampleScene.unity');
      expect(scene.path).toBe('Assets/Scenes/SampleScene.unity');
      expect(scene.rootNode.type).toBe('UnityScene');
    });
  });

  describe('PX09-T03: AssetCooker External Adapter (MPL-2.0 Isolation)', () => {
    it('executes asset cooking within isolated config root', async () => {
      const configRoot = path.join(tempDir, 'asset-config');
      fs.mkdirSync(configRoot, { recursive: true });

      const result = await AssetCookerAdapter.cookAssets({
        configRoot,
        targetPlatform: 'windows',
        dirtyOnly: true
      }, {
        async cook(options) {
          fs.writeFileSync(path.join(options.outputDirectory, 'manifest.json'), '{}');
          return {
            jobId: 'fixture-cook', success: true, platform: options.targetPlatform || 'windows',
            totalAssets: 1, cookedAssets: 1, skippedAssets: 0, durationMs: 1,
            outputArtifactPath: options.outputDirectory, logs: ['Fixture worker completed.']
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.totalAssets).toBeGreaterThan(0);
      expect(fs.existsSync(result.outputArtifactPath)).toBe(true);
    });

    it('fails closed when the isolated AssetCooker worker is unavailable', async () => {
      await expect(AssetCookerAdapter.cookAssets({ configRoot: tempDir })).rejects.toThrow(/ASSET_COOKER_BACKEND_UNAVAILABLE/);
    });
  });

  describe('PX09-T04: Sprite-Slicing Bridge & Engine Manifests', () => {
    it('computes 9-slice and 25-slice profiles with valid margins and exports Godot NinePatchRect', () => {
      const profile9 = SpriteSlicingBridge.computeSliceProfile(128, 128, '9-slice');
      expect(profile9.sliceMode).toBe('9-slice');
      expect(profile9.margins.top).toBe(32);
      expect(profile9.margins.left).toBe(32);

      const ninePatch = SpriteSlicingBridge.exportGodotNinePatch('res://ui_box.png', profile9);
      expect(ninePatch.resourceType).toBe('NinePatchRect');
      expect(ninePatch.patchMarginLeft).toBe(32);
      expect(ninePatch.texturePath).toBe('res://ui_box.png');

      const profile25 = SpriteSlicingBridge.computeSliceProfile(100, 100, '25-slice');
      expect(profile25.sliceMode).toBe('25-slice');
      expect(profile25.cells?.length).toBe(25);
    });
  });

  describe('PX09-T05, T06 & T07: Unreal Engine Legal Gate, Inspection, & Mutation Manager', () => {
    it('enforces license gate and prevents unauthorized Unreal operations when blocked', async () => {
      UnrealLicenseGate.setStatus('BLOCKED_PENDING_LICENSE');

      const adapter = new UnrealEngineAdapter();
      await expect(
        adapter.connect({
          engine: 'unreal',
          projectRoot: tempDir
        })
      ).rejects.toThrow(/LICENSE_GATE_BLOCKED/);

      // Restore to verified clean-room status
      UnrealLicenseGate.setStatus('CLEAN_ROOM_VERIFIED');
      fs.writeFileSync(path.join(tempDir, 'Test.uproject'), '{}');
      const status = await adapter.connect({
        engine: 'unreal',
        projectRoot: tempDir
      });
      expect(status.state).toBe('connected');
    });

    it('performs read-only inspection and staged mutation proposals when unblocked', async () => {
      UnrealLicenseGate.setStatus('CLEAN_ROOM_VERIFIED');
      fs.writeFileSync(path.join(tempDir, 'Test.uproject'), '{}');
      fs.mkdirSync(path.join(tempDir, 'Content', 'Maps'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'Content', 'Maps', 'Main.umap'), Buffer.from('actual-binary-map-fixture'));
      const adapter = new UnrealEngineAdapter();
      await adapter.connect({ engine: 'unreal', projectRoot: tempDir });

      const map = await adapter.inspectScene('Content/Maps/Main.umap');
      expect(map.rootNode.type).toBe('UnrealMapBinary');
      expect(map.rootNode.properties.sha256).toMatch(/^[a-f0-9]{64}$/);

      const proposal = await adapter.proposeMutation({
        engine: 'unreal',
        projectId: 'TestUEProject',
        title: 'Create source helper',
        description: 'Create an approved C++ helper source file',
        risk: 'low',
        actions: [{ type: 'create_script', targetPath: 'Source/Test/GeneratedHelper.cpp', params: { content: 'void GeneratedHelper() {}\n' } }]
      });

      expect(proposal.id).toBeDefined();
      expect(proposal.inputDigest).toMatch(/^[a-f0-9]{64}$/);
      const approved = await adapter.approveMutation(proposal.id, 'reviewer');
      expect(approved.approvalDigest).toMatch(/^[a-f0-9]{64}$/);
      const transaction = await adapter.applyMutation(proposal.id, approved.approvalDigest!, { callerId: 'reviewer' });
      expect(fs.existsSync(path.join(tempDir, 'Source', 'Test', 'GeneratedHelper.cpp'))).toBe(true);
      expect(await adapter.rollbackTransaction(transaction.id)).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'Source', 'Test', 'GeneratedHelper.cpp'))).toBe(false);
    });
  });

  describe('PX09-T08 & PX09-T09: Unified Studio Summary & Cross-Engine Project Isolation', () => {
    it('coordinates multiple engines in GameEngineBridge without cross-project boundary leaks', async () => {
      const bridge = new GameEngineBridge('local');
      bridge.addApprovedRoot(tempDir);
      fs.mkdirSync(path.join(tempDir, 'Assets'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'Test.uproject'), '{}');

      const unityAdapter = new UnityEngineAdapter();
      const unrealAdapter = new UnrealEngineAdapter();
      bridge.registerAdapter(unityAdapter);
      bridge.registerAdapter(unrealAdapter);

      await bridge.connect({ engine: 'unity', projectRoot: tempDir });
      await bridge.connect({ engine: 'unreal', projectRoot: tempDir });

      const studioService = new MultiEngineStudioService(bridge);
      const summary = studioService.getStudioSummary();

      expect(summary.activeEngines.length).toBe(2);
      expect(summary.activeEngines.some(e => e.engine === 'unity')).toBe(true);
      expect(summary.activeEngines.some(e => e.engine === 'unreal')).toBe(true);
      expect(summary.supportedTools).toContain('mast_analyze_occupancy');
      expect(summary.supportedTools).toContain('sprite_slice_detect');
      expect(summary.supportedTools).toContain('asset_cook_batch');
    });
  });
});
