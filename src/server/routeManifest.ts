import { RequestHandler } from 'express';
import { auditPrivilegedRequest } from '../middleware/auth';
import { resolveDeploymentMode, RuntimeProfile } from '../core/config/EnvironmentDefinitions';
import { createAudioRouter } from './routes/audio';
import { createBusinessGeniusRouter } from './routes/business';
import { createChronoRouter } from './routes/chrono';
import { createCodeRouter } from './routes/code';
import { createCreativeWritingRouter } from './routes/creative';
import { createEducationRouter } from './routes/education';
import { createEngineeringGeniusRouter } from './routes/engineering';
import { createExportRouter } from './routes/export';
import { createFilesRouter } from './routes/files';
import { createFLStudioControlRouter } from './routes/flstudio';
import { createGISRouter } from './routes/gis';
import { createGameDevRouter } from './routes/gamedev';
import { createGamingRouter } from './routes/gaming';
import { createGeoCultureGeniusRouter } from './routes/geography';
import { createHealthGeniusRouter } from './routes/health';
import { createHistoryRouter } from './routes/history';
import { createKnowledgeOnlineRouter } from './routes/knowledge-online';
import { createLanguageGeniusRouter } from './routes/language';
import { createLegalCivicGeniusRouter } from './routes/legal';
import { createLocalToolsRouter } from './routes/local-tools';
import { createMarketRouter } from './routes/market';
import { createMathRouter } from './routes/math';
import { createMusicProductionGeniusRouter } from './routes/music';
import { createPhilosophyGeniusRouter } from './routes/philosophy';
import { createPlansRouter } from './routes/plans';
import { createPopCultureRouter } from './routes/pop-culture';
import { createRagQueryRouter } from './routes/rag-query';
import { createScienceRouter } from './routes/science';
import { createSecurityGeniusRouter } from './routes/security';
import { createSECRouter } from './routes/sec';
import { createSixSigmaRouter } from './routes/sixsigma';
import { createSpriteLabRouter } from './routes/sprite-lab';
import { createStoryGeniusRouter } from './routes/story';
import { createToolCatalogRouter } from './routes/toolCatalog';

export type RouteAvailability = 'hosted-and-local' | 'local-only';
export type FeatureStatus = 'PRODUCTION_PREVIEW' | 'LOCAL_ONLY_EXPERIMENTAL';

export interface RouteManifestEntry {
  name: string;
  mount?: string;
  readiness: boolean;
  privilege?: 'admin' | 'developer';
  auditAction?: string;
  availability: RouteAvailability;
  status: FeatureStatus;
}

const preview = (entry: Omit<RouteManifestEntry, 'availability' | 'status'>): RouteManifestEntry => ({
  ...entry,
  availability: 'hosted-and-local',
  status: 'PRODUCTION_PREVIEW'
});
const localOnly = (entry: Omit<RouteManifestEntry, 'availability' | 'status'>): RouteManifestEntry => ({
  ...entry,
  availability: 'local-only',
  status: 'LOCAL_ONLY_EXPERIMENTAL'
});

export const routeManifest: RouteManifestEntry[] = [
  preview({ name: 'rag-query', readiness: true }),
  localOnly({ name: 'research', mount: '/api/research', readiness: true, privilege: 'developer', auditAction: 'research' }),
  localOnly({ name: 'code', mount: '/api/code', readiness: true, privilege: 'developer', auditAction: 'code' }),
  localOnly({ name: 'plans', mount: '/api/plans', readiness: false, privilege: 'developer', auditAction: 'plans' }),
  localOnly({ name: 'files', mount: '/api/files', readiness: false, privilege: 'developer', auditAction: 'files' }),
  localOnly({ name: 'audio', mount: '/api/audio', readiness: false, privilege: 'developer', auditAction: 'audio' }),
  localOnly({ name: 'local-tools', mount: '/api/local-tools', readiness: true, privilege: 'developer', auditAction: 'local-tools' }),
  preview({ name: 'tool-catalog', mount: '/api/tool-catalog', readiness: true, privilege: 'developer', auditAction: 'tool-catalog' }),
  preview({ name: 'sec', mount: '/api/sec', readiness: true, privilege: 'developer', auditAction: 'sec' }),
  preview({ name: 'education', mount: '/api/education', readiness: true, privilege: 'developer', auditAction: 'education' }),
  localOnly({ name: 'sprite-lab', mount: '/api/sprite-lab', readiness: true, privilege: 'developer', auditAction: 'sprite-lab' }),
  preview({ name: 'math', readiness: true }),
  preview({ name: 'market', readiness: true }),
  preview({ name: 'gamedev', readiness: true }),
  preview({ name: 'gaming', readiness: true }),
  preview({ name: 'sixsigma', readiness: true }),
  preview({ name: 'chrono', readiness: true }),
  preview({ name: 'pop-culture', readiness: true }),
  preview({ name: 'history', readiness: true }),
  preview({ name: 'science', readiness: true }),
  preview({ name: 'music', readiness: true }),
  localOnly({ name: 'flstudio', readiness: true }),
  preview({ name: 'story', readiness: true }),
  preview({ name: 'creative', readiness: true }),
  preview({ name: 'legal', readiness: true }),
  preview({ name: 'health', readiness: true }),
  preview({ name: 'security', readiness: true }),
  preview({ name: 'business', readiness: true }),
  preview({ name: 'philosophy', readiness: true }),
  preview({ name: 'language', readiness: true }),
  preview({ name: 'geography', readiness: true }),
  preview({ name: 'gis', readiness: true }),
  preview({ name: 'engineering', readiness: true }),
  preview({ name: 'knowledge-online', mount: '/api/knowledge-online', readiness: true, privilege: 'developer', auditAction: 'knowledge-online' }),
  preview({ name: 'admin', mount: '/api/admin', readiness: false, privilege: 'admin', auditAction: 'admin' }),
  preview({ name: 'export', mount: '/api/export', readiness: false, privilege: 'admin', auditAction: 'export' })
];

