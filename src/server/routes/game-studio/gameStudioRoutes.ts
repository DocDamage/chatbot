/**
 * Game Studio Routes (PX08-T10 / PX09-T08)
 *
 * REST API for game engine inspection, scene explorer, mutation proposals,
 * cryptographic approvals, runtime scenario testing, and profiling.
 */

import { Router } from 'express';
import { asyncHandler } from '../../../middleware/errorHandler';
import { GameEngineBridge } from '../../../core/gaming/engine/GameEngineBridge';
import { MultiEngineStudioService } from '../../../core/gaming/engine/MultiEngineStudioService';
import { GodotMcpXAdapter } from '../../../core/gaming/godot/GodotMcpXAdapter';
import { UnityEngineAdapter } from '../../../core/gaming/unity/UnityEngineAdapter';
import { UnrealEngineAdapter } from '../../../core/gaming/unreal/UnrealEngineAdapter';
import { UnityMastService } from '../../../core/gaming/unity/UnityMastService';
import { SpriteSlicingBridge } from '../../../core/gaming/slicing/SpriteSlicingBridge';
import { AssetCookerAdapter, AssetCookerExecutor } from '../../../core/gaming/asset-cooker/AssetCookerAdapter';
import { EngineType } from '../../../core/gaming/engine/GameEngineTypes';
import { resolveWorkspacePath } from '../localPathGuard';
import { GodotCliBackend } from '../../../core/gaming/godot/GodotCliBackend';
import { LocalAssetCookerExecutor } from '../../../core/gaming/asset-cooker/LocalAssetCookerExecutor';
import { discoverLocalRuntimes, InstalledGameEditorBackend } from '../../../core/native-runtime';

