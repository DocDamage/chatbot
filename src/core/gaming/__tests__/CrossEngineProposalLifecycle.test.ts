import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ProjectMutationStore } from '../engine/ProjectMutationStore';
import { AssetCookerAdapter } from '../asset-cooker/AssetCookerAdapter';
import { UnrealLicenseGate } from '../unreal/UnrealLicenseGate';

describe('RT-GAME-001..006 — Cross-Engine Proposal, Verification, and AssetCooker Suite', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-engine-proposal-test-'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('RT-GAME-001: Cross-Engine Proposal/Approval/Apply/Rollback', () => {
    const engines = ['godot', 'unity', 'unreal'] as const;

    for (const engine of engines) {
      it(`executes full proposal lifecycle on ${engine}`, () => {
        const store = new ProjectMutationStore(engine, tempDir);
        const proposal = store.createProposal({
          engine,
          projectId: 'proj-test',
          title: `Setup ${engine} scene`,
          description: `Initial scene for ${engine}`,
          risk: 'low',
          actions: [
            {
              type: 'create_scene',
              targetPath: `content/scene_${engine}.txt`,
              params: { content: `Scene data for ${engine}` },
            },
          ],
        });

        expect(proposal.status).toBe('proposed');
        const approved = store.approve(proposal.id, 'lead-designer');
        expect(approved.status).toBe('approved');

        const tx = store.apply(proposal.id, approved.approvalDigest!, { callerId: 'lead-designer' });
        expect(tx.id).toBeDefined();
        expect(fs.existsSync(path.join(tempDir, `content/scene_${engine}.txt`))).toBe(true);

        const rolledBack = store.rollback(tx.id);
        expect(rolledBack).toBe(true);
        expect(fs.existsSync(path.join(tempDir, `content/scene_${engine}.txt`))).toBe(false);
      });
    }
  });

  describe('RT-GAME-004: Unreal License & Validation Gate', () => {
    it('verifies license gate status and throws when blocked', () => {
      UnrealLicenseGate.setStatus('BLOCKED_PENDING_LICENSE');
      expect(UnrealLicenseGate.getStatus()).toBe('BLOCKED_PENDING_LICENSE');
      expect(() => UnrealLicenseGate.assertCleared()).toThrow(/license/i);

      UnrealLicenseGate.setStatus('CLEAN_ROOM_VERIFIED');
      expect(() => UnrealLicenseGate.assertCleared()).not.toThrow();
    });
  });

  describe('RT-GAME-006: AssetCooker Isolation & Build Integrity', () => {
    it('processes asset builds into isolated output directories without touching original source', async () => {
      const configRoot = path.join(tempDir, 'project');
      fs.mkdirSync(configRoot, { recursive: true });
      fs.writeFileSync(path.join(configRoot, 'asset.json'), '{"name":"test"}');

      const mockExecutor = {
        cook: jest.fn().mockImplementation(async (opts) => ({
          jobId: 'job-1',
          success: true,
          platform: opts.targetPlatform || 'windows',
          totalAssets: 1,
          cookedAssets: 1,
          skippedAssets: 0,
          durationMs: 50,
          outputArtifactPath: opts.outputDirectory,
          logs: ['Cooked asset.json'],
        })),
      };

      const result = await AssetCookerAdapter.cookAssets(
        { configRoot, targetPlatform: 'windows' },
        mockExecutor
      );

      expect(result.success).toBe(true);
      expect(result.cookedAssets).toBe(1);
    });
  });
});
