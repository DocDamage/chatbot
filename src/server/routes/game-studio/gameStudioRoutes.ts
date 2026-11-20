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
import { GODOT_MUTATION_ACTIONS } from '../../../core/gaming/engine/EngineTextMutationPolicy';
import { UnityMastService } from '../../../core/gaming/unity/UnityMastService';
import { SpriteSlicingBridge } from '../../../core/gaming/slicing/SpriteSlicingBridge';
import { AssetCookerAdapter, AssetCookerExecutor } from '../../../core/gaming/asset-cooker/AssetCookerAdapter';
import { resolveWorkspacePath } from '../localPathGuard';
import { LocalAssetCookerExecutor } from '../../../core/gaming/asset-cooker/LocalAssetCookerExecutor';
import { discoverLocalRuntimes } from '../../../core/native-runtime';
import { GameProjectStore } from '../../../core/gaming/project/GameProjectStore';
import { GameProjectRegistry } from '../../../core/gaming/project/GameProjectRegistry';
import { ProjectProfileResolver } from '../../../core/gaming/project/ProjectProfileResolver';
import { ProjectRuntimeCatalog } from '../../../core/gaming/project/ProjectRuntimeCatalog';
import { createProjectEnrollmentRouter } from './projectEnrollmentRoutes';
import { createProjectContextRouter } from './projectContextRoutes';
import { createProjectSessionRouter } from './projectSessionRoutes';
import { GameProjectSessions } from '../../../core/gaming/project/GameProjectSessions';
import { projectBridgeFactory, ProjectBridgeFactory } from '../../../core/gaming/project/ProjectBridgeFactory';

export function createGameStudioRouter(
  workspaceRoot: string,
  integrations: { assetCookerExecutor?: AssetCookerExecutor; projectStore?: GameProjectStore; projectRegistry?: GameProjectRegistry; bridgeFactory?: ProjectBridgeFactory } = {}
): Router {
  const router = Router();
  const registry = integrations.projectRegistry || (integrations.projectStore
    ? new GameProjectRegistry(workspaceRoot, integrations.projectStore, new ProjectProfileResolver(new ProjectRuntimeCatalog(workspaceRoot))) : undefined);
  router.use(createProjectEnrollmentRouter(registry));
  router.use(createProjectContextRouter(registry));
  const sessions = registry ? new GameProjectSessions(registry, integrations.bridgeFactory || projectBridgeFactory(workspaceRoot)) : undefined;
  router.use(createProjectSessionRouter(sessions));
  const runtimes = discoverLocalRuntimes(workspaceRoot);
  const bridge = new GameEngineBridge();
  const studioService = new MultiEngineStudioService(bridge);

  // Summary & Profiles
  router.get('/api/game-studio/summary', asyncHandler(async (req, res) => {
    res.json({
      ...studioService.getStudioSummary(),
      activeEngines: req.user && sessions ? sessions.list({ ownerId: req.user.userId, tenantId: 'local' }) : [],
      mutationCapabilities: { godot: GODOT_MUTATION_ACTIONS },
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