export function createGameStudioRouter(
  workspaceRoot: string,
  integrations: { assetCookerExecutor?: AssetCookerExecutor } = {}
): Router {
  const router = Router();
  const runtimes = discoverLocalRuntimes(workspaceRoot);
  const installedEditors = new InstalledGameEditorBackend(runtimes);

  const bridge = new GameEngineBridge();
  bridge.addApprovedRoot(workspaceRoot);

  const godotBackend = runtimes.godot ? new GodotCliBackend(runtimes.godot, workspaceRoot) : undefined;
  const godotAdapter = new GodotMcpXAdapter(godotBackend, godotBackend);
  const unityAdapter = new UnityEngineAdapter(installedEditors);
  const unrealAdapter = new UnrealEngineAdapter(installedEditors);

  bridge.registerAdapter(godotAdapter);
  bridge.registerAdapter(unityAdapter);
  bridge.registerAdapter(unrealAdapter);

  const studioService = new MultiEngineStudioService(bridge);

  // Summary & Profiles
  router.get('/api/game-studio/summary', asyncHandler(async (_req, res) => {
    res.json({
      ...studioService.getStudioSummary(),
      installedRuntimes: {
        godot: Boolean(runtimes.godot),
        unity: Boolean(runtimes.unity),
        unreal: Boolean(runtimes.unreal),
        assetCooker: true
      }
    });
  }));

  router.get('/api/game-studio/profiles', asyncHandler(async (_req, res) => {
    res.json({
      profiles: studioService.getStudioSummary().certificationProfiles
    });
  }));

  // Connect / Disconnect
  router.post('/api/game-studio/connect', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const projectRoot = req.body.projectRoot || workspaceRoot;
    const toolMode = req.body.toolMode || 'all';

    const status = await bridge.connect({
      engine,
      projectRoot,
      toolMode
    });

    res.json(status);
  }));

  router.post('/api/game-studio/disconnect', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    await bridge.disconnect(engine);
    res.json({ success: true, engine });
  }));

  // Project & Scene Inspection
  router.get('/api/game-studio/project', asyncHandler(async (req, res) => {
    const engine = (req.query.engine || 'godot') as EngineType;
    const info = await bridge.inspectProject(engine);
    res.json(info);
  }));

  router.get('/api/game-studio/scene', asyncHandler(async (req, res) => {
    const engine = (req.query.engine || 'godot') as EngineType;
    const scenePath = String(req.query.path || 'Main.tscn');
    const scene = await bridge.inspectScene(engine, scenePath);
    res.json(scene);
  }));

  router.get('/api/game-studio/script', asyncHandler(async (req, res) => {
    const engine = (req.query.engine || 'godot') as EngineType;
    const scriptPath = String(req.query.path || '');
    const script = await bridge.inspectScript(engine, scriptPath);
    res.json(script);
  }));

  // Mutation Proposals & Approvals
  router.post('/api/game-studio/proposals', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const proposal = await bridge.proposeMutation(engine, {
      engine,
      projectId: req.body.projectId || 'DefaultGame',
      title: req.body.title || 'Studio Proposal',
      description: req.body.description || '',
      risk: req.body.risk || 'medium',
      actions: req.body.actions || []
    });
    res.json(proposal);
  }));

  router.post('/api/game-studio/proposals/:id/approve', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const approverId = req.user?.userId || String(req.body.approverId || 'local-operator');
    const proposal = await bridge.approveMutation(engine, req.params.id, approverId);
    res.json(proposal);
  }));

  router.post('/api/game-studio/proposals/:id/apply', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const proposalId = req.params.id;
    const approvalDigest = req.body.approvalDigest || '';
    const callerId = req.user?.userId || String(req.body.callerId || req.body.approverId || 'local-operator');

    const tx = await bridge.applyMutation(engine, proposalId, approvalDigest, {
      callerId,
      tenantId: req.body.tenantId
    });
    res.json(tx);
  }));

  router.post('/api/game-studio/transactions/:id/rollback', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const txId = req.params.id;
    const success = await bridge.rollbackTransaction(engine, txId);
    res.json({ success, transactionId: txId });
  }));

  // Runtime Testing & Assertions
  router.post('/api/game-studio/runtime/scenario', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const report = await bridge.runRuntimeScenario(
      engine,
      {
        scenePath: req.body.scenePath,
        headless: req.body.headless ?? true
      },
      req.body.assertions || []
    );
    res.json(report);
  }));

  // Performance Profiling
  router.get('/api/game-studio/profiler', asyncHandler(async (req, res) => {
    const engine = (req.query.engine || 'godot') as EngineType;
    const snapshot = await bridge.profilePerformance(engine);
    res.json(snapshot);
  }));

  router.post('/api/game-studio/export', asyncHandler(async (req, res) => {
    const engine = (req.body.engine || 'godot') as EngineType;
    const result = await bridge.exportProject(engine, {
      name: String(req.body.name || 'Default'),
      platform: req.body.platform || 'windows',
      exportPath: String(req.body.exportPath || `builds/${engine}-export`),
      templateVersion: String(req.body.templateVersion || 'installed'),
      customOptions: req.body.customOptions
    });
    res.json(result);
  }));

  // MAST Occupancy & Placement
  router.post('/api/game-studio/mast/layout', asyncHandler(async (req, res) => {
    const layout = UnityMastService.generateDungeonLayout({
      width: req.body.width,
      depth: req.body.depth,
      roomCount: req.body.roomCount
    });
    res.json(layout);
  }));

  // Sprite Slicing
  router.post('/api/game-studio/slicing/profile', asyncHandler(async (req, res) => {
    const width = Number(req.body.width || 64);
    const height = Number(req.body.height || 64);
    const mode = req.body.mode || '9-slice';
    const profile = SpriteSlicingBridge.computeSliceProfile(width, height, mode);
    res.json(profile);
  }));

  // Asset Cooking
  router.post('/api/game-studio/asset-cook', asyncHandler(async (req, res) => {
    const assetCookerExecutor = integrations.assetCookerExecutor || new LocalAssetCookerExecutor();
    const configRoot = resolveWorkspacePath(workspaceRoot, req.body.configRoot || workspaceRoot, {
      label: 'configRoot', mustExist: true, kind: 'directory'
    });
    const result = await AssetCookerAdapter.cookAssets({
      configRoot,
      targetPlatform: req.body.targetPlatform || 'windows',
      dirtyOnly: req.body.dirtyOnly ?? true
    }, assetCookerExecutor);
    res.json(result);
  }));

  return router;
}