export function getActiveRouteManifest(profile: RuntimeProfile = resolveDeploymentMode()): RouteManifestEntry[] {
  return routeManifest.filter(entry => profile !== 'hosted' || entry.availability !== 'local-only');
}

interface RegisterRouteDeps {
  app: { use: (...handlers: any[]) => void };
  getServices: () => any;
  workspaceRoot: string;
  adminOnly: RequestHandler[];
  developerOnly: RequestHandler[];
  requireReady: () => RequestHandler;
  mountServiceRouter: (createRouter: () => RequestHandler) => RequestHandler;
}

export function registerManifestRoutes(deps: RegisterRouteDeps): void {
  const routerFactories: Record<string, () => RequestHandler> = {
    'rag-query': () => createRagQueryRouter(deps.getServices()),
    code: () => createCodeRouter(deps.getServices()),
    plans: () => createPlansRouter(deps.workspaceRoot),
    files: () => createFilesRouter(deps.workspaceRoot),
    audio: () => createAudioRouter(deps.workspaceRoot),
    'local-tools': () => createLocalToolsRouter(deps.getServices(), deps.workspaceRoot),
    'tool-catalog': () => createToolCatalogRouter(deps.getServices()),
    sec: () => createSECRouter(deps.getServices()),
    education: () => createEducationRouter(deps.getServices()),
    'sprite-lab': () => createSpriteLabRouter(deps.getServices(), deps.workspaceRoot),
    math: () => createMathRouter(deps.getServices()),
    market: () => createMarketRouter(deps.getServices()),
    gamedev: () => createGameDevRouter(deps.getServices()),
    gaming: () => createGamingRouter(deps.getServices()),
    sixsigma: () => createSixSigmaRouter(deps.getServices()),
    chrono: () => createChronoRouter(deps.getServices()),
    'pop-culture': () => createPopCultureRouter(deps.getServices()),
    history: () => createHistoryRouter(deps.getServices()),
    science: () => createScienceRouter(deps.getServices()),
    music: () => createMusicProductionGeniusRouter(deps.getServices()),
    flstudio: () => createFLStudioControlRouter(deps.getServices()),
    story: () => createStoryGeniusRouter(deps.getServices()),
    creative: () => createCreativeWritingRouter(deps.getServices()),
    legal: () => createLegalCivicGeniusRouter(deps.getServices()),
    health: () => createHealthGeniusRouter(deps.getServices()),
    security: () => createSecurityGeniusRouter(deps.getServices()),
    business: () => createBusinessGeniusRouter(deps.getServices()),
    philosophy: () => createPhilosophyGeniusRouter(deps.getServices()),
    language: () => createLanguageGeniusRouter(deps.getServices()),
    geography: () => createGeoCultureGeniusRouter(deps.getServices()),
    gis: () => createGISRouter(deps.getServices()),
    engineering: () => createEngineeringGeniusRouter(deps.getServices()),
    'knowledge-online': () => createKnowledgeOnlineRouter(deps.getServices()),
    admin: () => createAdminRouter(deps.getServices()),
    export: () => createExportRouter(deps.getServices())
  };

  for (const entry of getActiveRouteManifest()) {
    const routeHandlers: RequestHandler[] = [];
    if (entry.readiness) routeHandlers.push(deps.requireReady());
    routeHandlers.push(deps.mountServiceRouter(routerFactories[entry.name]));

    if (entry.mount) {
      const authHandlers = entry.privilege === 'admin'
        ? deps.adminOnly
        : entry.privilege === 'developer' ? deps.developerOnly : [];
      const audit = entry.auditAction ? [auditPrivilegedRequest(entry.auditAction)] : [];
      deps.app.use(entry.mount, ...authHandlers, ...audit);
    }
    deps.app.use(...routeHandlers);
  }
}

function createAdminRouter(services: any): RequestHandler {
  const { createAdminRouter: factory } = require('./routes/admin');
  return factory(services);
}
